import mongoose, { Schema, Document, Types } from "mongoose";

export interface SharedConversationDocument extends Document {
  conversationGroupId: Types.ObjectId;
  sharedByUserId: Types.ObjectId;
  sharedWithUserId: Types.ObjectId;
  businessUnit: string;
  /** When set, the share is scoped to a single AI response — recipient sees that index plus the preceding user question only. */
  messageIndex?: number;
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
    },
    messageIndex: { type: Number, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate shares of the same conversation/message to the same recipient.
// messageIndex is part of the key so a sender can share the whole group AND specific
// messages from it to the same recipient without colliding.
SharedConversationSchema.index(
  { sharedByUserId: 1, sharedWithUserId: 1, conversationGroupId: 1, messageIndex: 1 },
  { unique: true }
);

export const SharedConversation = mongoose.model<SharedConversationDocument>(
  "SharedConversation",
  SharedConversationSchema
);
