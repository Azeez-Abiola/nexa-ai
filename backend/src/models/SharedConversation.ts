import mongoose, { Schema, Document, Types } from "mongoose";

export interface SharedConversationDocument extends Document {
  conversationGroupId: Types.ObjectId;
  sharedByUserId: Types.ObjectId;
  sharedWithUserId: Types.ObjectId;
  businessUnit: string;
  createdAt: Date;
}

const SharedConversationSchema = new Schema<SharedConversationDocument>(
  {
    conversationGroupId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    sharedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    sharedWithUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    businessUnit: {
      type: String,
      required: true,
      index: true,
      trim: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate shares of the same conversation to the same recipient
SharedConversationSchema.index(
  { sharedByUserId: 1, sharedWithUserId: 1, conversationGroupId: 1 },
  { unique: true }
);

export const SharedConversation = mongoose.model<SharedConversationDocument>(
  "SharedConversation",
  SharedConversationSchema
);
