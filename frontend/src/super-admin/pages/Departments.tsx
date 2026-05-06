import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/lib/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
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

interface Department {
  _id: string;
  name: string;
  businessUnit: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  employeeCount?: number;
  documentCount?: number;
}

interface KbDoc {
  _id: string;
  title: string;
  documentType?: string;
  version?: number;
  department?: string;
}

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const Departments: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [allDocs, setAllDocs] = useState<KbDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [docFilter, setDocFilter] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(() => localStorage.getItem("nexa-token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await axios.get("/api/v1/admin/auth/departments", { headers });
      setDepartments(data.departments || []);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not load departments",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }, [token, headers, toast]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Lazy-load the KB doc list only when the create sheet opens, so admins with
  // hundreds of documents don't pay the cost on every page visit.
  useEffect(() => {
    if (!sheetOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setDocsLoading(true);
        const { data } = await axios.get("/api/v1/admin/documents", { headers });
        if (!cancelled) setAllDocs((data.documents || []).filter((d: KbDoc) => !!d._id));
      } catch {
        if (!cancelled) setAllDocs([]);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetOpen, headers]);

  const filteredDocs = useMemo(() => {
    const q = docFilter.trim().toLowerCase();
    if (!q) return allDocs;
    return allDocs.filter((d) => d.title.toLowerCase().includes(q));
  }, [allDocs, docFilter]);

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetCreateState = () => {
    setNewName("");
    setSelectedDocIds(new Set());
    setDocFilter("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      const { data } = await axios.post(
        "/api/v1/admin/auth/departments",
        { name },
        { headers }
      );

      const createdId: string | undefined = data?.department?._id;
      const ids = Array.from(selectedDocIds);
      if (createdId && ids.length > 0) {
        try {
          await axios.patch(
            `/api/v1/admin/auth/departments/${createdId}/documents`,
            { documentIds: ids },
            { headers }
          );
        } catch (err: any) {
          // Department was created; surface the assignment failure separately so
          // the admin still sees the dept appear.
          toast({
            variant: "destructive",
            title: `Created ${name}, but couldn't tag documents`,
            description: err.response?.data?.error || "Try assigning from the department page."
          });
          resetCreateState();
          setSheetOpen(false);
          fetchDepartments();
          return;
        }
      }

      toast({
        title: "Department created",
        description: ids.length > 0
          ? `${name} now exists and ${ids.length} document${ids.length === 1 ? "" : "s"} have been tagged.`
          : `${name} is ready for user assignment.`
      });
      resetCreateState();
      setSheetOpen(false);
      fetchDepartments();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not create department",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await axios.delete(`/api/v1/admin/auth/departments/${deleteTarget._id}`, { headers });
      toast({
        title: "Department deleted",
        description: `${deleteTarget.name} has been removed.`
      });
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not delete department",
        description:
          err.response?.status === 409
            ? err.response.data.error || "Reassign users out of this department before deleting."
            : err.response?.data?.error || "Please try again."
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-6 lg:px-12 py-10 space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)]">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black font-['Sen'] text-slate-900">Departments</h1>
            <p className="text-sm font-medium text-slate-500">
              Group your team into departments. Used when adding or inviting users so document and policy access can
              be tagged by team.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-xl font-bold text-white h-11 px-6 shrink-0"
          style={{ backgroundColor: "var(--brand-color)" }}
        >
          <Plus size={18} className="mr-2" />
          Add department
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-5">
              <Skeleton className="h-5 w-1/3 rounded mb-2" />
              <Skeleton className="h-4 w-1/4 rounded" />
            </Card>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6 text-slate-400">
            <Layers size={28} />
          </div>
          <p className="font-bold text-slate-700 mb-1">No departments yet</p>
          <p className="text-sm font-medium text-slate-500 mb-6">
            Create your first department to start organising users and documents.
          </p>
          <Button
            onClick={() => setSheetOpen(true)}
            className="rounded-xl font-bold text-white h-11 px-6"
            style={{ backgroundColor: "var(--brand-color)" }}
          >
            <Plus size={18} className="mr-2" />
            Add department
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => (
            <Card
              key={dept._id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/departments/${dept._id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/admin/departments/${dept._id}`);
                }
              }}
              className="group border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] shrink-0">
                    <Users size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black font-['Sen'] text-slate-900 truncate" title={dept.name}>
                      {dept.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs font-medium text-slate-400 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} /> {dept.employeeCount ?? 0} {dept.employeeCount === 1 ? "employee" : "employees"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} /> {dept.documentCount ?? 0} {dept.documentCount === 1 ? "document" : "documents"}
                      </span>
                      {dept.createdAt ? (
                        <span>Added {format(new Date(dept.createdAt), "MMM d, yyyy")}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(dept);
                    }}
                    className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete department"
                  >
                    <Trash2 size={18} />
                  </Button>
                  <ChevronRight
                    size={18}
                    className="text-slate-300 group-hover:text-[var(--brand-color)] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o && creating) return;
          setSheetOpen(o);
          if (!o) resetCreateState();
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="text-left space-y-2 px-8 pt-8 pb-4">
            <SheetTitle className="text-2xl font-black font-['Sen']">New department</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              Give the team a name. You can also tag any existing knowledge-base documents to it now — users you add
              to the department later will get a relevance boost on those docs.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Department name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Finance, Operations, HR"
                className={inputBu}
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-slate-700">
                  Tag documents <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                {selectedDocIds.size > 0 ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-color)]">
                    {selectedDocIds.size} selected
                  </span>
                ) : null}
              </div>
              <Input
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                placeholder="Search documents…"
                className={inputBu}
              />
              <div className="rounded-xl border border-slate-200 bg-white max-h-[260px] overflow-y-auto">
                {docsLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 size={18} className="animate-spin text-slate-400 mx-auto" />
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <p className="py-6 px-4 text-xs text-slate-400 text-center font-medium">
                    {allDocs.length === 0
                      ? "No documents in your knowledge base yet."
                      : "No documents match that search."}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredDocs.map((doc) => {
                      const checked = selectedDocIds.has(doc._id);
                      const reassigning = !!doc.department && doc.department.length > 0;
                      return (
                        <li key={doc._id}>
                          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleDoc(doc._id)}
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {doc.title}
                                {typeof doc.version === "number" && doc.version > 1 ? (
                                  <span className="ml-2 text-[10px] font-bold text-slate-400">v{doc.version}</span>
                                ) : null}
                              </p>
                              {reassigning ? (
                                <p className="text-[10px] font-medium text-amber-600 mt-0.5">
                                  Currently tagged: {doc.department}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </form>

          <SheetFooter className="px-8 py-6 border-t border-slate-100 flex-row gap-3 sm:gap-3 bg-slate-50/50">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 rounded-xl font-bold"
              onClick={() => {
                if (creating) return;
                setSheetOpen(false);
                resetCreateState();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex-[2] rounded-xl font-bold text-white h-11"
              style={{ backgroundColor: "var(--brand-color)" }}
            >
              {creating ? <Loader2 className="animate-spin" size={18} /> : "Create department"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              You can't delete a department while users are still assigned to it — reassign or remove those users first.
              This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="animate-spin" size={16} /> : "Delete department"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Departments;
