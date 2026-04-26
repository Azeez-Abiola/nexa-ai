import mongoose, { Schema, Document } from "mongoose";

export interface PolicyDocument extends Document {
  title: string;
  category: string;
  content: string;
  tags: string[];
  businessUnit: string;
  uploadedBy?: {
    adminId: string;
    adminEmail: string;
    adminName?: string;
  };
  sourceFile?: {
    filename: string;
    fileType: "text" | "docx" | "pdf";
    uploadedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PolicySchema = new Schema<PolicyDocument>(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    businessUnit: { type: String, required: true, index: true, trim: true },
    uploadedBy: {
      adminId: String,
      adminEmail: String,
      adminName: String
    },
    sourceFile: {
      filename: String,
      fileType: { type: String, enum: ["text", "docx", "pdf"] },
      uploadedAt: Date
    }
  },
  { timestamps: true }
);

export const Policy = mongoose.model<PolicyDocument>("Policy", PolicySchema);

