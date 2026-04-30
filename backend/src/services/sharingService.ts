import mongoose from "mongoose";
import { User } from "../models/User";
import { Conversation, ChatMessage } from "../models/Conversation";
import { SharedConversation } from "../models/SharedConversation";
import { RagDocument } from "../models/RagDocument";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
import { logEvent } from "./auditService";

/** Placeholder shown to a recipient on assistant messages whose cited sources they aren't authorised to see. */
const REDACTION_PLACEHOLDER =
  "🔒 This response cited documents you don't have permission to view, so it has been hidden.";

interface RedactedMessage extends ChatMessage {
  /** Set on messages whose body was hidden from the recipient. Frontend can render a different style. */
  redacted?: boolean;
}

/**
 * For each assistant message in the group, check whether the recipient has access to
 * every cited source document. If ANY source is restricted to a group the recipient
 * isn't part of (or the source doc has been deleted / lives in another BU), the
 * message body, sources, and any generated-document attachment are stripped and
 * replaced with a placeholder. The user's own questions are never redacted.
 */
async function redactMessagesForRecipient(
  messages: ChatMessage[],
  recipient: { _id: mongoose.Types.ObjectId; businessUnit: string }
): Promise<RedactedMessage[]> {
  // Collect every source documentId referenced across the conversation in one pass.
  const docIds = new Set<string>();
  for (const m of messages) {
    if (m.role !== "assistant" || !m.sources) continue;
    for (const s of m.sources) {
      if (s.documentId) docIds.add(s.documentId);
    }
  }
  if (docIds.size === 0) return messages;

  // Resolve each cited doc's allowed groups (and BU) and the recipient's group memberships
  // in two batched queries.
  const validIds = Array.from(docIds).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [docs, recipientGroups] = await Promise.all([
    RagDocument.find({ _id: { $in: validIds } })
      .select("_id businessUnit allowedGroupIds")
      .lean(),
    KnowledgeGroup.find({ businessUnit: recipient.businessUnit, memberUserIds: recipient._id })
      .select("_id")
      .lean()
  ]);

  const docMeta = new Map<
    string,
    { businessUnit: string; allowedGroupIds: string[] }
  >();
  for (const d of docs) {
    docMeta.set(String(d._id), {
      businessUnit: d.businessUnit,
      allowedGroupIds: (d.allowedGroupIds || []).map((g) => String(g))
    });
  }
  const recipientGroupIds = new Set(recipientGroups.map((g) => String(g._id)));

  const recipientCanSeeDoc = (docId: string): boolean => {
    const meta = docMeta.get(docId);
    if (!meta) return false; // deleted or never existed → treat as inaccessible
    if (meta.businessUnit !== recipient.businessUnit) return false; // cross-BU citation
    if (meta.allowedGroupIds.length === 0) return true; // open to every employee in the BU
    return meta.allowedGroupIds.some((gid) => recipientGroupIds.has(gid));
  };

  return messages.map((m) => {
    if (m.role !== "assistant" || !m.sources || m.sources.length === 0) return m;
    const allAccessible = m.sources.every((s) => recipientCanSeeDoc(s.documentId));
    if (allAccessible) return m;
    return {
      ...m,
      content: REDACTION_PLACEHOLDER,
      sources: undefined,
      generatedDocument: undefined,
      redacted: true
    };
  });
}

export interface ShareResult {
  success: true;
  shareId: string;
  sharedWithEmail: string;
}

export interface ShareError {
  success: false;
  status: number;
  error: string;
}

/**
 * Share a conversation group with another user.
 *
 * Rules enforced here (server-side, not relying on the caller):
 *  1. The conversation group must exist and belong to the sender.
 *  2. The recipient must exist.
 *  3. sender.businessUnit === recipient.businessUnit — hard reject otherwise.
 *  4. Duplicate shares (same sender + recipient + group + messageIndex) are rejected with 409.
 *
 * When `messageIndex` is provided, the share is scoped to that single AI response.
 * The recipient sees only that message plus the preceding user question.
 */
