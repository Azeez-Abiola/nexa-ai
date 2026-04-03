import express, { Response } from "express";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { Conversation } from "../models/Conversation";
import { Policy } from "../models/Policy";
import { BusinessUnit } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import {
  adminAuthMiddleware,
  superAdminMiddleware,
  AuthenticatedRequest
} from "../middleware/auth";
import bcrypt from "bcryptjs";

export const analyticsRouter = express.Router();

// Overall dashboard stats — any admin can view
analyticsRouter.get("/dashboard", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const buFilter = isSuperAdmin ? {} : { businessUnit };

    const [totalUsers, totalAdmins, totalConversations, totalPolicies] = await Promise.all([
      User.countDocuments(buFilter),
      AdminUser.countDocuments(isSuperAdmin ? {} : { businessUnit }),
      Conversation.countDocuments(buFilter),
      Policy.countDocuments(buFilter),
    ]);

    res.json({ totalUsers, totalAdmins, totalConversations, totalPolicies });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stats by business unit — SUPERADMIN only
analyticsRouter.get("/business-units", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const busFromDB = await BusinessUnit.find().select("name").lean();
    const buNames = busFromDB.map((bu: any) => bu.name);

    const stats = await Promise.all(
      buNames.map(async (bu: string) => {
        const [userCount, adminCount, policyCount, conversationCount] = await Promise.all([
          User.countDocuments({ businessUnit: bu }),
          AdminUser.countDocuments({ businessUnit: bu }),
          Policy.countDocuments({ businessUnit: bu }),
          Conversation.countDocuments({ businessUnit: bu }),
        ]);
        return { name: bu, users: userCount, admins: adminCount, policies: policyCount, conversations: conversationCount };
      })
    );

    res.json({ stats });
  } catch (error) {
    console.error("BU stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Popular policies — scoped to BU for non-SUPERADMIN
analyticsRouter.get("/popular-policies", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const limit = parseInt(req.query.limit as string) || 10;
    const filter = isSuperAdmin ? {} : { businessUnit };

    const policies = await Policy.find(filter, { title: 1, category: 1, businessUnit: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ policies });
  } catch (error) {
    console.error("Popular policies error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Chat activity metrics — any admin
analyticsRouter.get("/chat-activity", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const matchStage: Record<string, any> = { createdAt: { $gte: sevenDaysAgo } };
    if (!isSuperAdmin) matchStage.businessUnit = businessUnit;

    const dailyActivity = await Conversation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ dailyActivity });
  } catch (error) {
    console.error("Chat activity error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Usage by BU — SUPERADMIN only
analyticsRouter.get("/usage-by-bu", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const busFromDB = await BusinessUnit.find().select("name").lean();
    const buNames = busFromDB.map((bu: any) => bu.name);

    const usageData = await Promise.all(
      buNames.map(async (bu: string) => {
        const users = await User.countDocuments({ businessUnit: bu });
        return { bu, users };
      })
    );

    res.json({ usageData });
  } catch (error) {
    console.error("Usage by BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset user password — SUPERADMIN only
analyticsRouter.post("/reset-password", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "userId and newPassword (min 6 chars) are required" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Password reset successfully", user });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all business units — any admin
analyticsRouter.get("/business-units-list", adminAuthMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const buses = await BusinessUnit.find({ isActive: { $ne: false } }).select("name label").sort("name");
    const businessUnits = buses.map((bu: any) => ({
      name: bu.name,
      label: bu.label,
      _id: bu._id
    }));
    res.json({ businessUnits });
  } catch (error) {
    console.error("Get BU list error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new business unit — SUPERADMIN only
analyticsRouter.post("/business-units", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, label, contactEmail } = req.body;

    if (!name || !label) {
      return res.status(400).json({ error: "Name and label are required" });
    }

    const existingBU = await BusinessUnit.findOne({ name });
    if (existingBU) {
      return res.status(409).json({ error: "Business unit already exists" });
    }

    const newBU = new BusinessUnit({ name, label, ...(contactEmail && { contactEmail }) });
    await newBU.save();

    res.status(201).json({ message: "Business unit created", businessUnit: newBU });
  } catch (error: any) {
    console.error("Add BU error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Business unit name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update business unit — SUPERADMIN only
analyticsRouter.put("/business-units/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, label } = req.body;

    if (!name || !label) {
      return res.status(400).json({ error: "Name and label are required" });
    }

    const existingBU = await BusinessUnit.findOne({ name, _id: { $ne: id } });
    if (existingBU) {
      return res.status(409).json({ error: "Business unit name already exists" });
    }

    const { isActive, contactEmail } = req.body;
    const updated = await BusinessUnit.findByIdAndUpdate(
      id,
      { name, label, ...(isActive !== undefined && { isActive }), ...(contactEmail !== undefined && { contactEmail }) },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Business unit not found" });
    }

    res.json({ message: "Business unit updated", businessUnit: updated });
  } catch (error) {
    console.error("Update BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete business unit — SUPERADMIN only
analyticsRouter.delete("/business-units/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [adminCount, userCount] = await Promise.all([
      AdminUser.countDocuments({ businessUnit: id }),
      User.countDocuments({ businessUnit: id }),
    ]);

    if (adminCount > 0 || userCount > 0) {
      return res.status(400).json({
        error: "Cannot delete business unit with assigned users or admins",
        details: { admins: adminCount, users: userCount }
      });
    }

    const deleted = await BusinessUnit.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Business unit not found" });
    }

    res.json({ message: "Business unit deleted", businessUnit: deleted });
  } catch (error) {
    console.error("Delete BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all email domain mappings — SUPERADMIN only
analyticsRouter.get("/email-domains", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const domains = await BusinessUnitEmailMapping.find().sort({ businessUnit: 1 });
    res.json({ domains });
  } catch (error) {
    console.error("Error fetching email domains:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create or update email domain mapping — SUPERADMIN only
analyticsRouter.post("/email-domain", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, emailDomain } = req.body;

    if (!businessUnit || !emailDomain) {
      return res.status(400).json({ error: "Business unit and email domain are required" });
    }

    const buExists = await BusinessUnit.findOne({ name: businessUnit });
    if (!buExists) {
      return res.status(400).json({ error: "Business unit does not exist" });
    }

    const mapping = await BusinessUnitEmailMapping.findOneAndUpdate(
      { businessUnit },
      { businessUnit, emailDomain: emailDomain.toLowerCase() },
      { upsert: true, new: true }
    );

    res.json({ message: "Email domain mapping saved successfully", domain: mapping });
  } catch (error) {
    console.error("Error saving email domain:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete email domain mapping — SUPERADMIN only
analyticsRouter.delete("/email-domain/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await BusinessUnitEmailMapping.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Email domain mapping not found" });
    }

    res.json({ message: "Email domain mapping deleted successfully" });
  } catch (error) {
    console.error("Error deleting email domain:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
