import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Layers,
  Loader2,
  Mail,
  Network,
  Save,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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

interface UserRow {
  _id: string;
  email: string;
  fullName: string;
  businessUnit: string;
  department?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
interface DepartmentRow {
  _id: string;
  name: string;
}
interface GroupRow {
  _id: string;
  name: string;
  memberUserIds?: string[];
}

const NO_DEPT = "__none__";

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<UserRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Department draft — separate from `user.department` so we know whether the form is dirty
  const [deptDraft, setDeptDraft] = useState<string>("");
  const [savingDept, setSavingDept] = useState(false);

  // Toggle status confirm
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const token = useMemo(() => localStorage.getItem("nexa-token"), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchAll = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      const [userRes, deptRes, groupRes] = await Promise.all([
        axios.get(`/api/v1/admin/auth/users/${id}`, { headers }),
        axios.get("/api/v1/admin/auth/departments", { headers }),
        axios.get("/api/v1/admin/user-groups", { headers }).catch(() => ({ data: { groups: [] } }))
      ]);
      const fetchedUser: UserRow = userRes.data.user;
      setUser(fetchedUser);
      setDepartments(deptRes.data.departments || []);
      setGroups(groupRes.data.groups || []);
      setDeptDraft(fetchedUser.department || NO_DEPT);
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast({
          variant: "destructive",
          title: "User not found",
          description: "Returning to the user directory."
        });
        navigate("/admin/users");
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not load user",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }, [id, token, headers, toast, navigate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const groupsForUser = useMemo(
    () =>
      groups.filter((g) =>
        (g.memberUserIds ?? []).some((uid) => String(uid) === String(user?._id))
      ),
    [groups, user]
  );

  const deptDirty = (user?.department || NO_DEPT) !== deptDraft;

  const handleSaveDept = async () => {
    if (!user || !deptDirty) return;
    try {
      setSavingDept(true);
      const departmentValue = deptDraft === NO_DEPT ? null : deptDraft;
      const { data } = await axios.patch(
        `/api/v1/admin/auth/users/${user._id}`,
        { department: departmentValue },
        { headers }
      );
      setUser(data.user);
      setDeptDraft(data.user.department || NO_DEPT);
      toast({
        title: "Department updated",
        description: departmentValue
          ? `${user.fullName} is now in ${departmentValue}.`
          : `${user.fullName} no longer belongs to a department.`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not update",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setSavingDept(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    try {
      setToggling(true);
      const { data } = await axios.patch(
        `/api/v1/admin/auth/users/${user._id}/toggle-status`,
        {},
        { headers }
      );
      const wasActivated = data?.user?.isActive === true;
      const remaining = typeof data?.activeUserCount === "number" ? data.activeUserCount : null;
      setUser((prev) => (prev ? { ...prev, isActive: data?.user?.isActive } : prev));
      toast({
        title: wasActivated ? "User reactivated" : "User deactivated",
        description: wasActivated
          ? "They can sign in again immediately."
          : remaining !== null
            ? `Their license slot is freed. ${remaining} user${remaining === 1 ? "" : "s"} still active.`
            : "Their license slot is freed."
      });
      setToggleOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not update status",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="px-6 lg:px-12 py-10 space-y-8">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isActive = user.isActive !== false;

  return (
    <div className="px-6 lg:px-12 py-10 space-y-10">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/users")}
        className="text-slate-500 hover:text-slate-900 font-bold -ml-2 group"
      >
        <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to users
      </Button>

      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] font-black text-2xl shrink-0">
            {user.fullName?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-black font-['Sen'] text-slate-900 truncate" title={user.fullName}>
                {user.fullName}
              </h1>
              {isActive ? (
                <Badge className="rounded-lg bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] px-3">
                  ACTIVE
                </Badge>
              ) : (
                <Badge className="rounded-lg bg-slate-100 text-slate-500 border-none font-bold text-[10px] px-3">
                  DEACTIVATED
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <Mail size={12} /> {user.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {user.businessUnit}
              </span>
              {user.createdAt ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} /> Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setToggleOpen(true)}
          className={cn(
            "rounded-xl font-bold h-11 px-5 shrink-0",
            isActive
              ? "border-slate-200 text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          )}
        >
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      </header>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-6 space-y-6">
          <div>
            <p className="font-black font-['Sen'] text-slate-900">Department</p>
            <p className="text-xs font-medium text-slate-400">
              Move this user to a different department or assign one if they don't have one yet.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={deptDraft} onValueChange={setDeptDraft}>
              <SelectTrigger className="rounded-xl h-11 border-slate-200 sm:max-w-md">
                <SelectValue placeholder="Pick a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEPT}>No department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d._id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSaveDept}
              disabled={!deptDirty || savingDept}
              className="rounded-xl font-bold text-white h-11 px-5"
              style={{ backgroundColor: "var(--brand-color)" }}
            >
              {savingDept ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  <Save size={14} className="mr-2" />
                  Save department
                </>
              )}
            </Button>
          </div>

          {departments.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium">
              No departments configured yet.{" "}
              <button
                type="button"
                onClick={() => navigate("/admin/departments")}
                className="font-bold text-[var(--brand-color)] hover:underline"
              >
                Create one
              </button>{" "}
              first.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="font-black font-['Sen'] text-slate-900">User groups</p>
            <p className="text-xs font-medium text-slate-400">
              Document and policy access is gated by group membership in addition to department.
            </p>
          </div>
          {groupsForUser.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <Network size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Not in any groups yet</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Manage memberships from{" "}
                <button
                  type="button"
                  onClick={() => navigate("/admin/user-groups")}
                  className="font-bold text-[var(--brand-color)] hover:underline"
                >
                  User groups
                </button>
                .
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groupsForUser.map((g) => (
                <Badge
                  key={g._id}
                  variant="outline"
                  className="text-xs font-bold rounded-lg px-3 py-1.5 border-slate-200 text-slate-700"
                >
                  {g.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="Email" value={user.email} icon={<Mail size={14} />} />
          <Field
            label="Business unit"
            value={user.businessUnit}
            icon={<Users size={14} />}
          />
          <Field
            label="Department"
            value={user.department || "—"}
            icon={<Layers size={14} />}
          />
          <Field
            label="Email verified"
            value={user.emailVerified ? "Yes" : "No"}
            icon={<Mail size={14} />}
          />
          <Field
            label="Joined"
            value={user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
            icon={<Calendar size={14} />}
          />
          <Field
            label="Updated"
            value={user.updatedAt ? format(new Date(user.updatedAt), "MMM d, yyyy") : "—"}
            icon={<Calendar size={14} />}
          />
        </CardContent>
      </Card>

      <AlertDialog open={toggleOpen} onOpenChange={(o) => !o && !toggling && setToggleOpen(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              {isActive ? `Deactivate ${user.fullName}?` : `Activate ${user.fullName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              {isActive
                ? "They will no longer be able to sign in until reactivated. Their data, group memberships, and document access stay intact — this just locks the account."
                : "They will be able to sign in again immediately and consume an active license slot."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold" disabled={toggling}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              disabled={toggling}
              className={cn(
                "rounded-xl font-bold",
                isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {toggling ? <Loader2 className="animate-spin" size={16} /> : isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Field: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode }> = ({
  label,
  value,
  icon
}) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 inline-flex items-center gap-1.5">
      <span className="text-slate-300">{icon}</span>
      {label}
    </p>
    <p className="font-bold text-slate-900 mt-1 truncate">{value}</p>
  </div>
);

export default UserDetail;
