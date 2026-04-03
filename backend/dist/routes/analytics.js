"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const AdminUser_1 = require("../models/AdminUser");
const Conversation_1 = require("../models/Conversation");
const Policy_1 = require("../models/Policy");
const BusinessUnit_1 = require("../models/BusinessUnit");
const BusinessUnitEmailMapping_1 = require("../models/BusinessUnitEmailMapping");
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.analyticsRouter = express_1.default.Router();
// Overall dashboard stats — any admin can view
exports.analyticsRouter.get("/dashboard", auth_1.adminAuthMiddleware, async (req, res) => {
    try {
        const { businessUnit, isSuperAdmin } = req;
        const buFilter = isSuperAdmin ? {} : { businessUnit };
        const [totalUsers, totalAdmins, totalConversations, totalPolicies] = await Promise.all([
            User_1.User.countDocuments(buFilter),
            AdminUser_1.AdminUser.countDocuments(isSuperAdmin ? {} : { businessUnit }),
            Conversation_1.Conversation.countDocuments(buFilter),
            Policy_1.Policy.countDocuments(buFilter),
        ]);
        res.json({ totalUsers, totalAdmins, totalConversations, totalPolicies });
    }
    catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Stats by business unit — SUPERADMIN only
exports.analyticsRouter.get("/business-units", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const busFromDB = await BusinessUnit_1.BusinessUnit.find().select("name").lean();
        const buNames = busFromDB.map((bu) => bu.name);
        const stats = await Promise.all(buNames.map(async (bu) => {
            const [userCount, adminCount, policyCount, conversationCount] = await Promise.all([
                User_1.User.countDocuments({ businessUnit: bu }),
                AdminUser_1.AdminUser.countDocuments({ businessUnit: bu }),
                Policy_1.Policy.countDocuments({ businessUnit: bu }),
                Conversation_1.Conversation.countDocuments({ businessUnit: bu }),
            ]);
            return { name: bu, users: userCount, admins: adminCount, policies: policyCount, conversations: conversationCount };
        }));
        res.json({ stats });
    }
    catch (error) {
        console.error("BU stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Popular policies — scoped to BU for non-SUPERADMIN
exports.analyticsRouter.get("/popular-policies", auth_1.adminAuthMiddleware, async (req, res) => {
    try {
        const { businessUnit, isSuperAdmin } = req;
        const limit = parseInt(req.query.limit) || 10;
        const filter = isSuperAdmin ? {} : { businessUnit };
        const policies = await Policy_1.Policy.find(filter, { title: 1, category: 1, businessUnit: 1, createdAt: 1 })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.json({ policies });
    }
    catch (error) {
        console.error("Popular policies error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Chat activity metrics — any admin
exports.analyticsRouter.get("/chat-activity", auth_1.adminAuthMiddleware, async (req, res) => {
    try {
        const { businessUnit, isSuperAdmin } = req;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const matchStage = { createdAt: { $gte: sevenDaysAgo } };
        if (!isSuperAdmin)
            matchStage.businessUnit = businessUnit;
        const dailyActivity = await Conversation_1.Conversation.aggregate([
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
    }
    catch (error) {
        console.error("Chat activity error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Usage by BU — SUPERADMIN only
exports.analyticsRouter.get("/usage-by-bu", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const busFromDB = await BusinessUnit_1.BusinessUnit.find().select("name").lean();
        const buNames = busFromDB.map((bu) => bu.name);
        const usageData = await Promise.all(buNames.map(async (bu) => {
            const users = await User_1.User.countDocuments({ businessUnit: bu });
            return { bu, users };
        }));
        res.json({ usageData });
    }
    catch (error) {
        console.error("Usage by BU error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Reset user password — SUPERADMIN only
exports.analyticsRouter.post("/reset-password", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        if (!userId || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "userId and newPassword (min 6 chars) are required" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        const user = await User_1.User.findByIdAndUpdate(userId, { password: hashedPassword }, { new: true }).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ message: "Password reset successfully", user });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get all business units — any admin
exports.analyticsRouter.get("/business-units-list", auth_1.adminAuthMiddleware, async (_req, res) => {
    try {
        const buses = await BusinessUnit_1.BusinessUnit.find({ isActive: { $ne: false } }).select("name label").sort("name");
        const businessUnits = buses.map((bu) => ({
            name: bu.name,
            label: bu.label,
            _id: bu._id
        }));
        res.json({ businessUnits });
    }
    catch (error) {
        console.error("Get BU list error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Add new business unit — SUPERADMIN only
exports.analyticsRouter.post("/business-units", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { name, label, contactEmail } = req.body;
        if (!name || !label) {
            return res.status(400).json({ error: "Name and label are required" });
        }
        const existingBU = await BusinessUnit_1.BusinessUnit.findOne({ name });
        if (existingBU) {
            return res.status(409).json({ error: "Business unit already exists" });
        }
        const newBU = new BusinessUnit_1.BusinessUnit({ name, label, ...(contactEmail && { contactEmail }) });
        await newBU.save();
        res.status(201).json({ message: "Business unit created", businessUnit: newBU });
    }
    catch (error) {
        console.error("Add BU error:", error);
        if (error.code === 11000) {
            return res.status(409).json({ error: "Business unit name already exists" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
// Update business unit — SUPERADMIN only
exports.analyticsRouter.put("/business-units/:id", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, label } = req.body;
        if (!name || !label) {
            return res.status(400).json({ error: "Name and label are required" });
        }
        const existingBU = await BusinessUnit_1.BusinessUnit.findOne({ name, _id: { $ne: id } });
        if (existingBU) {
            return res.status(409).json({ error: "Business unit name already exists" });
        }
        const { isActive, contactEmail } = req.body;
        const updated = await BusinessUnit_1.BusinessUnit.findByIdAndUpdate(id, { name, label, ...(isActive !== undefined && { isActive }), ...(contactEmail !== undefined && { contactEmail }) }, { new: true });
        if (!updated) {
            return res.status(404).json({ error: "Business unit not found" });
        }
        res.json({ message: "Business unit updated", businessUnit: updated });
    }
    catch (error) {
        console.error("Update BU error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Delete business unit — SUPERADMIN only
exports.analyticsRouter.delete("/business-units/:id", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const [adminCount, userCount] = await Promise.all([
            AdminUser_1.AdminUser.countDocuments({ businessUnit: id }),
            User_1.User.countDocuments({ businessUnit: id }),
        ]);
        if (adminCount > 0 || userCount > 0) {
            return res.status(400).json({
                error: "Cannot delete business unit with assigned users or admins",
                details: { admins: adminCount, users: userCount }
            });
        }
        const deleted = await BusinessUnit_1.BusinessUnit.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: "Business unit not found" });
        }
        res.json({ message: "Business unit deleted", businessUnit: deleted });
    }
    catch (error) {
        console.error("Delete BU error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get all email domain mappings — SUPERADMIN only
exports.analyticsRouter.get("/email-domains", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const domains = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.find().sort({ businessUnit: 1 });
        res.json({ domains });
    }
    catch (error) {
        console.error("Error fetching email domains:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Create or update email domain mapping — SUPERADMIN only
exports.analyticsRouter.post("/email-domain", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { businessUnit, emailDomain } = req.body;
        if (!businessUnit || !emailDomain) {
            return res.status(400).json({ error: "Business unit and email domain are required" });
        }
        const buExists = await BusinessUnit_1.BusinessUnit.findOne({ name: businessUnit });
        if (!buExists) {
            return res.status(400).json({ error: "Business unit does not exist" });
        }
        const mapping = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.findOneAndUpdate({ businessUnit }, { businessUnit, emailDomain: emailDomain.toLowerCase() }, { upsert: true, new: true });
        res.json({ message: "Email domain mapping saved successfully", domain: mapping });
    }
    catch (error) {
        console.error("Error saving email domain:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Delete email domain mapping — SUPERADMIN only
exports.analyticsRouter.delete("/email-domain/:id", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: "Email domain mapping not found" });
        }
        res.json({ message: "Email domain mapping deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting email domain:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
