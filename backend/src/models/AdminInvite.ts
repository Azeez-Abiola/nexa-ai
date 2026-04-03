import mongoose, { Schema, Document } from "mongoose";

export type InviteStatus = "pending" | "accepted" | "expired";

export interface IAdminInvite extends Document {
  email: string;
  fullName: string;
  businessUnit: string;
  tenantId: string;
  token: string;          // hashed token stored in DB
  status: InviteStatus;
  invitedBy: string;      // SUPERADMIN email
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminInviteSchema = new Schema<IAdminInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    businessUnit: { type: String, required: true },
    tenantId: { type: String, required: true },
    token: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// Index for fast token lookup and auto-expiry queries
AdminInviteSchema.index({ token: 1 });
AdminInviteSchema.index({ email: 1, businessUnit: 1 });
AdminInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const AdminInvite = mongoose.model<IAdminInvite>("AdminInvite", AdminInviteSchema);
