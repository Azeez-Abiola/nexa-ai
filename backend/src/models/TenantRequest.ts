import mongoose, { Schema, Document } from "mongoose";

export interface ITenantRequest extends Document {
  companyName: string;
  workEmail: string;
  phone: string;
  employeeCount: number;
  status: "pending" | "rejected" | "provisioned";
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionNote?: string;
  provisionedTenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tenantRequestSchema = new Schema<ITenantRequest>(
  {
    companyName: { type: String, required: true, trim: true },
    workEmail: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    employeeCount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "rejected", "provisioned"],
      default: "pending"
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    rejectionNote: { type: String, trim: true },
    provisionedTenantId: { type: String }
  },
  { timestamps: true }
);

tenantRequestSchema.index({ workEmail: 1, status: 1 });

export const TenantRequest = mongoose.model<ITenantRequest>("TenantRequest", tenantRequestSchema);
