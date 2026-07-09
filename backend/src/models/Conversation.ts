import mongoose, { Schema, Document } from "mongoose";
import { encrypt, decrypt } from "../utils/encryption";

export interface MessageSource {
  documentId: string;
  title: string;
  documentType: string;
  version?: number;
  url?: string;
}

export interface GeneratedDocument {
  url: string;
  filename: string;
  documentType: string;
}

export interface MessageReplyTo {
  messageId: string;
  senderName?: string;
  content: string;
}

export interface MessageReaction {
  userId: string;
  userName: string;
  emoji: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Stable id for reply/react/pin in group conversations. */
  messageId?: string;
  /** Quote reference when replying to a specific message. */
  replyTo?: MessageReplyTo;
  /** Emoji reactions from collaborators. */
  reactions?: MessageReaction[];
  /** Cloudinary URLs for images attached to this message — preserved so follow-up turns can reference them. */
  imageUrls?: string[];
  /** RAG documents cited by this assistant reply — rendered as clickable pills under the message. */
  sources?: MessageSource[];
  /** AI-generated file (docx/xlsx/pptx/pdf) attached to this assistant reply. */
  generatedDocument?: GeneratedDocument;
  timestamp: Date;
  /** Set on user messages in collaborative conversations so recipients know who sent what. */
  senderId?: string;
  senderName?: string;
}

export interface PinnedMessage {
  messageId: string;
  content: string;
  senderName?: string;
  pinnedBy?: string;
  pinnedAt?: Date;
}

export interface ConversationGroup {
  _id: mongoose.Types.ObjectId;
  title: string;
  messages: ChatMessage[];
  /** Pinned message shown at the top of a group conversation. */
  pinnedMessage?: PinnedMessage;
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

const GeneratedDocumentSchema = new Schema<GeneratedDocument>(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    documentType: { type: String, required: true }
  },
  { _id: false }
);

const MessageReplyToSchema = new Schema<MessageReplyTo>(
  {
    messageId: { type: String, required: true },
    senderName: { type: String },
    content: { type: String, required: true },
  },
  { _id: false }
);

const MessageReactionSchema = new Schema<MessageReaction>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const MessageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: {
      type: String,
      required: true,
      get: (v: string) => decrypt(v),
      // Idempotent: never re-encrypt content that's already ciphertext. Copy
      // flows (sharing, collaboration sync) can feed encrypted values back in,
      // and double-encryption is what leaked `enc:` to the frontend.
      set: (v: string) => (typeof v === "string" && v.startsWith("enc:") ? v : encrypt(v)),
    },
    messageId: { type: String, default: undefined },
    replyTo: { type: MessageReplyToSchema, default: undefined },
    reactions: { type: [MessageReactionSchema], default: undefined },
    imageUrls: { type: [String], default: undefined },
    sources: { type: [MessageSourceSchema], default: undefined },
    generatedDocument: { type: GeneratedDocumentSchema, default: undefined },
    timestamp: { type: Date, default: Date.now },
    senderId: { type: String, default: undefined },
    senderName: { type: String, default: undefined },
  },
  { _id: false }
);

const PinnedMessageSchema = new Schema<PinnedMessage>(
  {
    messageId: { type: String, required: true },
    content: { type: String, required: true },
    senderName: { type: String },
    pinnedBy: { type: String },
    pinnedAt: { type: Date },
  },
  { _id: false }
);

const ConversationGroupSchema = new Schema<ConversationGroup>(
  {
    title: { type: String, default: "New Chat" },
    messages: { type: [MessageSchema], default: [] },
    pinnedMessage: { type: PinnedMessageSchema, default: undefined },
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
