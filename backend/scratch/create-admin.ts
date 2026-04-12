import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { AdminUser } from '../src/models/AdminUser';

// Load env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const createSuperAdmin = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const email = "abiolaazeez@gmail.com";
    const password = "adminpassword123"; // You can change this
    const fullName = "Super Admin";

    const existing = await AdminUser.findOne({ email });
    if (existing) {
      console.log(`Admin with email ${email} already exists. Updating password...`);
      existing.password = await bcryptjs.hash(password, 10);
      existing.emailVerified = true;
      existing.isActive = true;
      await existing.save();
    } else {
      const hashedPassword = await bcryptjs.hash(password, 10);
      const admin = new AdminUser({
        email,
        password: hashedPassword,
        fullName,
        businessUnit: "SUPERADMIN",
        emailVerified: true,
        isActive: true
      });
      await admin.save();
      console.log(`Created new Super Admin: ${email}`);
    }

    console.log("--------------------------------root");
    console.log("Admin Login Details:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("--------------------------------");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

createSuperAdmin();
