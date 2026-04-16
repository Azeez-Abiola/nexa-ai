import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Upload,
  X,
  AlertCircle,
  Loader2,
  BookOpen,
  Tags,
  Network,
  FolderOpen,
  Pencil,
  ChevronsUpDown
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { UserGroupRow } from "../components/UserGroupsPanel";

const ALL_GRADES_TOKEN = "ALL";

const EMPLOYEE_GRADE_KEYS = new Set([
  "Executive",
  "Senior VP",
  "VP",
  "Associate",
  "Senior Analyst",
  "Analyst"
]);

const TYPE_LABELS: Record<string, string> = {
  policy: "Policy",
  procedure: "S&OP / procedure",
  handbook: "Handbook",
  contract: "Contract",
  report: "Financial reports",
  other: "Other"
};

const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "report", label: "Financial reports" },
  { value: "procedure", label: "S&OP / operations" },
  { value: "handbook", label: "Handbook" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" }
];

const SENSITIVITY_LEVELS: { value: string; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential" },
  { value: "restricted", label: "Restricted" }
];

function docUsesSpecificGrades(allowed?: string[]): boolean {
  return (allowed ?? []).some((g) => EMPLOYEE_GRADE_KEYS.has(g));
}

export type RagDocumentRow = {
  _id: string;
  title: string;
  businessUnit: string;
  documentType: string;
  sensitivityLevel: string;
  allowedGrades?: string[];
  allowedGroupIds?: string[];
  documentSeriesId?: string;
  version?: number;
  supersedesDocumentId?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  processingError?: string | null;
  totalChunks?: number;
  createdAt: string;
};

