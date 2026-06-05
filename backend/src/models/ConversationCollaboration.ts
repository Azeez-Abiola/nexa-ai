import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConversationCollaboration extends Document {
  ownerId: Types.ObjectId;
  ownerGroupId: string;
  collaboratorId: Types.ObjectId;
  collaboratorGroupId: string;
  businessUnit: string;
  createdAt: Date;
}

const schema = new Schema<IConversationCollaboration>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerGroupId: { type: String, required: true },
    collaboratorId: { type: Schema.Types.ObjectId, required: true },
    collaboratorGroupId: { type: String, required: true },
    businessUnit: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ ownerGroupId: 1 });
schema.index({ collaboratorGroupId: 1 });

export const ConversationCollaboration = mongoose.model<IConversationCollaboration>(
  "ConversationCollaboration",
  schema
);
