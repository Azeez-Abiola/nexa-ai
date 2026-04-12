import mongoose, { Schema, Document } from "mongoose";

export interface IBusinessUnitEmailMapping extends Document {
  businessUnit: string;
  emailDomain: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const businessUnitEmailMappingSchema = new Schema<IBusinessUnitEmailMapping>(
  {
    businessUnit: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    emailDomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    }
  },
  { timestamps: true }
);

export const BusinessUnitEmailMapping = mongoose.model<IBusinessUnitEmailMapping>(
  "BusinessUnitEmailMapping",
  businessUnitEmailMappingSchema
);
