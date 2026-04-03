"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPoliciesRouter = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const Policy_1 = require("../models/Policy");
const auth_1 = require("../middleware/auth");
const docxParser_1 = require("../utils/docxParser");
const pdfParser_1 = require("../utils/pdfParser");
exports.adminPoliciesRouter = express_1.default.Router();
// Configure multer for file uploads (in-memory storage)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept .docx, .pdf, and text files
        if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimetype === "application/pdf" ||
            file.mimetype === "text/plain") {
            cb(null, true);
        }
        else {
            cb(new Error("Only .docx, .pdf, and .txt files are allowed"));
        }
    }
});
// Protect all admin policy routes: require authenticated admin
exports.adminPoliciesRouter.use(auth_1.adminAuthMiddleware);
// List policies: SUPERADMIN sees all, BU admin sees only their BU
exports.adminPoliciesRouter.get("/", async (req, res) => {
    try {
        const { businessUnit, isSuperAdmin } = req;
        if (!businessUnit) {
            return res.status(400).json({ error: "Business unit not found in token" });
        }
        const filter = isSuperAdmin ? {} : { businessUnit };
        const policies = await Policy_1.Policy.find(filter).sort({ createdAt: -1 }).lean();
        res.json(policies);
    }
    catch (err) {
        console.error("Error listing policies", err);
        res.status(500).json({ error: "Failed to list policies" });
    }
});
// Create a new policy for the admin's business unit (text or from file)
exports.adminPoliciesRouter.post("/", upload.single("file"), async (req, res) => {
    try {
        const { title, category, content, tags } = req.body;
        const businessUnit = req.businessUnit;
        const file = req.file;
        const adminId = req.adminId;
        const adminEmail = req.email;
        const adminName = req.fullName;
        if (!businessUnit) {
            return res.status(400).json({ error: "Business unit not found in token" });
        }
        // SUPERADMIN must supply a target businessUnit in the body
        const targetBU = req.isSuperAdmin
            ? (req.body.businessUnit || businessUnit)
            : businessUnit;
        if (req.isSuperAdmin && !req.body.businessUnit) {
            return res.status(400).json({ error: "SUPERADMIN must specify a businessUnit in the request body" });
        }
        let policyContent = content;
        let sourceFile;
        // If a file was uploaded, extract content from it
        if (file) {
            if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                try {
                    policyContent = await (0, docxParser_1.extractTextFromDocx)(file.buffer);
                }
                catch (err) {
                    console.error("Error extracting text from DOCX:", err);
                    return res.status(400).json({ error: "Failed to parse Word document. Make sure it's a valid .docx file." });
                }
                sourceFile = {
                    filename: file.originalname,
                    fileType: "docx",
                    uploadedAt: new Date()
                };
            }
            else if (file.mimetype === "text/plain") {
                policyContent = file.buffer.toString("utf-8");
                sourceFile = {
                    filename: file.originalname,
                    fileType: "text",
                    uploadedAt: new Date()
                };
            }
            else if (file.mimetype === "application/pdf") {
                try {
                    policyContent = await (0, pdfParser_1.extractTextFromPdf)(file.buffer);
                }
                catch (err) {
                    console.error("Error extracting text from PDF:", err);
                    return res.status(400).json({ error: "Failed to parse PDF document. Make sure it's a valid PDF file." });
                }
                sourceFile = {
                    filename: file.originalname,
                    fileType: "pdf",
                    uploadedAt: new Date()
                };
            }
        }
        if (!title || !category || !policyContent) {
            return res
                .status(400)
                .json({ error: "title, category and content (or file) are required" });
        }
        const policy = await Policy_1.Policy.create({
            title,
            category,
            content: policyContent,
            businessUnit: targetBU,
            uploadedBy: {
                adminId: adminId || "unknown",
                adminEmail: adminEmail || "unknown",
                adminName: adminName || "Unknown User"
            },
            sourceFile: sourceFile,
            tags: Array.isArray(tags)
                ? tags
                : typeof tags === "string"
                    ? tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    : []
        });
        res.status(201).json(policy);
    }
    catch (err) {
        console.error("Error creating policy", err);
        res.status(500).json({ error: "Failed to create policy" });
    }
});
// Update an existing policy
// BU admins can only update their own BU's policies; SUPERADMIN can update any
exports.adminPoliciesRouter.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, content, tags } = req.body;
        const { businessUnit, isSuperAdmin } = req;
        if (!businessUnit) {
            return res.status(400).json({ error: "Business unit not found in token" });
        }
        const existingPolicy = await Policy_1.Policy.findById(id);
        if (!existingPolicy) {
            return res.status(404).json({ error: "Policy not found" });
        }
        if (!isSuperAdmin && existingPolicy.businessUnit !== businessUnit) {
            return res.status(403).json({ error: "Unauthorized: Cannot modify policy from another business unit" });
        }
        const updated = await Policy_1.Policy.findByIdAndUpdate(id, {
            title,
            category,
            content,
            tags: Array.isArray(tags)
                ? tags
                : typeof tags === "string"
                    ? tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    : []
        }, { new: true });
        res.json(updated);
    }
    catch (err) {
        console.error("Error updating policy", err);
        res.status(500).json({ error: "Failed to update policy" });
    }
});
// Delete a policy
// BU admins can only delete their own BU's policies; SUPERADMIN can delete any
exports.adminPoliciesRouter.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { businessUnit, isSuperAdmin } = req;
        if (!businessUnit) {
            return res.status(400).json({ error: "Business unit not found in token" });
        }
        const existingPolicy = await Policy_1.Policy.findById(id);
        if (!existingPolicy) {
            return res.status(404).json({ error: "Policy not found" });
        }
        if (!isSuperAdmin && existingPolicy.businessUnit !== businessUnit) {
            return res.status(403).json({ error: "Unauthorized: Cannot delete policy from another business unit" });
        }
        await Policy_1.Policy.findByIdAndDelete(id);
        res.json({ success: true });
    }
    catch (err) {
        console.error("Error deleting policy", err);
        res.status(500).json({ error: "Failed to delete policy" });
    }
});