export async function shareConversation(
  senderUserId: string,
  senderBusinessUnit: string,
  conversationGroupId: string,
  recipientEmail: string,
  messageIndex?: number
): Promise<ShareResult | ShareError> {
  // 1. Validate ObjectId format to avoid DB errors
  if (!mongoose.Types.ObjectId.isValid(conversationGroupId)) {
    return { success: false, status: 400, error: "Invalid conversation ID" };
  }

  // 2. Verify the conversation group belongs to the sender
  const senderConversations = await Conversation.findOne({
    userId: new mongoose.Types.ObjectId(senderUserId)
  });

  if (!senderConversations) {
    return { success: false, status: 404, error: "Conversation not found" };
  }

  const group = senderConversations.conversationGroups.find(
    (g) => g._id.toString() === conversationGroupId
  );

  if (!group) {
    return { success: false, status: 404, error: "Conversation not found" };
  }

  // Validate messageIndex (when present): must point at an assistant message in this group.
  // Sharing a user's own question makes no sense — they'd want the AI's reply too.
  if (messageIndex !== undefined && messageIndex !== null) {
    if (
      typeof messageIndex !== "number" ||
      !Number.isInteger(messageIndex) ||
      messageIndex < 0 ||
      messageIndex >= group.messages.length
    ) {
      return { success: false, status: 400, error: "Invalid message index" };
    }
    if (group.messages[messageIndex].role !== "assistant") {
      return {
        success: false,
        status: 400,
        error: "Only AI responses can be shared as a single message — pick the assistant reply, not the question."
      };
    }
  }

  // 3. Look up the recipient
  const recipient = await User.findOne({
    email: recipientEmail.toLowerCase().trim()
  }).select("_id email businessUnit fullName");

  if (!recipient) {
    return { success: false, status: 404, error: "Recipient user not found" };
  }

  // Prevent sharing with yourself
  if (recipient._id.toString() === senderUserId) {
    return { success: false, status: 400, error: "You cannot share a conversation with yourself" };
  }

  // 4. Business-unit access control — core security check
  if (senderBusinessUnit !== recipient.businessUnit) {
    logEvent("conversation_share_denied", {
      userId: senderUserId,
      businessUnit: senderBusinessUnit,
      action: "Share Denied",
      details: `Cross-BU share attempt to ${recipient.email} blocked`,
      metadata: {
        conversationGroupId,
        recipientEmail: recipient.email,
        recipientBusinessUnit: recipient.businessUnit,
        reason: "cross_business_unit"
      }
    });

    return {
      success: false,
      status: 403,
      error: "You can only share conversations within your business unit"
    };
  }

  // 5. Prevent duplicate shares (per-conversation OR per-message — keyed independently)
  const normalizedIndex =
    typeof messageIndex === "number" && Number.isInteger(messageIndex) ? messageIndex : null;

  const existing = await SharedConversation.findOne({
    sharedByUserId: new mongoose.Types.ObjectId(senderUserId),
    sharedWithUserId: recipient._id,
    conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId),
    messageIndex: normalizedIndex
  });

  if (existing) {
    return {
      success: false,
      status: 409,
      error: normalizedIndex !== null
        ? "You've already shared this AI response with that user."
        : "This conversation has already been shared with that user"
    };
  }

  // 6. Create the share record
  const share = await SharedConversation.create({
    conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId),
    sharedByUserId: new mongoose.Types.ObjectId(senderUserId),
    sharedWithUserId: recipient._id,
    businessUnit: senderBusinessUnit,
    messageIndex: normalizedIndex
  });

  // 7. Audit log (fire-and-forget — never blocks the response)
  logEvent("conversation_shared", {
    userId: senderUserId,
    businessUnit: senderBusinessUnit,
    action: normalizedIndex !== null ? "AI Response Shared" : "Conversation Shared",
    details:
      normalizedIndex !== null
        ? `Shared a single AI response from "${group.title}" with ${recipient.email}`
        : `Shared conversation "${group.title}" with ${recipient.email}`,
    metadata: {
      shareId: share._id.toString(),
      conversationGroupId,
      conversationTitle: group.title,
      sharedWithUserId: recipient._id.toString(),
      sharedWithEmail: recipient.email,
      messageIndex: normalizedIndex
    }
  });

  return {
    success: true,
    shareId: share._id.toString(),
    sharedWithEmail: recipient.email
  };
}

