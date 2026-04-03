import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { FiAlertTriangle, FiSun, FiMoon } from "react-icons/fi";
import { AdminLogin } from "./AdminLogin";
import { AdminHome } from "./AdminHome";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { FAQSection } from "./components/FAQSection";
import LoginLoadingScreen from "./components/LoginLoadingScreen";
import styles from "./styles/admin-dashboard.module.css";

// Create a separate axios instance for admin requests
const adminAxios = axios.create();

interface Document {
  _id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  uploadedBy?: {
    adminId: string;
    adminEmail: string;
    adminName?: string;
  };
  sourceFile?: {
    filename: string;
    fileType: "text" | "docx" | "pdf";
    uploadedAt: string;
  };
}

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  businessUnit: string;
}

const emptyForm: Omit<Document, "_id"> = {
  title: "",
  category: "",
  content: "",
  tags: []
};

interface FileUploadState {
  file: File | null;
  isDragging: boolean;
}

// Smart content analysis for auto-categorization and tagging
const intelligentContentAnalysis = (content: string, hasDefault: boolean = true): { category: string; tags: string[] } => {
  // If content is empty, return empty category
  if (!content.trim()) {
    return { category: "", tags: [] };
  }

  const lowerContent = content.toLowerCase();
  
  // Category mapping based on keywords
  const categoryMap: Record<string, string[]> = {
    "Time Off & Leave": ["leave", "vacation", "holiday", "time off", "days off", "absent", "sick leave", "annual leave", "personal day", "pto", "unpaid leave", "bereavement"],
    "Compensation & Salary": ["salary", "pay", "wage", "compensation", "bonus", "allowance", "payroll", "stipend", "commission", "incentive", "raise", "paycheck"],
    "Benefits": ["benefit", "health", "insurance", "medical", "dental", "pension", "retirement", "401k", "healthcare", "coverage", "wellness", "esa"],
    "Work Schedule & Hours": ["work hours", "working hours", "office hours", "schedule", "shift", "timing", "9 to 5", "flexible hours", "overtime", "flextime", "core hours"],
    "Attendance": ["attendance", "present", "check in", "punctuality", "lateness", "absence", "sign in", "clock in", "tardy"],
    "Remote Work": ["remote", "work from home", "wfh", "home office", "telecommute", "virtual", "hybrid", "distributed"],
    "Code of Conduct": ["conduct", "behavior", "dress code", "ethics", "discipline", "professionalism", "respect", "policy", "professional"],
    "Training & Development": ["training", "development", "course", "certification", "learning", "upskilling", "workshop", "seminar", "mentor", "professional development"],
    "Harassment & Safety": ["harassment", "discrimination", "bullying", "toxic", "respect", "safe", "safety", "abuse", "assault", "hostile", "eeoc"],
    "Performance": ["performance", "review", "evaluation", "appraisal", "rating", "feedback", "assessment", "improvement plan", "competency"]
  };

  // Find matching category
  let matchedCategory = hasDefault ? "General Document" : "";
  let maxMatches = 0;
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    const matches = keywords.filter((kw) => lowerContent.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      matchedCategory = category;
    }
  }

  // Extract tags: key terms from content
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "is", "are", "be", "been", "being", "have", "has", "do", "does", "did", "will", "would",
    "should", "could", "may", "might", "must", "can", "shall", "that", "this", "these", "those",
    "if", "whether", "as", "while", "after", "before", "during", "about", "above", "below",
    "from", "up", "down", "out", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "where", "what", "which", "who", "whom", "whose", "when", "why", "how",
    "employees", "employee", "staff", "company", "should", "shall", "must", "required", "requirement",
    "such", "other", "more", "most", "also", "than", "been", "not", "just", "all", "any",
    "our", "your", "their", "its", "it", "or", "so", "each", "every", "both"
  ]);

  const words = content
    .toLowerCase()
    .match(/\b[a-z]+(?:'[a-z]+)?\b/g) || [];
  
  const wordFreq: Record<string, number> = {};
  words.forEach((word) => {
    if (!stopWords.has(word) && word.length > 2) {  // Lowered from 3 to 2
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  // Extract multi-word phrases (bigrams) for better tags
  const phrases: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    if (!stopWords.has(w1) && !stopWords.has(w2) && w1.length > 2 && w2.length > 2) {
      const phrase = `${w1} ${w2}`;
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }

  // Get top single terms (appearing 1+ times)
  const topTerms = Object.entries(wordFreq)
    .filter(([_, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 12);

  // Get top phrases (appearing 2+ times)
  const topPhrases = Object.entries(phrases)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, 8);

  // Combine category keywords, top terms, and phrases
  const categoryTags = categoryMap[matchedCategory] || [];
  
  // Build comprehensive tag list
  const tagSet = new Set<string>();
  
  // Add all category keywords that appear in content
  categoryTags.forEach(tag => {
    if (lowerContent.includes(tag.toLowerCase())) {
      tagSet.add(tag);
    }
  });
  
  // Add top phrases (these are usually more meaningful)
  topPhrases.forEach(phrase => tagSet.add(phrase));
  
  // Add top individual terms
  topTerms.forEach(term => tagSet.add(term));
  
  // Add category keywords even if not found (up to 4)
  let categoryCount = 0;
  for (const tag of categoryTags) {
    if (categoryCount >= 4) break;
    if (!tagSet.has(tag)) {
      tagSet.add(tag);
      categoryCount++;
    }
  }

  // Convert to array and limit to 25 tags
  const suggestedTags = Array.from(tagSet).slice(0, 25);

  return {
    category: matchedCategory,
    tags: suggestedTags
  };
};

export const Admin: React.FC = () => {
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem("adminToken")
  );
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<Document, "_id">>(emptyForm);
  const [fileUpload, setFileUpload] = useState<FileUploadState>({
    file: null,
    isDragging: false
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdminHome, setShowAdminHome] = useState(() => {
    // Only show landing page if NOT already logged in
    return !localStorage.getItem("adminToken");
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("adminTheme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [isInitializing, setIsInitializing] = useState(!!localStorage.getItem("adminToken"));

  // Memoized loadDocuments function
  const loadDocuments = useCallback(async () => {
    if (!adminToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminAxios.get<Document[]>("/api/v1/admin/policies");
      setDocuments(data);
    } catch (e: any) {
      console.error("Failed to load documents:", e.message);
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
      setIsInitializing(false);
    }
  }, [adminToken]);

  // Set axios admin token and load documents when token changes
  useEffect(() => {
    if (adminToken) {
      adminAxios.defaults.headers.common["Authorization"] = `Bearer ${adminToken}`;
      const storedAdmin = localStorage.getItem("adminUser");
      if (storedAdmin) {
        setAdminUser(JSON.parse(storedAdmin));
      }
      // Load documents after setting the token
      void loadDocuments();
    }
  }, [adminToken, loadDocuments]);

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem("adminTheme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setAdminToken(null);
    setAdminUser(null);
    setIsInitializing(false);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    delete adminAxios.defaults.headers.common["Authorization"];
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "title") {
      // Auto-generate category based on title (without default fallback)
      const { category } = intelligentContentAnalysis(value, false);
      setForm((prev) => ({
        ...prev,
        [name]: value,
        category: category // Auto-update category whenever title changes
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEdit = (document: Document) => {
    setEditingId(document._id);
    setForm({
      title: document.title,
      category: document.category,
      content: document.content,
      tags: document.tags
    });
  };



  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFileUpload({ file: null, isDragging: false });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Validate file type
      if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/pdf" ||
        file.type === "text/plain"
      ) {
        setFileUpload({ file, isDragging: false });
        // Clear content if file is selected
        setForm((prev) => ({ ...prev, content: "" }));
        setError(null);
      } else {
        setError("Please upload a valid .docx, .pdf or .txt file");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setFileUpload((prev) => ({ ...prev, isDragging: true }));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setFileUpload((prev) => ({ ...prev, isDragging: false }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileUpload((prev) => ({ ...prev, isDragging: false }));
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/pdf" ||
        file.type === "text/plain"
      ) {
        setFileUpload({ file, isDragging: false });
        setForm((prev) => ({ ...prev, content: "" }));
        setError(null);
      } else {
        setError("Please upload a valid .docx, .pdf or .txt file");
      }
    }
  };

  const removeFile = () => {
    setFileUpload({ file: null, isDragging: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Validate that we have title and category
      if (!form.title || !form.category) {
        setError("Title and category are required");
        setSaving(false);
        return;
      }

      // Validate that we have either a file or content
      if (!fileUpload.file && !form.content) {
        setError("Please either upload a file or enter content");
        setSaving(false);
        return;
      }

      if (fileUpload.file) {
        // Upload with file
        const formData = new FormData();
        formData.append("title", form.title);
        formData.append("category", form.category);
        formData.append("file", fileUpload.file);
        if (form.tags && form.tags.length > 0) {
          formData.append("tags", form.tags.join(","));
        }

        if (editingId) {
          await adminAxios.put(`/api/v1/admin/policies/${editingId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        } else {
          await adminAxios.post("/api/v1/admin/policies", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        }
      } else {
        // Upload with text content
        const submitForm = { ...form, tags: [] };

        if (editingId) {
          await adminAxios.put(`/api/v1/admin/policies/${editingId}`, submitForm);
        } else {
          await adminAxios.post("/api/v1/admin/policies", submitForm);
        }
      }
      await loadDocuments();
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save document.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await adminAxios.delete(`/api/v1/admin/policies/${id}`);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      setError("Failed to delete document.");
    }
  };

  // Show loading screen while initializing (on page reload when admin is logged in)
  if (isInitializing && adminToken) {
    return <LoginLoadingScreen userType="admin" />;
  }

  // Show admin landing page if not authenticated and hasn't dismissed it
  if (!adminToken && showAdminHome) {
    return (
      <AdminHome
        onEnter={() => setShowAdminHome(false)}
        admin={null}
      />
    );
  }

  // If not authenticated, show AdminLogin component
  if (!adminToken) {
    return (
      <AdminLogin
        onLoginSuccess={(token: string, user: any) => {
          setAdminToken(token);
          setAdminUser(user);
          localStorage.setItem("adminToken", token);
          localStorage.setItem("adminUser", JSON.stringify(user));
          adminAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }}
      />
    );
  }

  // Show admin home page if authenticated and hasn't dismissed it
  if (showAdminHome) {
    return (
      <AdminHome
        onEnter={() => setShowAdminHome(false)}
        admin={adminUser}
      />
    );
  }

  // Authenticated admin panel
  return (
    <div className={`${styles.adminDashboard} ${theme === "light" ? styles.lightTheme : styles.darkTheme}`}>
      {/* Header */}
      <header className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <img
            src="/logo.png"
            alt="Nexa AI Logo"
            className={styles.headerLogo}
          />
          <div className={styles.headerInfo}>
            <h1>Nexa AI Admin</h1>
            <p>Manage company knowledge base</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <>
                <FiSun size={18} />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <FiMoon size={18} />
                <span>Dark Mode</span>
              </>
            )}
          </button>
          {adminUser && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{adminUser.fullName}</span>
              <span className={styles.separator}>|</span>
              <span className={styles.userBU}>{adminUser.businessUnit}</span>
              <span className={styles.separator}>|</span>
              <span className={styles.userEmail}>{adminUser.email}</span>
            </div>
          )}
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.dashboardContent}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>Knowledge Base</h1>
          <p className={styles.contentSubtitle}>
            Upload company documents (Policies, HSE, SOPs, HR documents, Manuals, etc.) for {adminUser?.businessUnit}
          </p>
        </div>

        <div className={styles.dashboardLayout}>
          {/* Form Section */}
          <section className={styles.formSection}>
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>
                {editingId ? "Edit Document" : "Upload File"}
              </h2>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Document Title</label>
                  <input
                    type="text"
                    name="title"
                    className={styles.input}
                    placeholder="e.g., Salary Review Policy, HSE Guidelines, HR Manual"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Document Content</label>
                  <div className={styles.contentInputWrapper}>
                    {/* File Upload Area */}
                    {!fileUpload.file ? (
                      <div
                        className={`${styles.fileUploadArea} ${
                          fileUpload.isDragging ? styles.dragging : ""
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          id="fileInput"
                          className={styles.fileInput}
                          accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                          onChange={handleFileChange}
                          style={{ display: "none" }}
                        />
                        <label htmlFor="fileInput" className={styles.fileUploadLabel}>
                          <div className={styles.uploadIcon}>📄</div>
                          <p className={styles.uploadText}>
                            <strong>Upload Document or Text File</strong>
                          </p>
                          <p className={styles.uploadSubtext}>
                            Drag & drop a .docx, .pdf or .txt file here, or click to browse
                          </p>
                          <p className={styles.uploadHint}>
                            (Max 10MB - Uploaded files are securely processed and stored)
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className={styles.fileSelected}>
                        <div className={styles.selectedFileInfo}>
                          <span className={styles.fileIcon}>✓</span>
                          <div className={styles.fileDetails}>
                            <p className={styles.fileName}>{fileUpload.file.name}</p>
                            <p className={styles.fileSize}>
                              {(fileUpload.file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.clearFileBtn}
                          onClick={removeFile}
                        >
                          ✕ Change File
                        </button>
                      </div>
                    )}

                    {/* Text Content Fallback */}
                    {!fileUpload.file && (
                      <>
                        <div className={styles.divider}>
                          <span>OR</span>
                        </div>
                        <textarea
                          name="content"
                          className={styles.textarea}
                          placeholder="Paste the full document content here instead..."
                          value={form.content}
                          onChange={handleChange}
                          rows={10}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Category</label>
                  <input
                    type="text"
                    name="category"
                    className={styles.input}
                    placeholder="Auto-generated from title"
                    value={form.category}
                    onChange={handleChange}
                    required
                  />
                </div>

                {error && <div className={styles.errorMessage}>{error}</div>}

                <div className={styles.formActions}>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={saving}
                  >
                    {saving
                      ? editingId
                        ? "Saving..."
                        : "Uploading..."
                      : editingId
                      ? "Save Changes"
                      : "Upload Document"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* Documents List Section */}
          <section className={styles.listSection}>
            <h2 className={styles.listHeader}>Uploaded Documents</h2>

            {loading ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateText}>Loading documents…</p>
              </div>
            ) : documents.length === 0 ? (
              <div className={styles.emptyStateWithFAQ}>
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateText}>
                    No documents uploaded yet. Start by uploading your first document!
                  </p>
                </div>
                <FAQSection showTitle={true} />
              </div>
            ) : (
              <div className={styles.documentsList}>
                {documents.map((document) => (
                  <div key={document._id} className={styles.documentCard}>
                    <div className={styles.documentInfo}>
                      <h3 className={styles.documentTitle}>{document.title}</h3>
                      <div>
                        <span className={styles.documentCategory}>
                          {document.category}
                        </span>
                        {document.sourceFile && (
                          <span
                            className={styles.sourceFileBadge}
                            title={`Uploaded from: ${document.sourceFile.filename}`}
                          >
                            📄 {document.sourceFile.fileType === "docx" ? "Word Doc" : document.sourceFile.fileType === "pdf" ? "PDF" : "Text File"}
                          </span>
                        )}
                      </div>
                      {/* Audit Logs Section */}
                      {(document.sourceFile?.uploadedAt || document.uploadedBy) && (
                        <div className={styles.auditLogSection}>
                          {document.sourceFile?.uploadedAt && (
                            <div className={styles.auditLogItem}>
                              <span className={styles.auditLogLabel}>📅 Uploaded:</span>
                              <span className={styles.auditLogValue}>
                                {new Date(document.sourceFile.uploadedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {document.uploadedBy && (
                            <div className={styles.auditLogItem}>
                              <span className={styles.auditLogLabel}>👤 By:</span>
                              <span className={styles.auditLogValue}>
                                {document.uploadedBy.adminName || document.uploadedBy.adminEmail}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.documentActions}>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => handleEdit(document)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(document._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer Card */}
          <div className={styles.footerCard}>
            <p className={styles.footerText}>© 2026 Nexa AI. All rights reserved.</p>
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => setShowPrivacyPolicy(true)}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className={styles.logoutConfirmBackdrop}>
          <div className={styles.logoutConfirmCard}>
            <div className={styles.logoutConfirmIcon}>
              <FiAlertTriangle size={32} />
            </div>
            <h3 className={styles.logoutConfirmTitle}>Sign Out?</h3>
            <p className={styles.logoutConfirmMessage}>
              Are you sure you want to sign out? You'll need to log in again to access the admin panel.
            </p>
            <div className={styles.logoutConfirmActions}>
              <button
                type="button"
                className={styles.logoutConfirmCancel}
                onClick={cancelLogout}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.logoutConfirmConfirm}
                onClick={confirmLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} type="admin" />
      )}
    </div>
  );
};

