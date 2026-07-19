import mongoose, { Schema, Document } from "mongoose";

// Holds a "request access" submission until the requester proves ownership of workEmail via OTP.
// Nothing here reaches the TenantRequest table (and therefore the admin review queue, or any
// email to the requester/admins) until POST /request-access/verify-otp succeeds. The TTL index
// auto-deletes unverified submissions so abandoned/bogus ones don't pile up.
export interface IPendingAccessRequest extends Document {
  companyName: string;
  workEmail: string;
  phone: string;
  employeeCount: number;
  otp: string;
  otpExpiry: Date;
  createdAt?: Date;
}

const pendingAccessRequestSchema = new Schema<IPendingAccessRequest>(
  {
    companyName: { type: String, required: true, trim: true },
    workEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true },
    employeeCount: { type: Number, required: true, min: 1 },
    otp: { type: String, required: true },
    otpExpiry: { type: Date, required: true }
  },
  { timestamps: true }
);

// Auto-expire 1 hour after otpExpiry, well past the 10-minute OTP window, so a resubmission
// under the same email always has a clean slate rather than colliding with stale documents.
pendingAccessRequestSchema.index({ otpExpiry: 1 }, { expireAfterSeconds: 3600 });

export const PendingAccessRequest = mongoose.model<IPendingAccessRequest>(
  "PendingAccessRequest",
  pendingAccessRequestSchema
);
