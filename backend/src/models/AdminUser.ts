import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC" | "UACN" | "SUPERADMIN";

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
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<AdminUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    fullName: { type: String, required: true },
    businessUnit: { 
      type: String, 
      enum: ["GCL", "LSF", "CAP", "UFL", "CHI", "UAC-Restaurants", "UPDC", "UACN", "SUPERADMIN"],
      required: true 
    },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationOTP: { type: String, default: null },
    emailVerificationOTPExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null }
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model<AdminUserDocument>("AdminUser", AdminUserSchema);
