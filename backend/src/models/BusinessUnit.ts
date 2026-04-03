import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IBusinessUnit extends Document {
  tenantId: string;
  name: string;
  label: string;
  slug: string;
  logo?: string;
  isActive: boolean;
  contactEmail?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const businessUnitSchema = new Schema<IBusinessUnit>(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4()
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens only"]
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    logo: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    contactEmail: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

export const BusinessUnit = mongoose.model<IBusinessUnit>("BusinessUnit", businessUnitSchema);
