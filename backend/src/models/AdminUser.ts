import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = string;

export interface AdminUserDocument extends Document {
  email: string;
  fullName: string;
  businessUnit: BusinessUnit;
  password: string;
  emailVerified: boolean;
  emailVerificationOTP?: string;
  emailVerificationOTPExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  isActive: boolean;
  /** True when the password was auto-generated and the admin must change it on first sign-in. */
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<AdminUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    fullName: { type: String, required: true },
    businessUnit: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    emailVerificationOTP: { type: String, default: null },
    emailVerificationOTPExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null }
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model<AdminUserDocument>("AdminUser", AdminUserSchema);
