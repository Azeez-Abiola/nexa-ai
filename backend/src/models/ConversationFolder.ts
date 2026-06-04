import mongoose, { Schema, Document } from "mongoose";

export interface IConversationFolder extends Document {
  userId: mongoose.Types.ObjectId;
  businessUnit: string;
  name: string;
  conversationIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationFolderSchema = new Schema<IConversationFolder>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    businessUnit: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    conversationIds: [{ type: String }],
  },
  { timestamps: true }
);

ConversationFolderSchema.index({ userId: 1 });

export const ConversationFolder = mongoose.model<IConversationFolder>(
  "ConversationFolder",
  ConversationFolderSchema
);
