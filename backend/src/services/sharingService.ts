import mongoose from "mongoose";
import { User } from "../models/User";
import { Conversation } from "../models/Conversation";
import { SharedConversation } from "../models/SharedConversation";
import { logEvent } from "./auditService";

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
 *  4. Duplicate shares (same sender + recipient + group) are rejected with 409.
 */
export async function shareConversation(
  senderUserId: string,
  senderBusinessUnit: string,
  conversationGroupId: string,
  recipientEmail: string
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

  // 5. Prevent duplicate shares
  const existing = await SharedConversation.findOne({
    sharedByUserId: new mongoose.Types.ObjectId(senderUserId),
    sharedWithUserId: recipient._id,
    conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId)
  });

  if (existing) {
    return {
      success: false,
      status: 409,
      error: "This conversation has already been shared with that user"
    };
  }

  // 6. Create the share record
  const share = await SharedConversation.create({
    conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId),
    sharedByUserId: new mongoose.Types.ObjectId(senderUserId),
    sharedWithUserId: recipient._id,
    businessUnit: senderBusinessUnit
  });

  // 7. Audit log (fire-and-forget — never blocks the response)
  logEvent("conversation_shared", {
    userId: senderUserId,
    businessUnit: senderBusinessUnit,
    metadata: {
      shareId: share._id.toString(),
      conversationGroupId,
      conversationTitle: group.title,
      sharedWithUserId: recipient._id.toString(),
      sharedWithEmail: recipient.email
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
 * Returns enriched objects including the conversation content.
 */
export async function getConversationsSharedWithMe(recipientUserId: string) {
  const shares = await SharedConversation.find({
    sharedWithUserId: new mongoose.Types.ObjectId(recipientUserId)
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

      return {
        shareId: share._id,
        sharedAt: share.createdAt,
        sharedBy: sharedByUser
          ? { userId: share.sharedByUserId, fullName: sharedByUser.fullName, email: sharedByUser.email }
          : { userId: share.sharedByUserId },
        conversation: {
          _id: group._id,
          title: group.title,
          messages: group.messages,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
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
    metadata: {
      shareId,
      conversationGroupId: share.conversationGroupId.toString(),
      revokedFromUserId: share.sharedWithUserId.toString()
    }
  });

  return { success: true };
}
