import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { AdminUser } from "../models/AdminUser";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const EMAIL    = "adedamolaijiwole@gmail.com";
const PASSWORD = "Password1234@";
const FULL_NAME = "Adedamola Ijiwole";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const existing = await AdminUser.findOne({ email: EMAIL });
  if (existing) {
    console.log(`Super admin ${EMAIL} already exists — skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcryptjs.hash(PASSWORD, 10);

  await AdminUser.create({
    email: EMAIL,
    fullName: FULL_NAME,
    businessUnit: "SUPERADMIN",
    password: hashedPassword,
    emailVerified: true,
    isActive: true,
  });

  console.log(`Super admin created: ${EMAIL}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