/** Pasted policies use a generated filename from the API (no real file upload). */
function isPastedPolicy(doc: RagDocumentRow): boolean {
  const name = (doc.originalFilename || "").toLowerCase();
  return name.startsWith("pasted-content-") && name.endsWith(".txt");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "pending":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

const KnowledgeBase: React.FC = () => {
  const [documents, setDocuments] = useState<RagDocumentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<RagDocumentRow | null>(null);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editGroupsMenuOpen, setEditGroupsMenuOpen] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  /** Pre-fills the upload drawer when the admin picks "Upload new version" from the detail sheet. */
  const [versionUploadParent, setVersionUploadParent] = useState<RagDocumentRow | null>(null);
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [sensitivityLevel, setSensitivityLevel] = useState("internal");
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [documentType, setDocumentType] = useState("policy");
  const [tenantOptions, setTenantOptions] = useState<{ _id: string; name: string; slug: string }[]>([]);
  const [targetBusinessUnit, setTargetBusinessUnit] = useState("");
  const [replacesDocumentId, setReplacesDocumentId] = useState("");
  /** Populated only when the server returns 409 ambiguous_title_match — admin disambiguates from this list. */
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<
    { _id: string; title: string; version: number; originalFilename?: string; createdAt?: string }[] | null
  >(null);
  /** Escape hatch: admin intentionally uploading a same-titled file as an unrelated document. */
  const [forceNewSeries, setForceNewSeries] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupRow[]>([]);
  const [userGroupsMenuOpen, setUserGroupsMenuOpen] = useState(false);
  const [filterTenantSlug, setFilterTenantSlug] = useState("");
  const [filterGroups, setFilterGroups] = useState<UserGroupRow[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "file" | "pasted">("all");
  const [groupFilterId, setGroupFilterId] = useState<string>("all");

  const isSuper = window.location.pathname.startsWith("/super-admin");
  const token = isSuper
    ? localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token")
    : localStorage.getItem("nexa-token");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const effectiveBusinessUnit = useMemo(() => {
    if (isSuper) return targetBusinessUnit || "";
    try {
      const raw = localStorage.getItem("nexa-user");
      if (!raw || raw === "undefined") return "";
      const u = JSON.parse(raw) as { businessUnit?: string };
      return u.businessUnit || "";
    } catch {
      return "";
    }
  }, [isSuper, targetBusinessUnit]);

  const fetchUserGroups = useCallback(async () => {
    if (!effectiveBusinessUnit) {
      setUserGroups([]);
      return;
    }
    try {
      const { data } = await axios.get<{ groups: UserGroupRow[] }>("/api/v1/admin/user-groups", {
        headers,
        params: isSuper ? { businessUnit: effectiveBusinessUnit } : {}
      });
      setUserGroups(data.groups || []);
    } catch {
      setUserGroups([]);
    }
  }, [headers, effectiveBusinessUnit, isSuper]);

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  const loadFilterGroups = useCallback(async () => {
    const bu = isSuper ? filterTenantSlug : effectiveBusinessUnit;
    if (!bu) {
      setFilterGroups([]);
      return;
    }
    try {
      const { data } = await axios.get<{ groups: UserGroupRow[] }>("/api/v1/admin/user-groups", {
        headers,
        params: isSuper ? { businessUnit: bu } : {}
      });
      setFilterGroups(data.groups || []);
    } catch {
      setFilterGroups([]);
    }
  }, [headers, isSuper, filterTenantSlug, effectiveBusinessUnit]);

  useEffect(() => {
    loadFilterGroups();
  }, [loadFilterGroups]);

  useEffect(() => {
    setGroupFilterId("all");
  }, [filterTenantSlug, isSuper]);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get<{ documents: RagDocumentRow[]; total: number }>(
        "/api/v1/admin/documents",
        { headers, params: { limit: 500, page: 1 } }
      );
      setDocuments(data.documents || []);
      setTotalCount(typeof data.total === "number" ? data.total : (data.documents || []).length);
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load RAG documents."
      });
    } finally {
      setIsLoading(false);
    }
  }, [headers, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      try {
        const { data } = await axios.get<{ tenants: { _id: string; name: string; slug: string }[] }>(
          "/api/v1/provisioning/tenants",
          { headers }
        );
        setTenantOptions(data.tenants || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [isSuper, headers]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setContent("");
      if (!title) setTitle(uploadedFile.name.replace(/\.[^/.]+$/, ""));
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!title?.trim() || (!file && !trimmedContent)) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Add a title and either upload a file or paste policy text."
      });
      return;
    }
    if (isSuper && !targetBusinessUnit) {
      toast({
        variant: "destructive",
        title: "Business unit required",
        description: "Select which tenant (business unit) this document belongs to."
      });
      return;
    }
    if (ambiguousCandidates && !replacesDocumentId && !forceNewSeries) {
      toast({
        variant: "destructive",
        title: "Pick which document this updates",
        description: "Choose the existing document this file replaces, or mark it as an unrelated upload."
      });
      return;
    }

    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("documentType", documentType);
      formData.append("sensitivityLevel", sensitivityLevel);
      if (file) {
        formData.append("file", file);
      }
      if (trimmedContent && !file) {
        formData.append("content", trimmedContent);
      }
      formData.append("allowedGrades", ALL_GRADES_TOKEN);
      if (isSuper) {
        formData.append("businessUnit", targetBusinessUnit);
      }
      if (replacesDocumentId) {
        formData.append("replacesDocumentId", replacesDocumentId);
      }
      if (forceNewSeries) {
        formData.append("forceNewSeries", "true");
      }
      if (selectedGroupIds.length > 0) {
        formData.append("allowedGroupIds", selectedGroupIds.join(","));
      }

      const { data } = await axios.post("/api/v1/admin/documents", formData, {
        headers: { ...headers }
      });
      const version = data?.document?.version ?? 1;
      const docTitle = data?.document?.title ?? title.trim();
      const autoLinked = !!data?.autoLinked;
      const description = autoLinked
        ? `Uploaded as v${version} of “${docTitle}”. The previous version is now superseded.`
        : version > 1
        ? `Uploaded as v${version} of “${docTitle}”. Processing runs in the background.`
        : "New document uploaded. Processing runs in the background (chunking & embeddings).";
      toast({ title: "Upload queued", description });
      resetForm();
      setIsDrawerOpen(false);
      fetchDocuments();
    } catch (error: any) {
      if (error?.response?.status === 409 && error.response?.data?.error === "ambiguous_title_match") {
        setAmbiguousCandidates(error.response.data.candidates || []);
        toast({
          title: "Which document does this update?",
          description:
            error.response.data.message ||
            "Multiple existing documents share this title — pick the one this file continues."
        });
        return;
      }
      console.error("Save error:", error);
      const msg = error.response?.data?.error || "Could not upload document.";
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: msg
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await axios.delete(`/api/v1/admin/documents/${docToDelete}`, { headers });
      toast({ title: "Deleted", description: "Document and its index chunks were removed." });
      setDocToDelete(null);
      fetchDocuments();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete document." });
    }
  };

  // Sync the detail sheet's edit state whenever the viewed doc changes.
  useEffect(() => {
    if (!detailDoc) {
      setEditGroupIds([]);
      setEditGroupsMenuOpen(false);
      return;
    }
    setEditGroupIds((detailDoc.allowedGroupIds ?? []).map(String));
  }, [detailDoc?._id]);

  const handleSaveAccess = async () => {
    if (!detailDoc) return;
    try {
      setIsSavingAccess(true);
      const { data } = await axios.patch(
        `/api/v1/admin/documents/${detailDoc._id}/access`,
        { allowedGroupIds: editGroupIds, allowedGrades: detailDoc.allowedGrades ?? ["ALL"] },
        { headers }
      );
      toast({
        title: "Access updated",
        description:
          editGroupIds.length === 0
            ? "This document is now visible to all employees in the business unit."
            : `Restricted to ${editGroupIds.length} user group${editGroupIds.length === 1 ? "" : "s"}.`
      });
      // Reflect new group ids locally so the sheet stays consistent without a round-trip.
      setDetailDoc((prev) =>
        prev && prev._id === detailDoc._id
          ? { ...prev, allowedGroupIds: data?.document?.allowedGroupIds ?? editGroupIds }
          : prev
      );
      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.response?.data?.error || "Could not update access."
      });
    } finally {
      setIsSavingAccess(false);
    }
  };

  /** Pre-fill the upload drawer as "new version of detailDoc" — admin only confirms the file. */
  const handleStartVersionUpload = () => {
    if (!detailDoc) return;
    setVersionUploadParent(detailDoc);
    setTitle(detailDoc.title);
    setDocumentType(detailDoc.documentType);
    setSensitivityLevel(detailDoc.sensitivityLevel);
    setReplacesDocumentId(detailDoc._id);
    setForceNewSeries(false);
    setAmbiguousCandidates(null);
    // Carry existing group restrictions forward so v2 inherits v1's audience by default — visible and editable.
    setSelectedGroupIds((detailDoc.allowedGroupIds ?? []).map(String));
    if (isSuper) setTargetBusinessUnit(detailDoc.businessUnit);
    setDetailDoc(null);
    setIsDrawerOpen(true);
  };

  const handleReprocess = async (id: string) => {
    try {
      setIsReprocessing(true);
      await axios.post(`/api/v1/admin/documents/${id}/reprocess`, {}, { headers });
      toast({ title: "Reprocessing", description: "Document was re-queued for embedding." });
      setDetailDoc(null);
      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reprocess failed",
        description: error.response?.data?.error || "Could not re-queue document."
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setSensitivityLevel("internal");
    setFile(null);
    setContent("");
    setDocumentType("policy");
    setReplacesDocumentId("");
    setAmbiguousCandidates(null);
    setForceNewSeries(false);
    setSelectedGroupIds([]);
    setVersionUploadParent(null);
    if (!isSuper) setTargetBusinessUnit("");
  };

  const policiesInGroupsCount = useMemo(
    () =>
      documents.filter(
        (d) => d.processingStatus !== "superseded" && (d.allowedGroupIds?.length ?? 0) > 0
      ).length,
    [documents]
  );

  const groupNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of [...userGroups, ...filterGroups]) {
      m.set(g._id, g.name);
    }
    return m;
  }, [userGroups, filterGroups]);

  const visibleDocs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return documents.filter((d) => {
      if (isSuper && filterTenantSlug && d.businessUnit !== filterTenantSlug) return false;
      if (sourceFilter === "file" && isPastedPolicy(d)) return false;
      if (sourceFilter === "pasted" && !isPastedPolicy(d)) return false;
      if (groupFilterId !== "all") {
        const ids = d.allowedGroupIds ?? [];
        if (!ids.includes(groupFilterId)) return false;
      }
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.documentType.toLowerCase().includes(q) ||
        (d.originalFilename || "").toLowerCase().includes(q) ||
        (d.businessUnit || "").toLowerCase().includes(q) ||
        String(d.version ?? "").includes(searchQuery.trim()) ||
        (d.allowedGroupIds ?? []).some((id) => (groupNameMap.get(id) || "").toLowerCase().includes(q))
      );
    });
  }, [documents, searchQuery, sourceFilter, groupFilterId, isSuper, filterTenantSlug, groupNameMap]);

  return (
    <div className="min-w-0 max-w-full space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen']">Knowledge Base</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">
            Upload policies, financial reports, S&amp;OP materials, handbooks, contracts, and more (PDF, Office, PPTX, CSV,
            TXT) up to 30MB, or paste text. New versions can replace an existing document; optional user groups restrict
            retrieval to members of those groups.
          </p>
        </div>

        <Sheet
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open);
            if (!open) resetForm();
          }}
        >
          <SheetTrigger asChild>
            <Button
              className="h-12 px-6 rounded-2xl text-white font-bold gap-2 shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: "var(--brand-color)", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <Plus size={20} />
              Add Knowledge material
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full sm:max-w-xl p-0 border-none shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-10 pb-6">
              <SheetHeader className="mb-0">
                <SheetTitle className="text-3xl font-black font-['Sen'] tracking-tight">Upload knowledge base</SheetTitle>
                <p id="knowledge-sheet-description" className="text-slate-500 font-medium mt-2 leading-relaxed">
                  Upload policies, SOPs, company manuals, financial reports, S&amp;OP, and more to train your AI.
                </p>
              </SheetHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  {versionUploadParent ? (
                    <div className="rounded-xl border border-[var(--brand-color)]/30 bg-[var(--brand-color)]/5 p-4 space-y-1">
                      <p className="text-sm font-bold text-slate-900">
                        Uploading new version of “{versionUploadParent.title}”
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        This will become v{(versionUploadParent.version ?? 1) + 1} and supersede the current version.
                        The title is locked; access settings below are pre-filled from the current version — adjust if
                        v{(versionUploadParent.version ?? 1) + 1} should have a different audience.
                      </p>
                    </div>
                  ) : null}

                  {isSuper && (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Business unit (tenant)</Label>
                      <Select value={targetBusinessUnit || undefined} onValueChange={setTargetBusinessUnit}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200">
                          <SelectValue placeholder="Select tenant slug / BU" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenantOptions.map((t) => (
                            <SelectItem key={t._id} value={t.slug}>
                              {t.name} ({t.slug})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400">Super admin must set which BU receives this document.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Title</Label>
                    <Input
                      placeholder="e.g. FY24 Sales playbook"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!!versionUploadParent}
                      className="h-12 rounded-xl border-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[var(--brand-color)] disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>

                  {ambiguousCandidates ? (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">Which document does this update?</p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          More than one existing document shares this title. Pick the one this file continues, or
                          mark it as an unrelated upload.
                        </p>
                      </div>
                      <Select
                        value={replacesDocumentId || "__none__"}
                        onValueChange={(v) => {
                          setReplacesDocumentId(v === "__none__" ? "" : v);
                          if (v && v !== "__none__") setForceNewSeries(false);
                        }}
                        disabled={forceNewSeries}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Choose the existing document this replaces" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose a document…</SelectItem>
                          {ambiguousCandidates.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.title} — v{c.version ?? 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-3 border-t border-amber-200 pt-3">
                        <Checkbox
                          id="kb-force-new-series"
                          checked={forceNewSeries}
                          onCheckedChange={(v) => {
                            const on = v === true;
                            setForceNewSeries(on);
                            if (on) setReplacesDocumentId("");
                          }}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="kb-force-new-series"
                          className="text-xs font-semibold text-slate-700 cursor-pointer leading-relaxed"
                        >
                          This is an unrelated document — upload as a new series (don't supersede any of the above).
                        </label>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      If a document with this title already exists, it will automatically be saved as the next version.
                      You'll only be asked to pick when the match is ambiguous.
                    </p>
                  )}

                  {effectiveBusinessUnit ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-bold text-slate-700">User groups (optional)</Label>
                        {isSuper ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right max-w-[14rem] leading-snug">
                            Managed per tenant (Admin → Users → User groups)
                          </span>
                        ) : (
                          <Link
                            to="/admin/user-groups"
                            className="text-xs font-bold text-[var(--brand-color)] hover:underline shrink-0"
                          >
                            Manage user groups
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 -mt-1">
                        Leave as “all employees” unless this policy should only apply to specific groups. Users can belong
                        to multiple groups.
                      </p>
                      <Popover open={userGroupsMenuOpen} onOpenChange={setUserGroupsMenuOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 justify-between rounded-xl border-slate-200 font-medium text-slate-800"
                          >
                            <span className="truncate text-left">
                              {selectedGroupIds.length === 0
                                ? "All employees (no user group filter)"
                                : `${selectedGroupIds.length} user group${selectedGroupIds.length === 1 ? "" : "s"} selected`}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,28rem)]" align="start">
                          <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                            {userGroups.length === 0 ? (
                              <p className="text-xs text-slate-500 p-3 leading-relaxed">
                                {isSuper ? (
                                  <>
                                    No user groups for this unit yet. Tenant administrators create them under{" "}
                                    <span className="font-bold text-slate-700">Admin → Users → User groups</span>.
                                  </>
                                ) : (
                                  <>
                                    No user groups for this unit yet. Open{" "}
                                    <Link
                                      to="/admin/user-groups"
                                      className="font-bold text-[var(--brand-color)] hover:underline"
                                      onClick={() => setUserGroupsMenuOpen(false)}
                                    >
                                      User groups
                                    </Link>{" "}
                                    to create one.
                                  </>
                                )}
                              </p>
                            ) : (
                              userGroups.map((g) => {
                                const checked = selectedGroupIds.includes(g._id);
                                return (
                                  <button
                                    key={g._id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedGroupIds((prev) =>
                                        checked ? prev.filter((id) => id !== g._id) : [...prev, g._id]
                                      )
                                    }
                                    className={cn(
                                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                      checked
                                        ? "bg-[var(--brand-color)]/10 font-semibold text-slate-900"
                                        : "hover:bg-slate-50 text-slate-700"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                                        checked
                                          ? "border-[var(--brand-color)] bg-[var(--brand-color)] text-white"
                                          : "border-slate-300 bg-white"
                                      )}
                                    >
                                      {checked ? "✓" : ""}
                                    </span>
                                    <span className="truncate">{g.name}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Category</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400 font-medium">
                      Policies, financial reports, S&amp;OP, and other materials. Access is refined with user groups below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Sensitivity</Label>
                    <Select value={sensitivityLevel} onValueChange={setSensitivityLevel}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SENSITIVITY_LEVELS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-700">File or pasted text</Label>
                    {!file ? (
                      <div className="relative group cursor-pointer">
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
                          onChange={handleFileUpload}
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 hover:border-[var(--brand-color)]/20 transition-all"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Upload size={22} />
                          </div>
                          <p className="text-sm font-bold text-slate-600">Browse file</p>
                          <p className="text-xs text-slate-400 mt-1 text-center">
                            PDF, DOCX, XLSX, PPTX, TXT, CSV — up to 30MB (server limit)
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--brand-color)]">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{file.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFile(null)}
                          className="rounded-full hover:bg-white text-slate-400 hover:text-[var(--brand-color)]"
                        >
                          <X size={18} />
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="policy-paste" className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Or paste policy text
                      </Label>
                      <Textarea
                        id="policy-paste"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={!!file}
                        placeholder={
                          file
                            ? "Remove the file above to paste text instead."
                            : "Paste the full policy text here if you are not uploading a file."
                        }
                        rows={8}
                        className={cn(
                          "rounded-xl border-2 border-slate-200 bg-white text-sm min-h-[160px]",
                          "focus-visible:ring-2 focus-visible:ring-[var(--brand-color)]/30 disabled:opacity-60"
                        )}
                      />
                    </div>
                  </div>
                </div>

                <SheetFooter className="pt-6">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full h-14 rounded-2xl text-white font-bold text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "var(--brand-color)" }}
                  >
                    {isSaving ? (
                      <div className="flex items-center gap-3">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Uploading…</span>
                      </div>
                    ) : (
                      <span>Upload &amp; queue processing</span>
                    )}
                  </Button>
                </SheetFooter>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard icon={BookOpen} label="Total policies" value={String(totalCount)} color="rose" />
        <StatsCard
          icon={Tags}
          label="Policy types"
          value={String(new Set(documents.map((d) => d.documentType)).size)}
          color="blue"
        />
        <StatsCard
          icon={Network}
          label="Policies in user groups"
          value={String(policiesInGroupsCount)}
          color="violet"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col gap-4 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold font-['Sen']">Knowledge Repository</h2>
            <div className="relative w-full md:w-80 group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-colors"
                size={18}
              />
              <Input
                placeholder="Search by title, type, file, BU, group…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-11 rounded-xl bg-white border-slate-100 focus:ring-rose-50"
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col flex-wrap gap-3 lg:flex-row lg:items-center">
            {isSuper && (
              <div className="flex min-w-0 w-full flex-col gap-1 lg:w-auto lg:max-w-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tenant (filters)</span>
                <Select
                  value={filterTenantSlug || "__all__"}
                  onValueChange={(v) => setFilterTenantSlug(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-semibold">
                    <SelectValue placeholder="All tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All tenants</SelectItem>
                    {tenantOptions.map((t) => (
                      <SelectItem key={t._id} value={t.slug}>
                        {t.name} ({t.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400 font-medium leading-snug">
                  Pick a tenant to load user groups for the group filter.
                </p>
              </div>
            )}
            <div className="flex min-w-0 w-full flex-col gap-1 sm:min-w-[10rem] lg:w-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</span>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as "all" | "file" | "pasted")}>
                <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="file">File upload</SelectItem>
                  <SelectItem value="pasted">Pasted text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 w-full flex-1 flex-col gap-1 lg:max-w-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User group</span>
              <Select
                value={groupFilterId}
                onValueChange={setGroupFilterId}
                disabled={isSuper ? !filterTenantSlug : !effectiveBusinessUnit}
              >
                <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-semibold">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {(isSuper ? filterGroups : userGroups).map((g) => (
                    <SelectItem key={g._id} value={g._id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSuper && !filterTenantSlug ? (
                <p className="text-[11px] text-slate-400 font-medium">Select a tenant to enable group filter.</p>
              ) : null}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="h-6 flex-1 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4">
              <FolderOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-['Sen']">
              {documents.length === 0 ? "Empty Repository" : "No matching policies"}
            </h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">
              {documents.length === 0
                ? "No materials found. Start adding policies to train your business unit AI."
                : "Try clearing search or filters, or adjust tenant, source, or user group."}
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-50">
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8 min-w-[280px]">
                  Title
                </TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Ver</TableHead>
                {isSuper && (
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">BU</TableHead>
                )}
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Type</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Source</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">User groups</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                  Sensitivity
                </TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Grades</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">File</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Created</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDocs.map((doc) => (
                <TableRow
                  key={doc._id}
                  className="group hover:bg-slate-50/50 transition-colors border-slate-50 cursor-pointer"
                  onClick={() => setDetailDoc(doc)}
                >
                  <TableCell className="pl-8 py-5 min-w-[280px]">
                    <div className="flex items-center gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[var(--brand-color)] transition-all">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm leading-tight mb-1 truncate" title={doc.title}>
                          {doc.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {doc.totalChunks != null ? `${doc.totalChunks} chunks` : "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      v{doc.version ?? 1}
                    </Badge>
                  </TableCell>
                  {isSuper && (
                    <TableCell>
                      <span className="text-xs font-bold text-slate-600">{doc.businessUnit}</span>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold capitalize">
                      {TYPE_LABELS[doc.documentType] || doc.documentType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-bold border-0",
                        isPastedPolicy(doc)
                          ? "bg-violet-50 text-violet-800"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {isPastedPolicy(doc) ? "Pasted" : "File"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(doc.allowedGroupIds ?? []).length === 0 ? (
                      <span className="text-xs font-bold text-slate-400">All employees</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(doc.allowedGroupIds ?? []).map((gid) => (
                          <Badge
                            key={gid}
                            variant="outline"
                            className="text-[10px] font-bold rounded-md px-2 py-0.5 border-slate-200 text-slate-700"
                            title={gid}
                          >
                            {groupNameMap.get(gid) || `Group ${gid.slice(-6)}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-600 capitalize">{doc.sensitivityLevel}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] font-bold border-0 capitalize", statusBadgeClass(doc.processingStatus))}>
                      {doc.processingStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!docUsesSpecificGrades(doc.allowedGrades) ? (
                      <span className="text-xs font-bold text-[var(--brand-color)]">All users</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {(doc.allowedGrades ?? [])
                          .filter((g) => EMPLOYEE_GRADE_KEYS.has(g))
                          .map((g) => (
                            <Badge
                              key={g}
                              variant="secondary"
                              className="text-[10px] font-bold rounded-md px-2 py-0.5 bg-[var(--brand-color)]/10 text-[var(--brand-color)] border-0"
                            >
                              {g}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-slate-600 truncate max-w-[140px] block" title={doc.originalFilename}>
                      {doc.originalFilename}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-bold text-slate-500">
                      {doc.createdAt ? format(new Date(doc.createdAt), "MMM d, yyyy") : "—"}
                    </p>
                  </TableCell>
                  <TableCell className="pr-8">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit access, upload new version, reprocess"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailDoc(doc);
                        }}
                        className="h-9 w-9 rounded-xl hover:bg-white hover:text-[var(--brand-color)]"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete document"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocToDelete(doc._id);
                        }}
                        className="h-9 w-9 rounded-xl hover:bg-white hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[var(--brand-color)] mb-4 border border-slate-100">
              <AlertCircle size={24} />
            </div>
            <AlertDialogTitle className="text-xl font-bold font-['Sen']">Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-slate-500">
              Removes the file from storage and deletes all embedding chunks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="bg-slate-50 border-none rounded-xl h-12 font-bold text-slate-500">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[var(--brand-color)] hover:opacity-90 rounded-xl h-12 font-bold transition-all"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!detailDoc} onOpenChange={(open) => !open && setDetailDoc(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8 max-w-xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold font-['Sen']">{detailDoc?.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left text-slate-600 space-y-2 text-sm font-medium">
                <p>
                  <span className="text-slate-400">Status:</span>{" "}
                  <span className="capitalize font-bold">{detailDoc?.processingStatus}</span>
                </p>
                <p>
                  <span className="text-slate-400">Type:</span>{" "}
                  {detailDoc && (TYPE_LABELS[detailDoc.documentType] || detailDoc.documentType)}
                </p>
                <p>
                  <span className="text-slate-400">Sensitivity:</span>{" "}
                  <span className="capitalize">{detailDoc?.sensitivityLevel}</span>
                </p>
                <p>
                  <span className="text-slate-400">Version:</span> v{detailDoc?.version ?? 1}
                </p>
                <p>
                  <span className="text-slate-400">File:</span> {detailDoc?.originalFilename}
                </p>
                <p>
                  <span className="text-slate-400">Size:</span>{" "}
                  {detailDoc ? `${(detailDoc.fileSize / 1024).toFixed(1)} KB` : ""}
                </p>
                {detailDoc?.processingError ? (
                  <p className="text-red-600 text-xs font-semibold">Error: {detailDoc.processingError}</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {detailDoc ? (
            <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-bold text-slate-700">Who can see this document</Label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {editGroupIds.length === 0 ? "All employees" : `${editGroupIds.length} group(s)`}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Leave empty to let all employees in this business unit access the document. Pick one or more user
                groups to restrict retrieval to their members.
              </p>
              <Popover open={editGroupsMenuOpen} onOpenChange={setEditGroupsMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 justify-between rounded-xl border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <span className="truncate text-left">
                      {editGroupIds.length === 0
                        ? "All employees (no user group filter)"
                        : `${editGroupIds.length} user group${editGroupIds.length === 1 ? "" : "s"} selected`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                    {userGroups.length === 0 ? (
                      <p className="text-xs text-slate-500 p-3 leading-relaxed">
                        No user groups for this business unit yet.
                      </p>
                    ) : (
                      userGroups.map((g) => {
                        const checked = editGroupIds.includes(g._id);
                        return (
                          <button
                            key={g._id}
                            type="button"
                            onClick={() =>
                              setEditGroupIds((prev) =>
                                checked ? prev.filter((id) => id !== g._id) : [...prev, g._id]
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                              checked
                                ? "bg-[var(--brand-color)]/10 font-semibold text-slate-900"
                                : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                                checked
                                  ? "border-[var(--brand-color)] bg-[var(--brand-color)] text-white"
                                  : "border-slate-300 bg-white"
                              )}
                            >
                              {checked ? "✓" : ""}
                            </span>
                            <span className="truncate">{g.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                onClick={handleSaveAccess}
                disabled={isSavingAccess}
                className="h-10 w-full rounded-xl bg-[var(--brand-color)] text-white hover:bg-[var(--brand-color)]/90 font-bold"
              >
                {isSavingAccess ? <Loader2 className="animate-spin w-4 h-4" /> : "Save access"}
              </Button>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
            <Button type="button" variant="outline" className="rounded-xl h-11 font-bold" onClick={() => setDetailDoc(null)}>
              Close
            </Button>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 font-bold"
                disabled={isReprocessing || !detailDoc}
                onClick={() => detailDoc && handleReprocess(detailDoc._id)}
              >
                {isReprocessing ? <Loader2 className="animate-spin w-4 h-4" /> : "Reprocess"}
              </Button>
              <Button
                type="button"
                className="rounded-xl h-11 font-bold bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleStartVersionUpload}
              >
                Upload new version
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatsCard = ({ icon: Icon, label, value, color, description }: any) => {
  const colors = {
    rose: "bg-white text-[var(--brand-color)] ring-slate-100 border border-slate-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center ring-1",
          colors[color as keyof typeof colors]
        )}
      >
        <Icon size={26} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900 font-['Sen'] leading-none">{value}</p>
          {description && (
            <span className="text-[10px] font-bold text-emerald-500 leading-none">{description}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
