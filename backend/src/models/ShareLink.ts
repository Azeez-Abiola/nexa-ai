import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Tokenised share link for a conversation (or a single AI response within one).
 * Anyone authenticated and in the same business unit as the sharer can open the
 * link and view the conversation — with the same per-source access redaction
 * applied to whatever messages are returned.
 */
export interface ShareLinkDocument extends Document {
  /** URL-safe random token. Indexed unique so lookups are fast. */
  token: string;
  conversationGroupId: Types.ObjectId;
  sharedByUserId: Types.ObjectId;
  businessUnit: string;
  /** When set, the link surfaces only that single AI response + its preceding user question. */
  messageIndex?: number | null;
  createdAt: Date;
}

const ShareLinkSchema = new Schema<ShareLinkDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    conversationGroupId: { type: Schema.Types.ObjectId, required: true },
    sharedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessUnit: { type: String, required: true, trim: true, index: true },
    messageIndex: { type: Number, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Re-using a single token per (group, messageIndex) sender combo means clicking
// "Copy link" twice on the same conversation gives you the same URL — nice UX.
ShareLinkSchema.index(
  { sharedByUserId: 1, conversationGroupId: 1, messageIndex: 1 },
  { unique: true }
);

export const ShareLink = mongoose.model<ShareLinkDocument>("ShareLink", ShareLinkSchema);
