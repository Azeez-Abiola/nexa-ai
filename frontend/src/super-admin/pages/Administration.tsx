import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle,
  Search,
  Mail,
  ShieldCheck,
  UserPlus,
  Clock,
  Shield,
  Trash2,
  Send,
  Loader2,
  X,
  CheckCircle2,
  Files,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Administration: React.FC = () => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; target: any | null; type: 'admin' | 'invite' }>({ open: false, target: null, type: 'admin' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ totalAdmins: 0, activeAdmins: 0, pendingInvites: 0 });

  useEffect(() => {
    fetchData();
    fetchBUs();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('cpanelToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [adminsRes, invitesRes] = await Promise.all([
        axios.get('/api/v1/admin/auth/admins', { headers }),
        axios.get('/api/v1/provisioning/invites', { headers })
      ]);

      const adminsList = adminsRes.data.admins || [];
      const invitesList = invitesRes.data.invites || [];

      setAdmins(adminsList);
      setInvites(invitesList);

      setStats({
        totalAdmins: adminsList.length,
        activeAdmins: adminsList.filter((a: any) => a.isActive !== false).length,
        pendingInvites: invitesList.filter((i: any) => i.status === 'pending').length
      });
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBUs = async () => {
    try {
      const token = localStorage.getItem('cpanelToken');
      const { data } = await axios.get('/api/v1/analytics/business-units-list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinessUnits(data.businessUnits || []);
    } catch (error) {
      console.error('Failed to fetch BUs', error);
    }
  };

  const handleToggleStatus = async (adminId: string) => {
    try {
      const token = localStorage.getItem('cpanelToken');
      await axios.patch(`/api/v1/admin/auth/${adminId}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Status toggle failed', error);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.target) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cpanelToken');
      const headers = { Authorization: `Bearer ${token}` };

      if (confirmDelete.type === 'admin') {
        // Assume there's a delete route, or just skip if not implemented yet
        // For now we'll just toggle status in this example if delete is missing
        console.log('Delete admin not implemented in backend yet');
      } else {
        await axios.delete(`/api/v1/provisioning/invites/${confirmDelete.target._id}`, { headers });
      }

      fetchData();
      setConfirmDelete({ open: false, target: null, type: 'admin' });
    } catch (error) {
      console.error('Delete failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-['Sen'] text-slate-900 leading-tight">Administration hub</h2>
          <p className="text-slate-400 font-medium text-sm">Manage platform administrators and direct provisioning.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const rows = [['Name', 'Email', 'Business Unit', 'Role'], ...admins.map((a: any) => [a.fullName, a.email, a.businessUnit, 'Admin'])];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexa-admins-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-11 px-5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <Download size={14} />
            Export CSV
          </button>
          <Button
            onClick={() => setIsDrawerOpen(true)}
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-xl h-11 px-6 shadow-lg shadow-red-900/10 flex items-center gap-2 group font-bold w-fit"
          >
            <UserPlus size={18} className="group-hover:scale-110 transition-transform duration-300" />
            Invite admin
          </Button>
        </div>
      </div>

      {/* Active Admins Table */}
      <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden mt-6 bg-white">
        <CardHeader className="bg-white border-b border-slate-100 py-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
            <ShieldCheck size={18} className="text-[#ed0000]" />
            Active platform administrators
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader className="bg-slate-50/50 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-6 px-10 font-bold text-slate-800 text-xs">Administrator</TableHead>
              <TableHead className="font-bold text-slate-800 text-xs">Email address</TableHead>
              <TableHead className="font-bold text-slate-800 text-xs text-center">Business unit</TableHead>
              <TableHead className="font-bold text-slate-800 text-xs text-center">Status</TableHead>
              <TableHead className="font-bold text-slate-800 text-xs text-right px-10">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-40 rounded-lg ml-10" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-48 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 rounded-lg mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-24 rounded-xl ml-auto mr-10" /></TableCell>
                </TableRow>
              ))
            ) : admins.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">No administrators registered.</TableCell></TableRow>
            ) : admins.map((admin) => (
              <TableRow key={admin._id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="font-bold text-slate-900">{admin.fullName}</TableCell>
                <TableCell className="text-slate-500 text-sm">{admin.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase tracking-wider px-2">
                    {admin.businessUnit || 'SYSTEM'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={admin.isActive !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                    {admin.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={admin.isActive !== false ? "text-slate-400 hover:text-red-600" : "text-emerald-600 hover:bg-emerald-50"}
                      onClick={() => handleToggleStatus(admin._id)}
                    >
                      {admin.isActive !== false ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Invite Drawer */}
      <InviteAdminDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={fetchData}
        businessUnits={businessUnits}
      />

      {/* Revoke Confirmation */}
      <AlertDialog open={confirmDelete.open} onOpenChange={(o) => !o && setConfirmDelete({ ...confirmDelete, open: false })}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl max-w-[400px] p-8 animate-in fade-in zoom-in-95 duration-200 !slide-in-from-left-unset !slide-in-from-top-unset">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black font-['Sen'] text-slate-900 text-center">Revoke access?</AlertDialogTitle>
            <AlertDialogDescription className="py-4 font-medium text-slate-500 text-center text-sm leading-relaxed">
              This will invalidate the platform credentials sent to <strong>{confirmDelete.target?.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 pt-2">
            <AlertDialogCancel className="rounded-2xl border-slate-200 h-12 flex-1 font-bold text-slate-500">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-red-600 hover:bg-red-700 rounded-2xl h-12 flex-1 font-bold shadow-lg shadow-red-900/10"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const AdminStatCard = ({ label, value, icon }: any) => (
  <Card className="shadow-lg shadow-slate-100/50 border border-slate-100 rounded-[2rem] p-1 bg-rose-50/50 group transition-all duration-500">
    <CardContent className="p-8 flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-400 mb-1 leading-none">{label}</p>
        <h4 className="text-2xl font-bold text-slate-900 tracking-tighter leading-none">{value}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white text-slate-400 shadow-sm transition-transform group-hover:scale-110">
        {icon}
      </div>
    </CardContent>
  </Card>
);

const InviteAdminDrawer = ({ isOpen, onClose, onSuccess, businessUnits }: any) => {
  const [formData, setFormData] = useState({ fullName: '', email: '', businessUnit: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessUnit) { setError("Please select a business unit."); return; }
    setIsSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem('cpanelToken');
      await axios.post('/api/v1/provisioning/invite', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
      onClose();
      setFormData({ fullName: '', email: '', businessUnit: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || "Invitation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-md bg-white p-0 flex flex-col border-none shadow-2xl animate-in slide-in-from-right duration-500">
        <SheetHeader className="p-10 pb-0">
          <SheetTitle className="text-3xl font-black font-['Sen']">Invite administrator</SheetTitle>
          <SheetDescription className="text-slate-400 text-sm font-medium mt-2 leading-relaxed">
            The administrator will receive their login credentials via a secure email dispatch. No manual password creation is required.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-10 py-8 space-y-6">
          {error && <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">{error}</div>}

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Full name</Label>
            <Input
              placeholder="e.g. John Doe"
              className="h-11 rounded-xl focus-visible:ring-[#ed0000] font-medium"
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Work email</Label>
            <Input
              type="email"
              placeholder="admin@company.com"
              className="h-11 rounded-xl focus-visible:ring-[#ed0000] font-medium"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Assign business unit</Label>
            <Select
              value={formData.businessUnit}
              onValueChange={(val) => setFormData({ ...formData, businessUnit: val })}
            >
              <SelectTrigger className="h-11 rounded-xl focus:ring-[#ed0000] border-slate-200 font-medium">
                <SelectValue placeholder="Select target business unit" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100">
                {businessUnits.map((bu) => (
                  <SelectItem key={bu.name} value={bu.name} className="py-3 font-medium text-slate-600">
                    {bu.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3 mt-4">
            <div className="p-2 rounded-full bg-white text-emerald-500 shadow-sm h-fit">
              <Send size={14} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700 leading-tight">Direct provisioning active</p>
              <p className="text-[10px] text-emerald-600 mt-1 opacity-80 leading-relaxed">
                Nexa AI will auto-generate a secure password and send it to the administrator immediately.
              </p>
            </div>
          </div>
        </form>

        <SheetFooter className="p-10 pt-6 bg-slate-50/50 space-x-4 border-t border-slate-100">
          <Button variant="ghost" className="rounded-xl font-bold flex-1 h-11" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-xl font-bold flex-[2] h-11 shadow-lg shadow-red-900/10 disabled:opacity-60" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
            {isSubmitting ? 'Sending...' : 'Send invite'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

const cn = (...classes: any) => classes.filter(Boolean).join(' ');

export default Administration;
