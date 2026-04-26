import mongoose, { Schema, Document } from "mongoose";

export type EmployeeInviteStatus = "pending" | "accepted" | "expired";

export interface IEmployeeInvite extends Document {
  email: string;
  fullName: string;
  businessUnit: string;
  tenantId: string;
  department?: string;
  token: string;
  status: EmployeeInviteStatus;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeInviteSchema = new Schema<IEmployeeInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    businessUnit: { type: String, required: true, trim: true },
    tenantId: { type: String, required: true },
    token: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending"
    },
    department: { type: String, trim: true },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

EmployeeInviteSchema.index({ token: 1 });
EmployeeInviteSchema.index({ email: 1, businessUnit: 1, status: 1 });

export const EmployeeInvite = mongoose.model<IEmployeeInvite>("EmployeeInvite", EmployeeInviteSchema);
