import { Conversation, ChatMessage, PinnedMessage } from "../models/Conversation";
import { ConversationCollaboration } from "../models/ConversationCollaboration";

async function getCollaborationTargets(sourceGroupId: string): Promise<Map<string, unknown>> {
  const direct = await ConversationCollaboration.find({
    $or: [{ ownerGroupId: sourceGroupId }, { collaboratorGroupId: sourceGroupId }],
  }).lean();

  if (direct.length === 0) return new Map();

  const ownerGroupIds = [...new Set(direct.map((c) => c.ownerGroupId))];
  const cluster = await ConversationCollaboration.find({
    ownerGroupId: { $in: ownerGroupIds },
  }).lean();

  const targets = new Map<string, unknown>();
  for (const c of cluster) {
    targets.set(c.ownerGroupId, c.ownerId);
    targets.set(c.collaboratorGroupId, c.collaboratorId);
  }
  return targets;
}

/**
 * Sync pinned message metadata to every copy in the collaboration cluster.
 */
export async function syncPinnedMessageToCollaborators(
  sourceGroupId: string,
  pinnedMessage: PinnedMessage | null
): Promise<void> {
  try {
    const targets = await getCollaborationTargets(sourceGroupId);
    if (targets.size === 0) return;

    for (const [groupId, userId] of targets) {
      const convs = await Conversation.findOne({ userId });
      if (!convs) continue;
      const group = convs.conversationGroups.find((g) => g._id.toString() === groupId);
      if (!group) continue;
      if (pinnedMessage) {
        (group as any).pinnedMessage = pinnedMessage;
      } else {
        group.set("pinnedMessage", undefined);
      }
      group.updatedAt = new Date();
      convs.markModified("conversationGroups");
      await convs.save();
    }
  } catch (err) {
    console.error("[syncCollaboration] syncPinnedMessage error:", (err as Error).message);
  }
}

/**
 * Sync a reaction change on one message to every copy in the cluster.
 */
export async function syncReactionToCollaborators(
  sourceGroupId: string,
  messageId: string,
  reactions: NonNullable<ChatMessage["reactions"]>
): Promise<void> {
  try {
    const targets = await getCollaborationTargets(sourceGroupId);
    if (targets.size === 0) return;

    for (const [groupId, userId] of targets) {
      const convs = await Conversation.findOne({ userId });
      if (!convs) continue;
      const group = convs.conversationGroups.find((g) => g._id.toString() === groupId);
      if (!group) continue;
      const msg = group.messages.find((m) => m.messageId === messageId);
      if (!msg) continue;
      msg.reactions = reactions.length > 0 ? reactions : undefined;
      group.updatedAt = new Date();
      convs.markModified("conversationGroups");
      await convs.save();
    }
  } catch (err) {
    console.error("[syncCollaboration] syncReaction error:", (err as Error).message);
  }
}

/**
 * After any message save in a collaborative conversation, push the same
 * messages to every *other* participant's copy so the whole group — the
 * owner and all collaborators — sees an up-to-date thread, including the
 * messages people exchange with the AI and the AI's replies.
 *
 * Fire-and-forget — never throws; errors are logged and swallowed.
 */
/**
 * Resolve the full collaboration cluster for a conversation group so callers can scope
 * queries (e.g. session-document retrieval) across every participant, not just the requester.
 *
 * Collaborators each hold their own forked group under their own userId, so a document one
 * person attaches is stored under (theirUserId, theirGroupId). To let the whole group's AI
 * see it, we gather every (userId, groupId) pair in the cluster.
 *
 * For a non-collaborative conversation this returns just the single pair, so behaviour is
 * unchanged. Never throws — on error it falls back to the single pair.
 */
export async function getConversationCluster(
  groupId: string,
  currentUserId: string
): Promise<{ userIds: string[]; sessionIds: string[] }> {
  const userIds = new Set<string>([currentUserId]);
  const sessionIds = new Set<string>([groupId]);
  try {
    const direct = await ConversationCollaboration.find({
      $or: [{ ownerGroupId: groupId }, { collaboratorGroupId: groupId }],
    }).lean();

    if (direct.length > 0) {
      const ownerGroupIds = [...new Set(direct.map((c) => c.ownerGroupId))];
      const cluster = await ConversationCollaboration.find({
        ownerGroupId: { $in: ownerGroupIds },
      }).lean();
      for (const c of cluster) {
        sessionIds.add(c.ownerGroupId);
        sessionIds.add(c.collaboratorGroupId);
        userIds.add(c.ownerId.toString());
        userIds.add(c.collaboratorId.toString());
      }
    }
  } catch (err) {
    console.error("[syncCollaboration] getConversationCluster error:", (err as Error).message);
  }
  return { userIds: [...userIds], sessionIds: [...sessionIds] };
}

/** Canonical room id for ephemeral signals (typing) across a collaboration cluster. */
export async function getCollaborationRoomId(groupId: string): Promise<string | null> {
  try {
    const direct = await ConversationCollaboration.findOne({
      $or: [{ ownerGroupId: groupId }, { collaboratorGroupId: groupId }],
    })
      .select("ownerGroupId")
      .lean();
    return direct?.ownerGroupId ?? null;
  } catch {
    return null;
  }
}

/** True when the user belongs to a multi-participant collaboration cluster. */
export async function isCollaborationParticipant(groupId: string, userId: string): Promise<boolean> {
  const cluster = await getConversationCluster(groupId, userId);
  return cluster.userIds.length > 1 || cluster.sessionIds.length > 1;
}

export async function syncToCollaborators(
  sourceGroupId: string,
  newMessages: Partial<ChatMessage>[]
): Promise<void> {
  try {
    // Find every collaboration record this group participates in (as owner or collaborator).
    const targets = await getCollaborationTargets(sourceGroupId);
    if (targets.size === 0) return;

    // Never echo the message back to the sender's own copy.
    targets.delete(sourceGroupId);

    for (const [groupId, userId] of targets) {
      const convs = await Conversation.findOne({ userId });
      if (!convs) continue;

      const group = convs.conversationGroups.find((g) => g._id.toString() === groupId);
      if (!group) continue;

      for (const msg of newMessages) {
        group.messages.push(msg as ChatMessage);
      }
      group.updatedAt = new Date();
      await convs.save();
    }
  } catch (err) {
    console.error("[syncCollaboration] error:", (err as Error).message);
  }
}
