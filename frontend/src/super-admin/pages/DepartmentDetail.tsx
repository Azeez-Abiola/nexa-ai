import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Layers,
  Loader2,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
  createdAt?: string;
  updatedAt?: string;
}
interface Employee {
  _id: string;
  fullName: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
}
interface DocRow {
  _id: string;
  title: string;
  documentType?: string;
  version?: number;
  createdAt?: string;
  processingStatus?: string;
}

const DepartmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dept, setDept] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(() => localStorage.getItem("nexa-token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDetail = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/v1/admin/auth/departments/${id}`, { headers });
      setDept(data.department);
      setEmployees(data.employees || []);
      setDocuments(data.documents || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast({
          variant: "destructive",
          title: "Department not found",
          description: "It may have been deleted. Returning to the list."
        });
        navigate("/admin/departments");
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not load department",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }, [id, token, headers, toast, navigate]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDelete = async () => {
    if (!dept) return;
    try {
      setDeleting(true);
      await axios.delete(`/api/v1/admin/auth/departments/${dept._id}`, { headers });
      toast({
        title: "Department deleted",
        description: `${dept.name} has been removed.`
      });
      navigate("/admin/departments");
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
      setDeleteOpen(false);
    }
  };

  if (loading || !dept) {
    return (
      <div className="px-6 lg:px-12 py-10 space-y-8">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-12 py-10 space-y-10">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/departments")}
        className="text-slate-500 hover:text-slate-900 font-bold -ml-2 group"
      >
        <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to departments
      </Button>

      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] shrink-0">
            <Layers size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-black font-['Sen'] text-slate-900 truncate" title={dept.name}>
              {dept.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {employees.length} {employees.length === 1 ? "active employee" : "active employees"}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText size={12} /> {documents.length} {documents.length === 1 ? "document" : "documents"}
              </span>
              {dept.createdAt ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} /> Added {format(new Date(dept.createdAt), "MMM d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="rounded-xl font-bold h-11 px-5 border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-200 shrink-0"
        >
          <Trash2 size={16} className="mr-2" />
          Delete department
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Active employees" value={employees.length} icon={<Users size={18} />} />
        <StatTile label="Documents tagged" value={documents.length} icon={<FileText size={18} />} />
        <StatTile
          label="Last updated"
          value={dept.updatedAt ? format(new Date(dept.updatedAt), "MMM d, yyyy") : "—"}
          icon={<Calendar size={18} />}
        />
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="font-black font-['Sen'] text-slate-900">Employees</p>
            <p className="text-xs font-medium text-slate-400">
              Active users currently assigned to {dept.name}.
            </p>
          </div>
          {employees.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No one assigned yet</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Add or invite users from the Users page and pick {dept.name} as their department.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50">
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-6">
                    Name
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                    Email
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pr-6">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((u) => (
                  <TableRow key={u._id} className="border-slate-50 hover:bg-slate-50/50">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--brand-color)]/10 text-[var(--brand-color)] flex items-center justify-center font-bold">
                          {u.fullName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-bold text-slate-900">{u.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 font-medium">{u.email}</TableCell>
                    <TableCell className="pr-6 text-xs font-medium text-slate-500">
                      {u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="font-black font-['Sen'] text-slate-900">Knowledge base</p>
            <p className="text-xs font-medium text-slate-400">
              Documents tagged with {dept.name}. Employees in this department get a relevance boost on these in chat.
            </p>
          </div>
          {documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No documents tagged yet</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Tag documents from Knowledge Base or while creating the department.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50">
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-6">
                    Title
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                    Type
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                    Version
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                    Status
                  </TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pr-6">
                    Added
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d._id} className="border-slate-50 hover:bg-slate-50/50">
                    <TableCell className="pl-6 py-4">
                      <p className="font-bold text-slate-900 text-sm truncate max-w-[280px]" title={d.title}>
                        {d.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold capitalize">
                        {d.documentType || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        v{d.version ?? 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-xs font-bold text-slate-500">
                      {d.processingStatus || "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-xs font-medium text-slate-500">
                      {d.createdAt ? format(new Date(d.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && !deleting && setDeleteOpen(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">Delete {dept.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              {employees.length > 0
                ? `${employees.length} employee${employees.length === 1 ? " is" : "s are"} currently in this department. Reassign them before deleting.`
                : "This action can't be undone. Documents tagged with this department will keep their tag — re-tag them from Knowledge Base if you want them moved."}
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

const StatTile: React.FC<{ label: string; value: number | string; icon: React.ReactNode }> = ({
  label,
  value,
  icon
}) => (
  <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
    <CardContent className="p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="font-black font-['Sen'] text-slate-900 text-xl mt-0.5">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default DepartmentDetail;
