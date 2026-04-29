import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { AdminUser } from "../models/AdminUser";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Reads credentials from env vars so passwords don't live in tracked source.
// Set these in backend/.env (gitignored):
//   SEED_SUPERADMIN_EMAIL=...
//   SEED_SUPERADMIN_PASSWORD=...
//   SEED_SUPERADMIN_NAME=...   (optional — defaults to "Super Admin")
const EMAIL = process.env.SEED_SUPERADMIN_EMAIL;
const PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD;
const FULL_NAME = process.env.SEED_SUPERADMIN_NAME || "Super Admin";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD must be set in backend/.env"
    );
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (${new URL(uri).hostname})`);

  const normalizedEmail = EMAIL.toLowerCase();
  const existing = await AdminUser.findOne({ email: normalizedEmail });
  if (existing) {
    console.log(`Super admin ${normalizedEmail} already exists — skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcryptjs.hash(PASSWORD, 10);

  await AdminUser.create({
    email: normalizedEmail,
    fullName: FULL_NAME,
    businessUnit: "SUPERADMIN",
    password: hashedPassword,
    emailVerified: true,
    isActive: true,
    mustChangePassword: false
  });

  console.log(`Super admin created: ${normalizedEmail}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
