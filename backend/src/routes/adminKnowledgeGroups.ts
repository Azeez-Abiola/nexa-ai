import express, { Response } from "express";
import { Types } from "mongoose";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
import { User } from "../models/User";
import { adminAuthMiddleware, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";
import { resolveUserDirectoryBusinessUnit } from "../utils/tenantResolution";

export const adminKnowledgeGroupsRouter = express.Router();
adminKnowledgeGroupsRouter.use(adminAuthMiddleware);

async function resolveScopedBusinessUnit(
  req: AuthenticatedRequest,
  bodyOrQueryBU?: string
): Promise<string | null> {
  const fromQuery = (req.query.businessUnit as string) || "";
  const scoped = (bodyOrQueryBU ?? fromQuery).trim();
  return resolveUserDirectoryBusinessUnit(req, scoped || undefined);
}

// List groups for a business unit
adminKnowledgeGroupsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bu = await resolveScopedBusinessUnit(req, (req.query.businessUnit as string) || "");
    if (!bu) {
      return res.status(400).json({
        error:
          "businessUnit is required (super admin: pass ?businessUnit= tenant name, label, or slug — not SUPERADMIN)."
      });
    }
    const groups = await KnowledgeGroup.find({ businessUnit: bu })
      .sort({ name: 1 })
      .lean();
    res.json({ groups });
  } catch (err) {
    logger.error("[UserGroups] List error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to list groups" });
  }
});

// Create group
adminKnowledgeGroupsRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    const bu = await resolveScopedBusinessUnit(req, req.body.businessUnit);
    if (!bu) return res.status(400).json({ error: "businessUnit is required" });
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });

    const group = await KnowledgeGroup.create({
      businessUnit: bu,
      name: name.trim(),
      description: (description || "").trim(),
      memberUserIds: [],
      createdByAdminId: req.adminId || "unknown"
    });

    res.status(201).json({ group });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A group with this name already exists for this business unit" });
    }
    logger.error("[UserGroups] Create error", { error: err.message });
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Update name / description
adminKnowledgeGroupsRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, businessUnit } = req.body as {
      name?: string;
      description?: string;
      businessUnit?: string;
    };
    const bu = await resolveScopedBusinessUnit(req, businessUnit);
    if (!bu) return res.status(400).json({ error: "businessUnit is required" });

    const group = await KnowledgeGroup.findOne({ _id: id, businessUnit: bu });
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (name != null) group.name = String(name).trim();
    if (description != null) group.description = String(description).trim();
    await group.save();

    res.json({ group });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A group with this name already exists for this business unit" });
    }
    logger.error("[UserGroups] Patch error", { error: err.message });
    res.status(500).json({ error: "Failed to update group" });
  }
});

// Add or remove a member (employee user)
adminKnowledgeGroupsRouter.post("/:id/members", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, action, businessUnit } = req.body as {
      userId?: string;
      action?: "add" | "remove";
      businessUnit?: string;
    };
    const bu = await resolveScopedBusinessUnit(req, businessUnit);
    if (!bu) return res.status(400).json({ error: "businessUnit is required" });
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }
    if (action !== "add" && action !== "remove") {
      return res.status(400).json({ error: "action must be add or remove" });
    }

    const group = await KnowledgeGroup.findOne({ _id: id, businessUnit: bu });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const user = await User.findById(userId).select("businessUnit").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.businessUnit !== bu) {
      return res.status(400).json({ error: "User is not in this business unit" });
    }

    const oid = new Types.ObjectId(userId);
    if (action === "add") {
      if (!group.memberUserIds.some((x) => x.equals(oid))) {
        group.memberUserIds.push(oid);
      }
    } else {
      group.memberUserIds = group.memberUserIds.filter((x) => !x.equals(oid));
    }
    await group.save();

    res.json({ group });
  } catch (err) {
    logger.error("[UserGroups] Members error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to update members" });
  }
});

// Delete group (documents may still reference ids — admins should clear assignments in UI)
adminKnowledgeGroupsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bu = await resolveScopedBusinessUnit(req, (req.query.businessUnit as string) || "");
    if (!bu) return res.status(400).json({ error: "businessUnit is required" });

    const result = await KnowledgeGroup.deleteOne({ _id: id, businessUnit: bu });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Group not found" });

    res.json({ success: true });
  } catch (err) {
    logger.error("[UserGroups] Delete error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to delete group" });
  }
});
