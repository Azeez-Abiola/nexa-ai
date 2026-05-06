import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IBusinessUnit extends Document {
  tenantId: string;
  name: string;
  label: string;
  slug: string;
  logo?: string;
  /** SHA-256 of the logo file bytes — prevents two tenants from sharing the same logo. */
  logoHash?: string;
  isActive: boolean;
  contactEmail?: string;
  colorCode?: string;
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
    logoHash: {
      type: String,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    contactEmail: {
      type: String,
      trim: true
    },
    colorCode: {
      type: String,
      default: "#ed0000"
    }
  },
  { timestamps: true }
);

export const BusinessUnit = mongoose.model<IBusinessUnit>("BusinessUnit", businessUnitSchema);
