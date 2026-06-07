import { Conversation, ChatMessage } from "../models/Conversation";
import { ConversationCollaboration } from "../models/ConversationCollaboration";

/**
 * After any message save in a collaborative conversation, push the same
 * messages to every *other* participant's copy so the whole group — the
 * owner and all collaborators — sees an up-to-date thread, including the
 * messages people exchange with the AI and the AI's replies.
 *
 * Fire-and-forget — never throws; errors are logged and swallowed.
 */
export async function syncToCollaborators(
  sourceGroupId: string,
  newMessages: Partial<ChatMessage>[]
): Promise<void> {
  try {
    // Find every collaboration record this group participates in (as owner or collaborator).
    const direct = await ConversationCollaboration.find({
      $or: [{ ownerGroupId: sourceGroupId }, { collaboratorGroupId: sourceGroupId }],
    }).lean();

    if (direct.length === 0) return;

    // A "cluster" is keyed by the owner group id. Pull the full cluster so a message
    // from one collaborator also reaches the owner AND all other collaborators.
    const ownerGroupIds = [...new Set(direct.map((c) => c.ownerGroupId))];
    const cluster = await ConversationCollaboration.find({
      ownerGroupId: { $in: ownerGroupIds },
    }).lean();

    // Map every participant's group -> their userId (dedup across records).
    const targets = new Map<string, any>();
    for (const c of cluster) {
      targets.set(c.ownerGroupId, c.ownerId);
      targets.set(c.collaboratorGroupId, c.collaboratorId);
    }
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
