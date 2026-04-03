import mongoose, { Schema, Document } from "mongoose";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ConversationGroup {
  _id: mongoose.Types.ObjectId;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserConversationsDocument extends Document {
  userId: mongoose.Types.ObjectId;
  businessUnit: string;
  conversationGroups: ConversationGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ConversationGroupSchema = new Schema<ConversationGroup>(
  {
    title: { type: String, default: "New Chat" },
    messages: { type: [MessageSchema], default: [] }
  },
  { timestamps: true }
);

const UserConversationsSchema = new Schema<UserConversationsDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    businessUnit: {
      type: String,
      required: true,
      index: true
    },
    conversationGroups: { type: [ConversationGroupSchema], default: [] }
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<UserConversationsDocument>(
  "UserConversations",
  UserConversationsSchema
);
