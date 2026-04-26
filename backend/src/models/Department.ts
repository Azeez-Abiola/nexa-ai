import mongoose, { Schema, Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  businessUnit: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true },
    businessUnit: { type: String, required: true, trim: true },
    tenantId: { type: String, required: true }
  },
  { timestamps: true }
);

DepartmentSchema.index({ name: 1, businessUnit: 1 }, { unique: true });

export const Department = mongoose.model<IDepartment>("Department", DepartmentSchema);
