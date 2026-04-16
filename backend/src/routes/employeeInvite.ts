import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { EmployeeInvite } from "../models/EmployeeInvite";
import { User } from "../models/User";
import { BusinessUnit as BusinessUnitModel } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import { sendWelcomeEmail } from "../services/emailService";
import { hashInviteToken } from "../utils/inviteToken";

export const employeeInviteRouter = express.Router();

employeeInviteRouter.get("/verify", async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const invite = await EmployeeInvite.findOne({
      token: hashInviteToken(token),
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ error: "Invite link is invalid or has expired" });
    }

    const tenant = await BusinessUnitModel.findOne({ name: invite.businessUnit }).lean();

    res.json({
      valid: true,
      email: invite.email,
      fullName: invite.fullName,
      businessUnit: invite.businessUnit,
      businessUnitLabel: tenant?.label || invite.businessUnit
    });
  } catch (error) {
    console.error("Employee invite verify error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

employeeInviteRouter.post("/accept", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const invite = await EmployeeInvite.findOne({
      token: hashInviteToken(token),
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ error: "Invite link is invalid or has expired" });
    }

    const validBU = await BusinessUnitModel.findOne({ name: invite.businessUnit });
    if (!validBU) {
      return res.status(400).json({ error: "Invalid business unit for this invite" });
    }
    if (validBU.isActive === false) {
      return res.status(403).json({
        error: "This organization is not active yet and is not accepting new accounts."
      });
    }

    const emailDomainMapping = await BusinessUnitEmailMapping.findOne({
      businessUnit: invite.businessUnit
    });
    if (emailDomainMapping) {
      const emailDomain = invite.email.toLowerCase().split("@")[1];
      const expectedDomain = emailDomainMapping.emailDomain.toLowerCase();
      if (!emailDomain || emailDomain !== expectedDomain) {
        return res.status(400).json({
          error: `Invalid email domain for ${invite.businessUnit}. This invite must use @${expectedDomain}.`
        });
      }
    }

    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      invite.status = "accepted";
      await invite.save();
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const user = new User({
      email: invite.email,
      fullName: invite.fullName,
      businessUnit: invite.businessUnit,
      grade: "Analyst",
      password: hashedPassword,
      emailVerified: true
    });

    await user.save();

    invite.status = "accepted";
    await invite.save();

    const tenantInfo = {
      label: validBU.label,
      logo: validBU.logo,
      colorCode: validBU.colorCode,
      slug: validBU.slug
    };
    try {
      await sendWelcomeEmail(user.email, user.fullName, user.businessUnit, tenantInfo, { adminCreated: true });
    } catch (emailErr) {
      console.error("Welcome email failed (employee invite accept):", emailErr);
    }

    res.json({
      message: "Account created successfully. You can now sign in.",
      email: user.email,
      businessUnit: user.businessUnit
    });
  } catch (error) {
    console.error("Employee invite accept error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
