import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = string;

export interface AdminUserDocument extends Document {
  email: string;
  fullName: string;
  businessUnit: BusinessUnit;
  /** Cloudinary URL of the admin's profile picture (avatar). Optional. */
  profilePicture?: string;
  password: string;
  emailVerified: boolean;
  emailVerificationOTP?: string;
  emailVerificationOTPExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  isActive: boolean;
  /** True when the password was auto-generated and the admin must change it on first sign-in. */
  mustChangePassword: boolean;
  /** Bumped on logout/password change to invalidate all previously-issued JWTs. */
  tokenVersion: number;
  /** Hashed (sha256) second-factor login OTP; cleared once verified or expired. */
  loginOTP?: string;
  loginOTPExpiry?: Date;
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
    profilePicture: { type: String, default: null },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    emailVerificationOTP: { type: String, default: null },
    emailVerificationOTPExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    loginOTP: { type: String, default: null },
    loginOTPExpiry: { type: Date, default: null }
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model<AdminUserDocument>("AdminUser", AdminUserSchema);
