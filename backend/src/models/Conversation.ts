import mongoose, { Schema, Document } from "mongoose";

export interface MessageSource {
  documentId: string;
  title: string;
  documentType: string;
  version?: number;
  url?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Cloudinary URLs for images attached to this message — preserved so follow-up turns can reference them. */
  imageUrls?: string[];
  /** RAG documents cited by this assistant reply — rendered as clickable pills under the message. */
  sources?: MessageSource[];
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

const MessageSourceSchema = new Schema<MessageSource>(
  {
    documentId: { type: String, required: true },
    title: { type: String, required: true },
    documentType: { type: String, required: true },
    version: { type: Number },
    url: { type: String }
  },
  { _id: false }
);

const MessageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    imageUrls: { type: [String], default: undefined },
    sources: { type: [MessageSourceSchema], default: undefined },
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
      index: true,
      trim: true
    },
    conversationGroups: { type: [ConversationGroupSchema], default: [] }
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<UserConversationsDocument>(
  "UserConversations",
  UserConversationsSchema
);
