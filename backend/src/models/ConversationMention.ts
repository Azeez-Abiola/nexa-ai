import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConversationMention extends Document {
  mentionerId: Types.ObjectId;
  mentionedUserId: Types.ObjectId;
  originalConvDocId: Types.ObjectId;
  originalGroupId: string;
  forkedGroupId: string;
  businessUnit: string;
  mentionerName: string;
  conversationTitle: string;
  createdAt: Date;
}

const schema = new Schema<IConversationMention>(
  {
    mentionerId: { type: Schema.Types.ObjectId, required: true },
    mentionedUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    originalConvDocId: { type: Schema.Types.ObjectId, required: true },
    originalGroupId: { type: String, required: true },
    forkedGroupId: { type: String, required: true },
    businessUnit: { type: String, required: true },
    mentionerName: { type: String, required: true },
    conversationTitle: { type: String, default: "Untitled" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ mentionedUserId: 1, createdAt: -1 });

export const ConversationMention = mongoose.model<IConversationMention>(
  "ConversationMention",
  schema
);
