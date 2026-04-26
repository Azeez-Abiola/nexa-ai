import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = string;

export interface UserDocument extends Document {
  email: string;
  fullName: string;
  businessUnit: BusinessUnit;
  department?: string;
  password: string;
  emailVerified: boolean;
  emailVerificationOTP?: string;
  emailVerificationOTPExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    fullName: { type: String, required: true },
    businessUnit: { type: String, required: true, index: true, trim: true },
    department: { type: String, trim: true },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationOTP: { type: String, default: null },
    emailVerificationOTPExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model<UserDocument>("User", UserSchema);
