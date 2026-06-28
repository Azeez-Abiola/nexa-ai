import express, { Response } from "express";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { Conversation } from "../models/Conversation";
import { Policy } from "../models/Policy";
import { RagDocument } from "../models/RagDocument";
import { BusinessUnit } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import {
  adminAuthMiddleware,
  superAdminMiddleware,
  AuthenticatedRequest
} from "../middleware/auth";
import { resolveUserDirectoryBusinessUnit } from "../utils/tenantResolution";
import bcrypt from "bcryptjs";

export const analyticsRouter = express.Router();

analyticsRouter.get("/dashboard", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const canonicalBU =
      !isSuperAdmin && businessUnit ? await resolveUserDirectoryBusinessUnit(req, undefined) : null;
    const effectiveBU = canonicalBU || businessUnit;
    const buFilter = isSuperAdmin ? {} : { businessUnit: effectiveBU };

    const adminScope = isSuperAdmin ? {} : { businessUnit: effectiveBU };

    const [
      totalUsers,
      totalAdmins,
      totalConversations,
      totalPolicies,
      totalTenants,
      totalDocs,
      usersWhoChatted,
      activeAdmins,
      inactiveAdmins
    ] = await Promise.all([
      User.countDocuments(buFilter),
      AdminUser.countDocuments(adminScope),
      Conversation.countDocuments(buFilter),
      Policy.countDocuments(buFilter),
      BusinessUnit.countDocuments(isSuperAdmin ? {} : { name: effectiveBU }),
      RagDocument.countDocuments(buFilter),
      Conversation.countDocuments({
        ...buFilter,
        conversationGroups: {
          $elemMatch: { "messages.0": { $exists: true } }
        }
      }),
      AdminUser.countDocuments({ ...adminScope, isActive: true }),
      AdminUser.countDocuments({ ...adminScope, isActive: false })
    ]);

    res.json({
      totalUsers,
      totalAdmins,
      totalConversations,
      totalPolicies,
      totalTenants,
      totalDocs,
      /** Users with at least one chat message sent or received (not just empty threads). */
      usersWhoChatted,
      /** Admins with account enabled vs disabled (deactivated). */
      activeAdmins,
      inactiveAdmins,
      scope: isSuperAdmin ? "platform" : "businessUnit",
      businessUnit: isSuperAdmin ? null : effectiveBU
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

analyticsRouter.get("/business-units", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;

    let buNames: string[] = [];
    if (isSuperAdmin) {
      const busFromDB = await BusinessUnit.find().select("name").lean();
      buNames = busFromDB.map((bu: any) => bu.name);
    } else if (businessUnit) {
      const canonical = await resolveUserDirectoryBusinessUnit(req, undefined);
      buNames = [canonical || businessUnit];
    } else {
      return res.json({ stats: [] });
    }

    const stats = await Promise.all(
      buNames.map(async (bu: string) => {
        const [userCount, adminCount, policyCount, conversationCount] = await Promise.all([
          User.countDocuments({ businessUnit: bu }),
          AdminUser.countDocuments({ businessUnit: bu }),
          RagDocument.countDocuments({ businessUnit: bu, processingStatus: { $ne: "superseded" } }),
          Conversation.countDocuments({ businessUnit: bu }),
        ]);
        return { name: bu, users: userCount, admins: adminCount, policies: policyCount, conversations: conversationCount };
      })
    );

    res.json({ stats });
  } catch (error) {
    console.error("BU stats error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

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

analyticsRouter.get("/chat-activity", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { startDate, endDate, bu, user } = req.query;

    const query: Record<string, any> = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    } else {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: sevenDaysAgo };
    }

    if (isSuperAdmin) {
      if (bu) query.businessUnit = bu;
    } else {
      query.businessUnit = businessUnit;
    }

    if (user) {
      query.userId = user;
    }

    const dailyActivity = await Conversation.aggregate([
      { $match: query },
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
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

analyticsRouter.get("/top-users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { limit = 5 } = req.query;

    const filter = isSuperAdmin ? {} : { businessUnit };

    const topUsers = await Conversation.aggregate([
      { $match: filter },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          name: "$userDetails.fullName",
          email: "$userDetails.email",
          conversations: "$count"
        }
      }
    ]);

    res.json({ topUsers });
  } catch (error) {
    console.error("Top users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/audit-activity", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { AuditLog } = await import("../models/AuditLog");

    const filter = isSuperAdmin ? {} : { businessUnit };
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);


    const stats = await AuditLog.aggregate([
      { 
        $match: { 
          ...filter,
          createdAt: { $gte: sevenDaysAgo }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formattedStats = stats.map(s => {
      const date = new Date(s._id);
      return {
        day: days[date.getDay()],
        count: s.count,
        date: s._id
      };
    });

    res.json({ auditActivity: formattedStats });
  } catch (error) {
    console.error("Audit activity error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

analyticsRouter.get("/email-domains", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const domains = await BusinessUnitEmailMapping.find().sort({ businessUnit: 1 });
    res.json({ domains });
  } catch (error) {
    console.error("Error fetching email domains:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
