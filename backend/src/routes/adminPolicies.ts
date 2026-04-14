import express from "express";
import multer from "multer";
import { Policy } from "../models/Policy";
import { EMPLOYEE_GRADES } from "../models/User";
import { adminAuthMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { extractTextFromDocx } from "../utils/docxParser";
import { extractTextFromPdf } from "../utils/pdfParser";
import { KNOWLEDGE_BASE_CATEGORIES } from "../constants/knowledgeBaseForm";

export const adminPoliciesRouter = express.Router();

const GRADE_SET = new Set<string>(EMPLOYEE_GRADES);

function parseAllowedGrades(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((g: string) => g.trim()).filter(Boolean)
      : [];
  const normalized = list.map((g) => g.trim()).filter(Boolean);
  if (normalized.some((g) => g.toUpperCase() === "ALL")) {
    return ["ALL"];
  }
  return [...new Set(normalized.filter((g) => GRADE_SET.has(g)))];
}

function normalizeCategory(category: string): string | null {
  const trimmed = (category || "").trim();
  if (!trimmed) return null;
  const exact = KNOWLEDGE_BASE_CATEGORIES.find((c) => c === trimmed);
  if (exact) return exact;
  const ci = KNOWLEDGE_BASE_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return ci ?? null;
}

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept .docx, .pdf, and text files
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/plain"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx, .pdf, and .txt files are allowed"));
    }
  }
});

// Protect all admin policy routes: require authenticated admin
adminPoliciesRouter.use(adminAuthMiddleware);

/** Categories and employee grades for knowledge-base forms (fetched by admin UI). */
adminPoliciesRouter.get("/meta/form-options", (_req: AuthenticatedRequest, res) => {
  res.json({
    categories: [...KNOWLEDGE_BASE_CATEGORIES],
    grades: [...EMPLOYEE_GRADES]
  });
});

// List policies: SUPERADMIN sees all, BU admin sees only their BU
adminPoliciesRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { businessUnit, isSuperAdmin } = req;

    if (!businessUnit) {
      return res.status(400).json({ error: "Business unit not found in token" });
    }

    const filter = isSuperAdmin ? {} : { businessUnit };
    const policies = await Policy.find(filter).sort({ createdAt: -1 }).lean();
    res.json(policies);
  } catch (err) {
    console.error("Error listing policies:", err);
    res.status(500).json({ error: "Failed to list policies", details: (err as Error).message });
  }
});

// Create a new policy for the admin's business unit (text or from file)
adminPoliciesRouter.post("/", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, category, content, tags, allowedGrades } = req.body;
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
          policyContent = await extractTextFromDocx(file.buffer);
        } catch (err) {
          console.error("Error extracting text from DOCX:", err);
          return res.status(400).json({ error: "Failed to parse Word document. Make sure it's a valid .docx file." });
        }
        sourceFile = {
          filename: file.originalname,
          fileType: "docx",
          uploadedAt: new Date()
        };
      } else if (file.mimetype === "text/plain") {
        policyContent = file.buffer.toString("utf-8");
        sourceFile = {
          filename: file.originalname,
          fileType: "text",
          uploadedAt: new Date()
        };
      } else if (file.mimetype === "application/pdf") {
        try {
          policyContent = await extractTextFromPdf(file.buffer);
        } catch (err) {
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

    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      return res.status(400).json({
        error: "Invalid category",
        allowedCategories: KNOWLEDGE_BASE_CATEGORIES
      });
    }

    const parsedAllowedGrades = parseAllowedGrades(allowedGrades);

    const policy = await Policy.create({
      title,
      category: normalizedCategory,
      content: policyContent,
      businessUnit: targetBU,
      allowedGrades: parsedAllowedGrades,
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
            .map((t: string) => t.trim())
            .filter(Boolean)
        : []
    });

    res.status(201).json(policy);
  } catch (err) {
    console.error("Error creating policy", err);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

// Update an existing policy
// BU admins can only update their own BU's policies; SUPERADMIN can update any
adminPoliciesRouter.put("/:id", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, category, content, tags, allowedGrades } = req.body;
    const file = req.file;
    const { businessUnit, isSuperAdmin } = req;

    if (!businessUnit) {
      return res.status(400).json({ error: "Business unit not found in token" });
    }

    const existingPolicy = await Policy.findById(id);
    if (!existingPolicy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    if (!isSuperAdmin && existingPolicy.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Unauthorized: Cannot modify policy from another business unit" });
    }

    const updatedAllowedGrades =
      allowedGrades !== undefined ? parseAllowedGrades(allowedGrades) : undefined;

    let policyContent: string | undefined = content;
    let sourceFile: typeof existingPolicy.sourceFile | undefined;

    if (file) {
      if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
          policyContent = await extractTextFromDocx(file.buffer);
        } catch (err) {
          console.error("Error extracting text from DOCX:", err);
          return res.status(400).json({ error: "Failed to parse Word document. Make sure it's a valid .docx file." });
        }
        sourceFile = {
          filename: file.originalname,
          fileType: "docx" as const,
          uploadedAt: new Date()
        };
      } else if (file.mimetype === "text/plain") {
        policyContent = file.buffer.toString("utf-8");
        sourceFile = {
          filename: file.originalname,
          fileType: "text" as const,
          uploadedAt: new Date()
        };
      } else if (file.mimetype === "application/pdf") {
        try {
          policyContent = await extractTextFromPdf(file.buffer);
        } catch (err) {
          console.error("Error extracting text from PDF:", err);
          return res.status(400).json({ error: "Failed to parse PDF document. Make sure it's a valid PDF file." });
        }
        sourceFile = {
          filename: file.originalname,
          fileType: "pdf" as const,
          uploadedAt: new Date()
        };
      }
    }

    if (policyContent === undefined || policyContent === "") {
      return res.status(400).json({ error: "content (or a replace file) is required" });
    }

    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      return res.status(400).json({
        error: "Invalid category",
        allowedCategories: KNOWLEDGE_BASE_CATEGORIES
      });
    }

    const updateData: Record<string, unknown> = {
      title,
      category: normalizedCategory,
      content: policyContent,
      tags: Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : []
    };

    if (updatedAllowedGrades !== undefined) {
      updateData.allowedGrades = updatedAllowedGrades;
    }
    if (sourceFile) {
      updateData.sourceFile = sourceFile;
    }

    const updated = await Policy.findByIdAndUpdate(id, updateData, { new: true });

    res.json(updated);
  } catch (err) {
    console.error("Error updating policy", err);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

// Delete a policy
// BU admins can only delete their own BU's policies; SUPERADMIN can delete any
adminPoliciesRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { businessUnit, isSuperAdmin } = req;

    if (!businessUnit) {
      return res.status(400).json({ error: "Business unit not found in token" });
    }

    const existingPolicy = await Policy.findById(id);
    if (!existingPolicy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    if (!isSuperAdmin && existingPolicy.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Unauthorized: Cannot delete policy from another business unit" });
    }

    await Policy.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting policy", err);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});
