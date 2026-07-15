import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = string;

export interface UserDocument extends Document {
  email: string;
  fullName: string;
  businessUnit: BusinessUnit;
  department?: string;
  /** Cloudinary URL of the user's profile picture (avatar). Optional. */
  profilePicture?: string;
  password: string;
  emailVerified: boolean;
  isActive: boolean;
  emailVerificationOTP?: string;
  emailVerificationOTPExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  /** Bumped on logout/password change to invalidate all previously-issued JWTs. */
  tokenVersion: number;
  /** Hashed (sha256) second-factor login OTP; cleared once verified or expired. */
  loginOTP?: string;
  loginOTPExpiry?: Date;
  /** Azure AD object id, bound on first successful Microsoft SSO login. */
  microsoftId?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    fullName: { type: String, required: true },
    businessUnit: { type: String, required: true, index: true, trim: true },
    department: { type: String, trim: true },
    profilePicture: { type: String, default: null },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    emailVerificationOTP: { type: String, default: null },
    emailVerificationOTPExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    loginOTP: { type: String, default: null },
    loginOTPExpiry: { type: Date, default: null },
    microsoftId: { type: String, default: null, index: true, unique: true, sparse: true },
    lastLogin: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model<UserDocument>("User", UserSchema);
