import mongoose, { Schema, Document, Types } from "mongoose";

export interface KnowledgeGroupDocument extends Document {
  businessUnit: string;
  name: string;
  description: string;
  memberUserIds: Types.ObjectId[];
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeGroupSchema = new Schema<KnowledgeGroupDocument>(
  {
    businessUnit: { type: String, required: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    memberUserIds: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    createdByAdminId: { type: String, required: true }
  },
  { timestamps: true }
);

KnowledgeGroupSchema.index({ businessUnit: 1, name: 1 }, { unique: true });
KnowledgeGroupSchema.index({ businessUnit: 1, memberUserIds: 1 });

export const KnowledgeGroup = mongoose.model<KnowledgeGroupDocument>("KnowledgeGroup", KnowledgeGroupSchema);