/**
 * List all conversations shared with the given user.
 * Each conversation's messages are filtered through the recipient's group access —
 * assistant messages citing documents the recipient can't see are replaced with a
 * redaction placeholder. The user's own questions are never redacted.
 */
export async function getConversationsSharedWithMe(recipientUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(recipientUserId)) return [];

  const recipient = await User.findById(recipientUserId)
    .select("_id businessUnit")
    .lean();
  if (!recipient) return [];

  const shares = await SharedConversation.find({
    sharedWithUserId: recipient._id
  })
    .sort({ createdAt: -1 })
    .lean();

  const results = await Promise.all(
    shares.map(async (share) => {
      // Load the owner's conversation document to read the group content
      const ownerConversations = await Conversation.findOne({
        userId: share.sharedByUserId
      }).lean();

      if (!ownerConversations) return null;

      const group = ownerConversations.conversationGroups.find(
        (g) => g._id.toString() === share.conversationGroupId.toString()
      );

      if (!group) return null;

      // Load sharer's display name
      const sharedByUser = await User.findById(share.sharedByUserId)
        .select("fullName email")
        .lean();

      // Per-message share: scope the visible messages to the focused AI reply
      // plus the immediately-preceding user question (so the recipient has the
      // context for what was asked). Whole-conversation shares pass through.
      let scopedMessages = group.messages;
      const isSingleMessageShare =
        typeof share.messageIndex === "number" && share.messageIndex !== null;
      if (isSingleMessageShare) {
        const idx = share.messageIndex as number;
        if (idx >= 0 && idx < group.messages.length) {
          const start = idx > 0 ? idx - 1 : idx;
          scopedMessages = group.messages.slice(start, idx + 1);
        } else {
          // Index pointed past the group (message deleted since share was created) — drop the share.
          return null;
        }
      }

      const visibleMessages = await redactMessagesForRecipient(scopedMessages, recipient);
      const redactedCount = visibleMessages.filter((m) => (m as RedactedMessage).redacted).length;

      return {
        shareId: share._id,
        sharedAt: share.createdAt,
        sharedBy: sharedByUser
          ? { userId: share.sharedByUserId, fullName: sharedByUser.fullName, email: sharedByUser.email }
          : { userId: share.sharedByUserId },
        /** When true, this share targets a single AI response within the conversation. */
        singleMessage: isSingleMessageShare,
        conversation: {
          _id: group._id,
          title: group.title,
          messages: visibleMessages,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        },
        /** Number of assistant messages hidden from this recipient — useful for showing "X messages hidden" UI hints. */
        redactedMessageCount: redactedCount
      };
    })
  );

  // Filter out stale share records whose source group was deleted
  return results.filter(Boolean);
}

/**
 * Revoke a share. Only the original sharer can revoke.
 */
export async function revokeShare(
  shareId: string,
  requestingUserId: string
): Promise<{ success: true } | ShareError> {
  if (!mongoose.Types.ObjectId.isValid(shareId)) {
    return { success: false, status: 400, error: "Invalid share ID" };
  }

  const share = await SharedConversation.findById(shareId);

  if (!share) {
    return { success: false, status: 404, error: "Share record not found" };
  }

  // Only the original sharer may revoke
  if (share.sharedByUserId.toString() !== requestingUserId) {
    return { success: false, status: 403, error: "You are not authorized to revoke this share" };
  }

  await share.deleteOne();

  logEvent("conversation_share_revoked", {
    userId: requestingUserId,
    businessUnit: share.businessUnit,
    action: "Share Revoked",
    details: `Revoked share ${shareId} from user ${share.sharedWithUserId.toString()}`,
    metadata: {
      shareId,
      conversationGroupId: share.conversationGroupId.toString(),
      revokedFromUserId: share.sharedWithUserId.toString()
    }
  });

  return { success: true };
}
