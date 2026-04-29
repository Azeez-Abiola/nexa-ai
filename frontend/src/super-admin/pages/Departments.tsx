import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Layers, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/lib/use-toast";
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
}

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const Departments: React.FC = () => {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      await axios.post("/api/v1/admin/auth/departments", { name }, { headers });
      toast({
        title: "Department created",
        description: `${name} is now available for user assignment.`
      });
      setNewName("");
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
      <header className="space-y-3">
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
      </header>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-6">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Finance, Operations, HR"
              className={inputBu}
              maxLength={100}
              required
            />
            <Button
              type="submit"
              disabled={creating}
              className="rounded-xl font-bold text-white h-11 px-6"
              style={{ backgroundColor: "var(--brand-color)" }}
            >
              {creating ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  <Plus size={18} className="mr-2" />
                  Add department
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
          <p className="text-sm font-medium text-slate-500">
            Create your first department above. Users you add or invite later can be assigned to one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => (
            <Card
              key={dept._id}
              className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white"
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
                    {dept.createdAt ? (
                      <p className="text-xs font-medium text-slate-400">
                        Added {format(new Date(dept.createdAt), "MMM d, yyyy")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(dept)}
                  className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete department"
                >
                  <Trash2 size={18} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
