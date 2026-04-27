import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationKind =
  | "document_added"
  | "access_request_submitted"
  | "access_request_provisioned"
  | "access_request_rejected"
  | "admin_provisioned";

export type RecipientType = "user" | "admin" | "superadmin";

export interface NotificationDocument extends Document {
  /** ObjectId of the recipient User / AdminUser. For "superadmin" fanout we pick all SUPERADMIN admins. */
  recipientId: Types.ObjectId;
  recipientType: RecipientType;
  /** Tenant scope — "SUPERADMIN" for cross-tenant alerts. */
  businessUnit: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Optional in-app deep link, e.g. "/super-admin/access-requests" or "/user-chat?doc=…". */
  link?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientType: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      required: true
    },
    businessUnit: { type: String, required: true, trim: true, index: true },
    kind: {
      type: String,
      enum: [
        "document_added",
        "access_request_submitted",
        "access_request_provisioned",
        "access_request_rejected",
        "admin_provisioned"
      ],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, read: 1 });

export const Notification = mongoose.model<NotificationDocument>("Notification", NotificationSchema);
