import mongoose, { Schema, Document } from "mongoose";

export type BusinessUnit = "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC" | "UACN";

export type EmployeeGrade =
  | "Executive"
  | "Senior VP"
  | "VP"
  | "Associate"
  | "Senior Analyst"
  | "Analyst";

export const EMPLOYEE_GRADES: EmployeeGrade[] = [
  "Executive",
  "Senior VP",
  "VP",
  "Associate",
  "Senior Analyst",
  "Analyst"
];

export interface UserDocument extends Document {
  email: string;
  fullName: string;
  businessUnit: BusinessUnit;
  grade: EmployeeGrade;
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
    businessUnit: {
      type: String,
      enum: ["GCL", "LSF", "CAP", "UFL", "CHI", "UAC-Restaurants", "UPDC"],
      required: true,
      index: true
    },
    grade: {
      type: String,
      enum: ["Executive", "Senior VP", "VP", "Associate", "Senior Analyst", "Analyst"],
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

export const User = mongoose.model<UserDocument>("User", UserSchema);
