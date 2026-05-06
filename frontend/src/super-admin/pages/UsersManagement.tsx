import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  Loader2,
  Network,
  Send,
  FileUp,
  Mail,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/lib/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  readSuperAdminDirectoryBu,
  writeSuperAdminDirectoryBu
} from '../lib/superAdminDirectoryBu';

const inputBu =
  'rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0';

const CSV_TEMPLATE = `fullName,email,password,department
Jane Doe,jane@company.com,YourTempPass123,Finance
John Smith,john@company.com,,Operations`;

function readStoredAdminUser(): { businessUnit?: string; tenantName?: string } | null {
  for (const key of ['nexa-user', 'cpanelUser'] as const) {
    const raw = localStorage.getItem(key);
    if (raw && raw !== 'undefined') {
      try {
        return JSON.parse(raw) as { businessUnit?: string; tenantName?: string };
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

const UsersManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<{ _id: string; name: string; memberUserIds?: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; fullName: string; isActive: boolean } | null>(null);
  const [inviteEmployeeOpen, setInviteEmployeeOpen] = useState(false);
  const [inviteAdminOpen, setInviteAdminOpen] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [employeeInviteForm, setEmployeeInviteForm] = useState({ firstName: '', lastName: '', email: '', department: '' });
  const [adminInviteForm, setAdminInviteForm] = useState({ firstName: '', lastName: '', email: '' });
  const [adminInviteSubmitting, setAdminInviteSubmitting] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [employeeInviteSubmitting, setEmployeeInviteSubmitting] = useState(false);
  const [employeeInviteError, setEmployeeInviteError] = useState('');
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: ''
  });
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);

  const isSuperPath = location.pathname.startsWith('/super-admin');
  const token = useMemo(
    () =>
      isSuperPath
        ? localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token')
        : localStorage.getItem('nexa-token'),
    [isSuperPath]
  );
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [isSuperAdminViewer, setIsSuperAdminViewer] = useState(false);
  const [tenantPickList, setTenantPickList] = useState<{ name: string; label: string }[]>([]);
  const [superDirectoryBu, setSuperDirectoryBu] = useState(() => readSuperAdminDirectoryBu());

  useEffect(() => {
    const stored = readStoredAdminUser();
    setIsSuperAdminViewer(stored?.businessUnit === 'SUPERADMIN');
  }, []);

  useEffect(() => {
    if (!isSuperAdminViewer || !token) return;
    (async () => {
      try {
        const { data } = await axios.get('/api/v1/provisioning/tenants', { headers });
        const rows = (data.tenants || []).map((t: { name: string; label?: string }) => ({
          name: t.name,
          label: t.label || t.name
        }));
        setTenantPickList(rows);
        let pick = readSuperAdminDirectoryBu();
        if (!pick && rows.length === 1) {
          pick = rows[0].name;
          writeSuperAdminDirectoryBu(pick);
          setSuperDirectoryBu(pick);
        }
      } catch (e) {
        console.error('Failed to load tenants for directory', e);
      }
    })();
  }, [isSuperAdminViewer, headers, token]);

  useEffect(() => {
    if (searchParams.get('userGroups') === '1') {
      navigate('/admin/user-groups', { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = readStoredAdminUser();
      const isSuper = stored?.businessUnit === 'SUPERADMIN';
      let bu = '';
      if (isSuper) {
        bu = superDirectoryBu || readSuperAdminDirectoryBu() || '';
        if (!bu) {
          setUsers([]);
          return;
        }
      } else {
        bu = (stored?.tenantName || stored?.businessUnit || '').trim();
        if (!bu) {
          setUsers([]);
          return;
        }
      }
      const q = `?businessUnit=${encodeURIComponent(bu)}`;
      const [usersResp, groupsResp] = await Promise.all([
        axios.get(`/api/v1/admin/auth/users${q}`, { headers }),
        // Super admin endpoint expects the BU via query; BU admins derive from their token.
        axios.get(`/api/v1/admin/user-groups${isSuper ? q : ''}`, { headers }).catch(() => ({ data: { groups: [] } }))
      ]);
      setUsers(usersResp.data.users || []);
      setUserGroups(groupsResp.data.groups || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
      toast({
        title: "Error",
        description: "Failed to load users for your business unit.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [headers, toast, superDirectoryBu]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get('/api/v1/admin/auth/departments', { headers });
        if (!cancelled) setDepartments(data.departments || []);
      } catch (err) {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, headers]);

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexa-users-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/v1/admin/auth/users/bulk-csv', fd, {
        headers: { ...headers }
      });
      toast({
        title: 'Import finished',
        description: data.message || `Created ${data.created?.length ?? 0} user(s).`,
      });
      if (data.failed?.length) {
        toast({
          title: 'Some rows failed',
          description: `${data.failed.length} row(s) skipped — check emails for duplicates or invalid data.`,
          variant: 'destructive',
        });
      }
      fetchUsers();
    } catch (err: any) {
      toast({
        title: 'CSV import failed',
        description: err.response?.data?.error || 'Could not process file.',
        variant: 'destructive',
      });
    } finally {
      setCsvUploading(false);
      e.target.value = '';
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminInviteSubmitting(true);
    setAdminInviteError('');
    try {
      await axios.post('/api/v1/admin/auth/invite-peer-admin', adminInviteForm, { headers });
      toast({
        title: 'Administrator added',
        description: `Login credentials were emailed to ${adminInviteForm.email}.`,
      });
      setAdminInviteForm({ firstName: '', lastName: '', email: '' });
      setInviteAdminOpen(false);
    } catch (err: any) {
      setAdminInviteError(err.response?.data?.error || err.response?.data?.message || 'Could not invite admin.');
    } finally {
      setAdminInviteSubmitting(false);
    }
  };

  const handleInviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeInviteSubmitting(true);
    setEmployeeInviteError('');
    try {
      await axios.post('/api/v1/admin/auth/invite-employee', employeeInviteForm, { headers });
      toast({
        title: 'Invitation sent',
        description: `A secure sign-up link was emailed to ${employeeInviteForm.email} (valid 7 days).`,
      });
      setEmployeeInviteForm({ firstName: '', lastName: '', email: '', department: '' });
      setInviteEmployeeOpen(false);
    } catch (err: any) {
      setEmployeeInviteError(
        err.response?.data?.error || err.response?.data?.message || 'Could not send employee invite.'
      );
    } finally {
      setEmployeeInviteSubmitting(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/v1/admin/auth/users', newUser, { headers });
      toast({
        title: "Success",
        description: `${newUser.firstName} ${newUser.lastName} has been added to your business unit.`,
      });
      setIsAddModalOpen(false);
      setNewUser({ firstName: '', lastName: '', email: '', password: '', department: '' });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create user.",
        variant: "destructive",
      });
    }
  };

  const confirmToggleUserStatus = async () => {
    if (!toggleTarget) return;
    try {
      setIsDeleting(toggleTarget.id);
      const { data } = await axios.patch(
        `/api/v1/admin/auth/users/${toggleTarget.id}/toggle-status`,
        {},
        { headers }
      );
      const wasActivated = data?.user?.isActive === true;
      const remaining = typeof data?.activeUserCount === "number" ? data.activeUserCount : null;
      toast({
        title: wasActivated ? "User reactivated" : "User deactivated",
        description: wasActivated
          ? "They can sign in again immediately."
          : remaining !== null
            ? `Their license slot is freed. ${remaining} user${remaining === 1 ? "" : "s"} still active in this business unit.`
            : "Their license slot is freed."
      });
      setToggleTarget(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update user status.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const directoryBuLabel = useMemo(() => {
    const stored = readStoredAdminUser();
    if (stored?.businessUnit === 'SUPERADMIN') {
      const row = tenantPickList.find((t) => t.name === superDirectoryBu);
      return row?.label || superDirectoryBu || 'selected tenant';
    }
    return stored?.tenantName || stored?.businessUnit || 'your unit';
  }, [tenantPickList, superDirectoryBu]);

  return (
    <div className="min-w-0 max-w-full space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4 min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
            <UsersIcon className="text-[var(--brand-color)]" size={32} />
            User directory
          </h1>
          <p className="text-slate-500 font-medium">Automatic tracking of infrastructure access for your local team.</p>
          {isSuperAdminViewer && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-lg">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">Tenant scope</span>
              <Select
                value={superDirectoryBu || undefined}
                onValueChange={(v) => {
                  setSuperDirectoryBu(v);
                  writeSuperAdminDirectoryBu(v);
                }}
              >
                <SelectTrigger className={`${inputBu} w-full sm:min-w-[280px]`}>
                  <SelectValue placeholder="Choose a tenant…" />
                </SelectTrigger>
                <SelectContent>
                  {tenantPickList.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col gap-4 bg-slate-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-bold font-['Sen']">Registered users</h2>
              <Badge className="bg-[var(--brand-color)]/10 text-[var(--brand-color)] border-none font-bold text-[10px] tracking-widest uppercase py-1">
                {filteredUsers.length} total
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" className="rounded-xl h-11 px-5 font-bold border-slate-200" asChild>
                <Link to="/admin/user-groups" className="inline-flex items-center gap-2">
                  <Network size={18} className="text-[var(--brand-color)]" />
                  User groups
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 px-5 font-bold border-slate-200 gap-2"
                onClick={() => {
                  setEmployeeInviteError('');
                  setInviteEmployeeOpen(true);
                }}
              >
                <Mail size={18} className="text-[var(--brand-color)]" />
                Invite employee
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 px-5 font-bold border-slate-200 gap-2"
                onClick={() => {
                  setAdminInviteError('');
                  setInviteAdminOpen(true);
                }}
              >
                <Send size={18} className="text-[var(--brand-color)]" />
                Invite admin
              </Button>
              <Button
                type="button"
                className="rounded-xl h-11 px-5 font-bold text-white gap-2"
                style={{ backgroundColor: 'var(--brand-color)' }}
                onClick={() => setIsAddModalOpen(true)}
              >
                <UserPlus size={18} />
                Add user
              </Button>
            </div>
          </div>
          <div className="relative w-full lg:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-colors" size={18} />
            <Input
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 h-11 bg-white ${inputBu}`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 p-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-6">
              <UsersIcon size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-['Sen']">No user records found</h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">Add your first user to grant them access to the Nexa AI chat interface for this unit.</p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-50">
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8">Identity & Full name</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Email address</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">User groups</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow
                  key={user._id}
                  onClick={() => navigate(`/admin/users/${user._id}`)}
                  className="group border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--brand-color)]/10 text-[var(--brand-color)] flex items-center justify-center font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{user.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 font-medium">{user.email}</TableCell>
                  <TableCell>
                    {(() => {
                      const groupsForUser = userGroups.filter((g) =>
                        (g.memberUserIds ?? []).some((id) => String(id) === String(user._id))
                      );
                      if (groupsForUser.length === 0) {
                        return <span className="text-xs font-semibold text-slate-400">None</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {groupsForUser.map((g) => (
                            <Badge
                              key={g._id}
                              variant="outline"
                              className="text-[10px] font-bold rounded-md px-2 py-0.5 border-slate-200 text-slate-700"
                              title={g.name}
                            >
                              {g.name}
                            </Badge>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {user.isActive === false ? (
                      <Badge variant="outline" className="rounded-lg bg-slate-100 text-slate-500 border-none font-bold text-[10px] px-3">
                        DEACTIVATED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-lg bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] px-3">
                        ACTIVE
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToggleTarget({
                            id: user._id,
                            fullName: user.fullName,
                            isActive: user.isActive !== false
                          });
                        }}
                        disabled={isDeleting === user._id}
                        className={cn(
                          "rounded-lg font-bold h-8 px-3 text-xs",
                          user.isActive === false
                            ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            : "border-slate-200 text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                        )}
                      >
                        {isDeleting === user._id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : user.isActive === false ? (
                          "Activate"
                        ) : (
                          "Deactivate"
                        )}
                      </Button>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-[var(--brand-color)] transition-colors" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      <Sheet open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add user</SheetTitle>
            <SheetDescription>
              Create an account for this business unit, or import many at once from a CSV file. Assign user groups afterward
              from User groups.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddUser} className="mt-8 space-y-5 px-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">First name</label>
                <Input
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Last name</label>
                <Input
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email</label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className={inputBu}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className={inputBu}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Department <span className="font-normal text-slate-400">(optional)</span></Label>
              <Select
                value={newUser.department || "__none__"}
                onValueChange={(v) => setNewUser({ ...newUser, department: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className={inputBu}>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No departments yet for this business unit. You can leave this blank.
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-bold text-white" style={{ backgroundColor: 'var(--brand-color)' }}>
              Create user
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-black font-['Sen'] text-lg">
              <FileUp size={22} className="text-[var(--brand-color)]" />
              Bulk import (CSV)
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Columns: <span className="font-bold text-slate-700">fullName</span> (or <span className="font-bold text-slate-700">firstName</span> + <span className="font-bold text-slate-700">lastName</span>), <span className="font-bold text-slate-700">email</span>, optional{" "}
              <span className="font-bold text-slate-700">password</span> (min 6 chars — if blank, a temporary password is generated and emailed), optional{" "}
              <span className="font-bold text-slate-700">department</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-lg font-bold" onClick={downloadCsvTemplate}>
                Download template
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvBulkUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg font-bold border-[var(--brand-color)]/40 text-[var(--brand-color)]"
                disabled={csvUploading}
                onClick={() => csvInputRef.current?.click()}
              >
                {csvUploading ? <Loader2 className="animate-spin" size={16} /> : 'Upload CSV'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inviteEmployeeOpen} onOpenChange={setInviteEmployeeOpen}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">Invite employee</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              Sends a signed link to create a Nexa account for <span className="font-bold text-slate-800">{directoryBuLabel}</span>. Business unit cannot be changed by the recipient; access to documents is controlled by user groups after they join.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInviteEmployee} className="mt-6 flex flex-col gap-5 flex-1">
            {employeeInviteError ? (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{employeeInviteError}</div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">First name</Label>
                <Input
                  value={employeeInviteForm.firstName}
                  onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, firstName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Last name</Label>
                <Input
                  value={employeeInviteForm.lastName}
                  onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, lastName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Work email</Label>
              <Input
                type="email"
                value={employeeInviteForm.email}
                onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, email: e.target.value })}
                className={inputBu}
                required
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Department <span className="font-normal text-slate-400">(optional)</span></Label>
              <Select
                value={employeeInviteForm.department || "__none__"}
                onValueChange={(v) => setEmployeeInviteForm({ ...employeeInviteForm, department: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className={inputBu}>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
              <Button type="button" variant="ghost" className="flex-1 rounded-xl font-bold" onClick={() => setInviteEmployeeOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={employeeInviteSubmitting}
                className="flex-[2] rounded-xl font-bold text-white h-11"
                style={{ backgroundColor: 'var(--brand-color)' }}
              >
                {employeeInviteSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Send invite'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={inviteAdminOpen} onOpenChange={setInviteAdminOpen}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">Invite administrator</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              Adds another administrator for <span className="font-bold text-slate-800">{directoryBuLabel}</span>.
              They get an email with a generated password and the same scope of control you have here.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInviteAdmin} className="mt-6 flex flex-col gap-5 flex-1">
            {adminInviteError ? (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{adminInviteError}</div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">First name</Label>
                <Input
                  value={adminInviteForm.firstName}
                  onChange={(e) => setAdminInviteForm({ ...adminInviteForm, firstName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Last name</Label>
                <Input
                  value={adminInviteForm.lastName}
                  onChange={(e) => setAdminInviteForm({ ...adminInviteForm, lastName: e.target.value })}
                  className={inputBu}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Work email</Label>
              <Input
                type="email"
                value={adminInviteForm.email}
                onChange={(e) => setAdminInviteForm({ ...adminInviteForm, email: e.target.value })}
                className={inputBu}
                required
                placeholder="admin@company.com"
              />
            </div>
            <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
              <Button type="button" variant="ghost" className="flex-1 rounded-xl font-bold" onClick={() => setInviteAdminOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={adminInviteSubmitting}
                className="flex-[2] rounded-xl font-bold text-white h-11"
                style={{ backgroundColor: 'var(--brand-color)' }}
              >
                {adminInviteSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Send invite'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!toggleTarget}
        onOpenChange={(o) => {
          if (!o && isDeleting) return;
          if (!o) setToggleTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              {toggleTarget?.isActive ? `Deactivate ${toggleTarget?.fullName}?` : `Activate ${toggleTarget?.fullName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              {toggleTarget?.isActive
                ? "They will no longer be able to sign in until reactivated. Their data, group memberships, and document access stay intact — this just locks the account."
                : "They will be able to sign in again immediately and consume an active license slot."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold" disabled={!!isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleUserStatus}
              disabled={!!isDeleting}
              className={cn(
                "rounded-xl font-bold",
                toggleTarget?.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isDeleting ? <Loader2 className="animate-spin" size={16} /> : toggleTarget?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default UsersManagement;
