import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Users as UsersIcon,
  Search,
  Loader2,
  Network,
  Send,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Briefcase,
  ShieldCheck,
  User as UserIcon,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; fullName: string; isActive: boolean } | null>(null);
  const [inviteEmployeeOpen, setInviteEmployeeOpen] = useState(false);
  const [inviteAdminOpen, setInviteAdminOpen] = useState(false);
  const [employeeInviteTab, setEmployeeInviteTab] = useState<'single' | 'bulk'>('single');
  const [employeeInviteForm, setEmployeeInviteForm] = useState({ firstName: '', lastName: '', email: '', department: '' });
  const [adminInviteForm, setAdminInviteForm] = useState({ firstName: '', lastName: '', email: '' });
  const [adminInviteSubmitting, setAdminInviteSubmitting] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [employeeInviteSubmitting, setEmployeeInviteSubmitting] = useState(false);
  const [employeeInviteError, setEmployeeInviteError] = useState('');
  const [bulkRows, setBulkRows] = useState<{ firstName: string; lastName: string; email: string; department: string }[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ sent: string[]; failed: { email: string; reason: string }[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [reinviting, setReinviting] = useState<string | null>(null);

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
        if (!bu) { setUsers([]); return; }
      } else {
        bu = (stored?.tenantName || stored?.businessUnit || '').trim();
        if (!bu) { setUsers([]); return; }
      }
      const q = `?businessUnit=${encodeURIComponent(bu)}`;
      const [usersResp, groupsResp, invitesResp] = await Promise.all([
        axios.get(`/api/v1/admin/auth/users${q}`, { headers }),
        axios.get(`/api/v1/admin/user-groups${isSuper ? q : ''}`, { headers }).catch(() => ({ data: { groups: [] } })),
        axios.get(`/api/v1/admin/auth/pending-invites${q}`, { headers }).catch(() => ({ data: { invites: [] } }))
      ]);
      setUsers(usersResp.data.users || []);
      setUserGroups(groupsResp.data.groups || []);
      setPendingInvites(invitesResp.data.invites || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
      toast({ title: 'Error', description: 'Failed to load users for your business unit.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [headers, toast, superDirectoryBu]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get('/api/v1/admin/auth/departments', { headers });
        if (!cancelled) setDepartments(data.departments || []);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, headers]);

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminInviteSubmitting(true);
    setAdminInviteError('');
    try {
      await axios.post('/api/v1/admin/auth/invite-peer-admin', adminInviteForm, { headers });
      toast({ title: 'Administrator added', description: `Login credentials were emailed to ${adminInviteForm.email}.` });
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
      toast({ title: 'Invitation sent', description: `A secure sign-up link was emailed to ${employeeInviteForm.email} (valid 7 days).` });
      setEmployeeInviteForm({ firstName: '', lastName: '', email: '', department: '' });
      setInviteEmployeeOpen(false);
    } catch (err: any) {
      setEmployeeInviteError(err.response?.data?.error || err.response?.data?.message || 'Could not send employee invite.');
    } finally {
      setEmployeeInviteSubmitting(false);
    }
  };

  const downloadBulkTemplate = () => {
    const csv = 'First Name,Last Name,Email,Department\nJane,Doe,jane.doe@company.com,Engineering\nJohn,Smith,john.smith@company.com,Marketing';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-invite-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = '';
    if (!file) return;
    setBulkParseError('');
    setBulkResults(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result: Papa.ParseResult<Record<string, string>>) => {
        const rows = result.data.map((row) => ({
          firstName: (row['First Name'] || row['first name'] || row['firstName'] || '').trim(),
          lastName: (row['Last Name'] || row['last name'] || row['lastName'] || '').trim(),
          email: (row['Email'] || row['email'] || '').trim().toLowerCase(),
          department: (row['Department'] || row['department'] || '').trim(),
        })).filter((r) => r.email);
        if (rows.length === 0) {
          setBulkParseError('No valid rows found. Make sure the file has First Name, Last Name, and Email columns.');
          return;
        }
        if (rows.length > 200) {
          setBulkParseError('Maximum 200 employees per upload. Please split into smaller files.');
          return;
        }
        setBulkRows(rows);
      },
      error: () => setBulkParseError('Could not parse the file. Please use the CSV template.'),
    });
  };

  const handleBulkSubmit = async () => {
    if (bulkRows.length === 0) return;
    setBulkSubmitting(true);
    setBulkResults(null);
    try {
      const { data } = await axios.post('/api/v1/admin/auth/invite-employees-bulk', { employees: bulkRows }, { headers });
      setBulkResults({ sent: data.sent, failed: data.failed });
      if (data.sent.length > 0) {
        toast({ title: `${data.sent.length} invite${data.sent.length === 1 ? '' : 's'} sent`, description: data.failed.length > 0 ? `${data.failed.length} row${data.failed.length === 1 ? '' : 's'} had errors — see details below.` : 'All invitations sent successfully.' });
      }
      if (data.failed.length === 0) setBulkRows([]);
    } catch (err: any) {
      setBulkParseError(err.response?.data?.error || 'Bulk invite failed. Please try again.');
    } finally {
      setBulkSubmitting(false);
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
      const remaining = typeof data?.activeUserCount === 'number' ? data.activeUserCount : null;
      toast({
        title: wasActivated ? 'User reactivated' : 'User deactivated',
        description: wasActivated
          ? 'They can sign in again immediately.'
          : remaining !== null
            ? `Their license slot is freed. ${remaining} user${remaining === 1 ? '' : 's'} still active in this business unit.`
            : 'Their license slot is freed.'
      });
      setToggleTarget(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to update user status.', variant: 'destructive' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleReinvite = async (email: string) => {
    setReinviting(email);
    try {
      await axios.post('/api/v1/admin/auth/reinvite-employee', { email }, { headers });
      toast({ title: 'Invitation resent', description: `A fresh invite link was sent to ${email}.` });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || 'Could not resend invite.', variant: 'destructive' });
    } finally {
      setReinviting(null);
    }
  };

  const combinedList = [
    ...users,
    ...pendingInvites.map((inv) => ({
      ...inv,
      _id: inv._id,
      fullName: inv.fullName,
      email: inv.email,
      department: inv.department,
      isActive: true,
      _isPending: true,
    })),
  ].filter((u) =>
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
                onValueChange={(v) => { setSuperDirectoryBu(v); writeSuperAdminDirectoryBu(v); }}
              >
                <SelectTrigger className={`${inputBu} w-full sm:min-w-[280px]`}>
                  <SelectValue placeholder="Choose a tenant…" />
                </SelectTrigger>
                <SelectContent>
                  {tenantPickList.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.label}</SelectItem>
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
                {combinedList.length} total
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
                onClick={() => { setEmployeeInviteError(''); setInviteEmployeeOpen(true); }}
              >
                <Mail size={18} className="text-[var(--brand-color)]" />
                Invite employee
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 px-5 font-bold border-slate-200 gap-2"
                onClick={() => { setAdminInviteError(''); setInviteAdminOpen(true); }}
              >
                <Send size={18} className="text-[var(--brand-color)]" />
                Invite admin
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
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : combinedList.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-6">
              <UsersIcon size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-['Sen']">No user records found</h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">Invite employees or admins to grant them access to this business unit.</p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50">
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8">Name</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Email</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Department</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Role</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">User groups</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Status</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedList.map((user) => {
                  const isPending = !!user._isPending;
                  const isAdmin = user.isAdmin === true;
                  const groupsForUser = isPending ? [] : userGroups.filter((g) =>
                    (g.memberUserIds ?? []).some((id) => String(id) === String(user._id))
                  );
                  return (
                    <TableRow
                      key={user._id}
                      onClick={() => !isPending && navigate(`/admin/users/${user._id}`)}
                      className={cn(
                        'group border-slate-50 transition-colors',
                        isPending ? 'opacity-70' : 'hover:bg-slate-50/50 cursor-pointer'
                      )}
                    >
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0',
                            isPending
                              ? 'bg-amber-50 text-amber-500'
                              : 'bg-[var(--brand-color)]/10 text-[var(--brand-color)]'
                          )}>
                            {user.fullName.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900">{user.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.department ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Briefcase size={13} className="text-slate-400 shrink-0" />
                            {user.department}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <span className="text-xs font-semibold text-slate-400">—</span>
                        ) : isAdmin ? (
                          <Badge variant="outline" className="rounded-lg bg-violet-50 text-violet-600 border-none font-bold text-[10px] px-3 gap-1 inline-flex items-center">
                            <ShieldCheck size={11} />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg bg-sky-50 text-sky-600 border-none font-bold text-[10px] px-3 gap-1 inline-flex items-center">
                            <UserIcon size={11} />
                            Employee
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <span className="text-xs font-semibold text-slate-400">—</span>
                        ) : groupsForUser.length === 0 ? (
                          <span className="text-xs font-semibold text-slate-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
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
                        )}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <Badge variant="outline" className="rounded-lg bg-amber-50 text-amber-600 border-none font-bold text-[10px] px-3">
                            PENDING
                          </Badge>
                        ) : user.isActive === false ? (
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100"
                            >
                              {(isDeleting === user._id || reinviting === user.email) ? (
                                <Loader2 size={15} className="animate-spin text-slate-400" />
                              ) : (
                                <MoreHorizontal size={15} className="text-slate-400" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-slate-100">
                            {!isPending && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${user._id}`); }}
                                className="gap-2 font-semibold text-slate-700 cursor-pointer"
                              >
                                <Eye size={14} className="text-slate-400" />
                                View profile
                              </DropdownMenuItem>
                            )}
                            {isPending && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleReinvite(user.email); }}
                                disabled={reinviting === user.email}
                                className="gap-2 font-semibold text-slate-700 cursor-pointer"
                              >
                                <RefreshCw size={14} className="text-slate-400" />
                                Re-invite
                              </DropdownMenuItem>
                            )}
                            {!isPending && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); setToggleTarget({ id: user._id, fullName: user.fullName, isActive: user.isActive !== false }); }}
                                  disabled={isDeleting === user._id}
                                  className={cn(
                                    'gap-2 font-semibold cursor-pointer',
                                    user.isActive === false ? 'text-emerald-600' : 'text-rose-600'
                                  )}
                                >
                                  {user.isActive === false ? 'Activate' : 'Deactivate'}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Invite employee sheet */}
      <Sheet open={inviteEmployeeOpen} onOpenChange={(o) => { setInviteEmployeeOpen(o); if (!o) { setEmployeeInviteTab('single'); setBulkRows([]); setBulkResults(null); setBulkParseError(''); } }}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col overflow-y-auto">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">Invite employee</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              Sends a signed link to create a Nexa account for <span className="font-bold text-slate-800">{directoryBuLabel}</span>.
            </SheetDescription>
          </SheetHeader>

          {/* Tab switcher */}
          <div className="mt-5 flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => { setEmployeeInviteTab('single'); setEmployeeInviteError(''); }}
              className={cn('flex-1 text-xs font-bold py-2 rounded-lg transition-all', employeeInviteTab === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
            >
              Single invite
            </button>
            <button
              type="button"
              onClick={() => { setEmployeeInviteTab('bulk'); setBulkParseError(''); }}
              className={cn('flex-1 text-xs font-bold py-2 rounded-lg transition-all', employeeInviteTab === 'bulk' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
            >
              Bulk invite
            </button>
          </div>

          {/* Single invite */}
          {employeeInviteTab === 'single' && (
            <form onSubmit={handleInviteEmployee} className="mt-5 flex flex-col gap-5 flex-1">
              {employeeInviteError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{employeeInviteError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">First name</Label>
                  <Input value={employeeInviteForm.firstName} onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, firstName: e.target.value })} className={inputBu} required placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">Last name</Label>
                  <Input value={employeeInviteForm.lastName} onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, lastName: e.target.value })} className={inputBu} required placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Work email</Label>
                <Input type="email" value={employeeInviteForm.email} onChange={(e) => setEmployeeInviteForm({ ...employeeInviteForm, email: e.target.value })} className={inputBu} required placeholder="colleague@company.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Department <span className="font-normal text-slate-400">(optional)</span></Label>
                <Select
                  value={employeeInviteForm.department || '__none__'}
                  onValueChange={(v) => setEmployeeInviteForm({ ...employeeInviteForm, department: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger className={inputBu}><SelectValue placeholder="Select a department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {departments.map((d) => <SelectItem key={d._id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
                <Button type="button" variant="ghost" className="flex-1 rounded-xl font-bold" onClick={() => setInviteEmployeeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={employeeInviteSubmitting} className="flex-[2] rounded-xl font-bold text-white h-11" style={{ backgroundColor: 'var(--brand-color)' }}>
                  {employeeInviteSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Send invite'}
                </Button>
              </SheetFooter>
            </form>
          )}

          {/* Bulk invite */}
          {employeeInviteTab === 'bulk' && (
            <div className="mt-5 flex flex-col gap-5 flex-1">
              {/* Download template */}
              <div className="rounded-xl border border-dashed border-slate-200 p-4 flex items-center justify-between gap-4 bg-slate-50/50">
                <div>
                  <p className="text-sm font-bold text-slate-800">Download template</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">CSV with required columns: First Name, Last Name, Email, Department</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={downloadBulkTemplate} className="rounded-lg font-bold shrink-0 gap-2 border-slate-200">
                  <Download size={14} />
                  Template
                </Button>
              </div>

              {/* Upload area */}
              <div>
                <Label className="text-sm font-bold text-slate-700 mb-2 block">Upload spreadsheet <span className="font-normal text-slate-400">(CSV)</span></Label>
                <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 cursor-pointer hover:border-[var(--brand-color)]/40 hover:bg-[var(--brand-color)]/5 transition-colors">
                  <Upload size={20} className="text-slate-300" />
                  <span className="text-xs font-bold text-slate-500">Click to browse or drag & drop</span>
                  <span className="text-[10px] text-slate-400 font-medium">CSV · max 200 rows</span>
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleBulkFileChange} />
                </label>
              </div>

              {bulkParseError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{bulkParseError}</div>
              )}

              {/* Results summary */}
              {bulkResults && (
                <div className="space-y-2">
                  {bulkResults.sent.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-xs font-bold text-emerald-700">
                      <CheckCircle2 size={14} className="shrink-0" />
                      {bulkResults.sent.length} invite{bulkResults.sent.length === 1 ? '' : 's'} sent successfully
                    </div>
                  )}
                  {bulkResults.failed.length > 0 && (
                    <div className="rounded-xl border border-red-100 overflow-hidden">
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-xs font-bold text-red-700">
                        <XCircle size={14} className="shrink-0" />
                        {bulkResults.failed.length} row{bulkResults.failed.length === 1 ? '' : 's'} failed
                      </div>
                      <div className="divide-y divide-red-50 max-h-40 overflow-y-auto">
                        {bulkResults.failed.map((f, i) => (
                          <div key={i} className="px-3 py-2 text-xs">
                            <span className="font-bold text-slate-700">{f.email}</span>
                            <span className="text-slate-400 ml-2">{f.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              {bulkRows.length > 0 && !bulkResults && (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700">{bulkRows.length} row{bulkRows.length === 1 ? '' : 's'} ready</span>
                    <button type="button" onClick={() => setBulkRows([])} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {bulkRows.map((r, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-800 truncate">{r.firstName} {r.lastName}</span>
                        <span className="text-slate-400 truncate flex-1 text-right">{r.email}</span>
                        {r.department && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 shrink-0">{r.department}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
                <Button type="button" variant="ghost" className="flex-1 rounded-xl font-bold" onClick={() => setInviteEmployeeOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={bulkRows.length === 0 || bulkSubmitting}
                  onClick={handleBulkSubmit}
                  className="flex-[2] rounded-xl font-bold text-white h-11"
                  style={{ backgroundColor: 'var(--brand-color)' }}
                >
                  {bulkSubmitting ? <Loader2 className="animate-spin" size={18} /> : `Send ${bulkRows.length > 0 ? bulkRows.length : ''} invite${bulkRows.length === 1 ? '' : 's'}`}
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Invite admin sheet */}
      <Sheet open={inviteAdminOpen} onOpenChange={setInviteAdminOpen}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">Invite administrator</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              Adds another administrator for <span className="font-bold text-slate-800">{directoryBuLabel}</span>. They get an email with a generated password and the same scope of control you have here.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInviteAdmin} className="mt-6 flex flex-col gap-5 flex-1">
            {adminInviteError && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{adminInviteError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">First name</Label>
                <Input value={adminInviteForm.firstName} onChange={(e) => setAdminInviteForm({ ...adminInviteForm, firstName: e.target.value })} className={inputBu} required placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Last name</Label>
                <Input value={adminInviteForm.lastName} onChange={(e) => setAdminInviteForm({ ...adminInviteForm, lastName: e.target.value })} className={inputBu} required placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Work email</Label>
              <Input type="email" value={adminInviteForm.email} onChange={(e) => setAdminInviteForm({ ...adminInviteForm, email: e.target.value })} className={inputBu} required placeholder="admin@company.com" />
            </div>
            <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
              <Button type="button" variant="ghost" className="flex-1 rounded-xl font-bold" onClick={() => setInviteAdminOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adminInviteSubmitting} className="flex-[2] rounded-xl font-bold text-white h-11" style={{ backgroundColor: 'var(--brand-color)' }}>
                {adminInviteSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Send invite'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Activate / deactivate confirm */}
      <AlertDialog
        open={!!toggleTarget}
        onOpenChange={(o) => { if (!o && isDeleting) return; if (!o) setToggleTarget(null); }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              {toggleTarget?.isActive ? `Deactivate ${toggleTarget?.fullName}?` : `Activate ${toggleTarget?.fullName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              {toggleTarget?.isActive
                ? 'They will no longer be able to sign in until reactivated. Their data, group memberships, and document access stay intact — this just locks the account.'
                : 'They will be able to sign in again immediately and consume an active license slot.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold" disabled={!!isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleUserStatus}
              disabled={!!isDeleting}
              className={cn('rounded-xl font-bold', toggleTarget?.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {isDeleting ? <Loader2 className="animate-spin" size={16} /> : toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersManagement;
