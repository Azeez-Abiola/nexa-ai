import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { FolderTree, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

interface Category {
  _id: string;
  name: string;
  label: string;
  builtin: boolean;
  createdAt?: string;
}

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const Categories: React.FC = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(() => localStorage.getItem("nexa-token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await axios.get("/api/v1/admin/auth/categories", { headers });
      setCategories(data.categories || []);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not load categories",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }, [token, headers, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const builtin = categories.filter((c) => c.builtin);
  const custom = categories.filter((c) => !c.builtin);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    try {
      setCreating(true);
      await axios.post("/api/v1/admin/auth/categories", { label }, { headers });
      toast({
        title: "Category created",
        description: `${label} is now available on document upload.`
      });
      setNewLabel("");
      setSheetOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not create category",
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
      await axios.delete(`/api/v1/admin/auth/categories/${deleteTarget._id}`, { headers });
      toast({
        title: "Category deleted",
        description: `${deleteTarget.label} has been removed.`
      });
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not delete",
        description:
          err.response?.status === 409
            ? err.response.data.error || "Re-tag the documents first, then try again."
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
            <FolderTree size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black font-['Sen'] text-slate-900">Categories</h1>
            <p className="text-sm font-medium text-slate-500">
              Document categories show up on the Knowledge Base upload form. Built-in ones can't be changed; create
              custom categories that match how your team organises documents.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-xl font-bold text-white h-11 px-6 shrink-0"
          style={{ backgroundColor: "var(--brand-color)" }}
        >
          <Plus size={18} className="mr-2" />
          Add category
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-5">
              <Skeleton className="h-5 w-1/3 rounded mb-2" />
              <Skeleton className="h-4 w-1/4 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Section
            title="Built-in"
            description="Universal categories available to every business unit. Read-only."
          >
            {builtin.length === 0 ? null : (
              <div className="space-y-3">
                {builtin.map((c) => (
                  <Row key={c._id} cat={c} />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Custom"
            description="Categories you've created for this business unit."
          >
            {custom.length === 0 ? (
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <FolderTree size={22} />
                </div>
                <p className="font-bold text-slate-700 mb-1">No custom categories yet</p>
                <p className="text-sm font-medium text-slate-500 mb-5">
                  Create one to label uploads with terms that fit your team.
                </p>
                <Button
                  onClick={() => setSheetOpen(true)}
                  className="rounded-xl font-bold text-white h-10 px-5"
                  style={{ backgroundColor: "var(--brand-color)" }}
                >
                  <Plus size={16} className="mr-2" />
                  Add category
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {custom.map((c) => (
                  <Row
                    key={c._id}
                    cat={c}
                    onDelete={() => setDeleteTarget(c)}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o && creating) return;
          setSheetOpen(o);
          if (!o) setNewLabel("");
        }}
      >
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">New category</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              The label is what your team will see on the Knowledge Base upload form. We derive a stable internal name
              from it automatically.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-5 flex-1">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Vendor contracts"
                className={inputBu}
                maxLength={60}
                required
                autoFocus
              />
            </div>

            <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 rounded-xl font-bold"
                onClick={() => {
                  if (creating) return;
                  setSheetOpen(false);
                  setNewLabel("");
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !newLabel.trim()}
                className="flex-[2] rounded-xl font-bold text-white h-11"
                style={{ backgroundColor: "var(--brand-color)" }}
              >
                {creating ? <Loader2 className="animate-spin" size={18} /> : "Create category"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              Delete {deleteTarget?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              This category will be removed from the upload form. Documents already tagged with it must be re-tagged
              first — the API blocks deletion otherwise.
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
              {deleting ? <Loader2 className="animate-spin" size={16} /> : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Section: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
  title,
  description,
  children
}) => (
  <section className="space-y-4">
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="text-sm font-medium text-slate-500">{description}</p>
    </div>
    {children}
  </section>
);

const Row: React.FC<{ cat: Category; onDelete?: () => void }> = ({ cat, onDelete }) => (
  <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
    <CardContent className="p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] shrink-0">
          <FolderTree size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black font-['Sen'] text-slate-900 truncate" title={cat.label}>
              {cat.label}
            </p>
            {cat.builtin ? (
              <Badge className="rounded-md bg-slate-100 text-slate-500 border-none font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
                <Lock size={10} />
                BUILT-IN
              </Badge>
            ) : null}
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5 font-mono">{cat.name}</p>
        </div>
      </div>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
          title="Delete category"
        >
          <Trash2 size={18} />
        </Button>
      ) : null}
    </CardContent>
  </Card>
);

export default Categories;
