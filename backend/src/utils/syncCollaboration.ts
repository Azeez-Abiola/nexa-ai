import { Conversation, ChatMessage } from "../models/Conversation";
import { ConversationCollaboration } from "../models/ConversationCollaboration";

/**
 * After any message save in a collaborative conversation, push the same
 * messages to every partner's copy so both parties see an up-to-date thread.
 *
 * Fire-and-forget — never throws; errors are logged and swallowed.
 */
export async function syncToCollaborators(
  sourceGroupId: string,
  newMessages: Partial<ChatMessage>[]
): Promise<void> {
  try {
    const collabs = await ConversationCollaboration.find({
      $or: [{ ownerGroupId: sourceGroupId }, { collaboratorGroupId: sourceGroupId }],
    }).lean();

    if (collabs.length === 0) return;

    for (const collab of collabs) {
      const isOwnerSide = collab.ownerGroupId === sourceGroupId;
      const partnerId = isOwnerSide ? collab.collaboratorId : collab.ownerId;
      const partnerGroupId = isOwnerSide ? collab.collaboratorGroupId : collab.ownerGroupId;

      const partnerConvs = await Conversation.findOne({ userId: partnerId });
      if (!partnerConvs) continue;

      const partnerGroup = partnerConvs.conversationGroups.find(
        (g) => g._id.toString() === partnerGroupId
      );
      if (!partnerGroup) continue;

      for (const msg of newMessages) {
        partnerGroup.messages.push(msg as ChatMessage);
      }
      partnerGroup.updatedAt = new Date();
      await partnerConvs.save();
    }
  } catch (err) {
    console.error("[syncCollaboration] error:", (err as Error).message);
  }
}
