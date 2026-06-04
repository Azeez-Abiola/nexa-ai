import mongoose, { Schema, Document, Types } from "mongoose";

export type AccessRequestStatus = "pending" | "accepted" | "rejected";

export interface IConversationAccessRequest extends Document {
  conversationGroupId: Types.ObjectId;
  requesterId: Types.ObjectId;
  sharerId: Types.ObjectId;
  businessUnit: string;
  conversationTitle: string;
  requesterName: string;
  requesterEmail: string;
  sharerName: string;
  sharerEmail: string;
  acceptToken: string;
  rejectToken: string;
  status: AccessRequestStatus;
  createdAt: Date;
}

const schema = new Schema<IConversationAccessRequest>(
  {
    conversationGroupId: { type: Schema.Types.ObjectId, required: true },
    requesterId: { type: Schema.Types.ObjectId, required: true },
    sharerId: { type: Schema.Types.ObjectId, required: true },
    businessUnit: { type: String, required: true },
    conversationTitle: { type: String, default: "Untitled conversation" },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    sharerName: { type: String, required: true },
    sharerEmail: { type: String, required: true },
    acceptToken: { type: String, required: true, unique: true },
    rejectToken: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ requesterId: 1, conversationGroupId: 1 });

export const ConversationAccessRequest = mongoose.model<IConversationAccessRequest>(
  "ConversationAccessRequest",
  schema
);
