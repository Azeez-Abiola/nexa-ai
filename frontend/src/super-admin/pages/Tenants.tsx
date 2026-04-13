import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import {
  PlusCircle,
  Search,
  ExternalLink,
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  UploadCloud,
  Globe,
  Download,
  Pencil
} from 'lucide-react';
import { useToast } from "@/lib/use-toast";
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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const Tenants: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; tenant: any | null }>({ open: false, tenant: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  // Stats from summary
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      const { data } = await axios.get('/api/v1/provisioning/tenants', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTenants(data.tenants || []);
      const active = data.tenants.filter((t: any) => t.isActive).length;
      setStats({
        total: data.tenants.length,
        active,
        inactive: data.tenants.length - active
      });
    } catch (error) {
      console.error('Failed to fetch tenants', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmModal.tenant) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      const formData = new FormData();
      formData.append('isActive', String(!confirmModal.tenant.isActive));

      await axios.put(`/api/v1/provisioning/tenants/${confirmModal.tenant._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTenants();
      setConfirmModal({ open: false, tenant: null });
    } catch (error) {
      console.error('Status toggle failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-['Sen']">Tenants</h2>
          <p className="text-slate-400 font-medium mt-1 text-sm">Manage access for all business units.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const rows = [['Name', 'Label', 'Slug', 'Status', 'Users'], ...tenants.map(t => [t.name, t.label, t.slug, t.isActive ? 'Active' : 'Inactive', t.userCount || 0])];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexa-tenants-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-11 px-5 bg-white border border-slate-200 rounded-[1.25rem] text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <Download size={14} />
            Export CSV
          </button>
          <Button
            onClick={() => { setEditingTenant(null); setIsDrawerOpen(true); }}
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-[1.25rem] h-11 px-6 shadow-2xl shadow-red-500/30 flex items-center gap-3 group font-bold transition-all hover:-translate-y-1"
          >
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Add new tenant
          </Button>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {isLoading ? [1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-rose-50/50 p-8">
            <CardContent className="p-0 w-full">
              <div className="flex justify-between items-start">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
              <div className="mt-8 space-y-3">
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </CardContent>
          </Card>
        )) : (<>
          <MiniStatCard label="Total units" value={stats.total} icon={<Building2 size={20} />} trend="Global" />
          <MiniStatCard label="Active Tenants" value={stats.active} icon={<ShieldCheck size={20} />} trend="Online" />
          <MiniStatCard label="Platform reach" value={tenants.reduce((acc, t) => acc + (t.userCount || 0), 0)} icon={<Users size={20} />} trend="Staff" />
          <MiniStatCard label="Inactive" value={stats.inactive} icon={<ShieldAlert size={20} />} trend="Paused" />
        </>)}
      </div>

      <div className="space-y-6">
        <div className="relative w-full lg:w-[450px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <Input
            placeholder="Search registry by name, label or slug..."
            className="pl-12 h-14 bg-white dark:bg-slate-900 border-none shadow-xl shadow-slate-200/50 dark:shadow-none rounded-2xl focus-visible:ring-[var(--brand-color)] font-medium text-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Main Table */}
        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-rose-50/50">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-6 px-10 font-bold text-slate-800 text-xs">Entity</TableHead>
                <TableHead className="font-bold text-slate-800 text-xs">Slug</TableHead>
                <TableHead className="font-bold text-slate-800 text-xs">Network</TableHead>
                <TableHead className="font-bold text-slate-800 text-xs">Status</TableHead>
                <TableHead className="font-bold text-slate-800 text-xs text-right px-10">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-48 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-24 rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTenants.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">No entities found in registry.</TableCell></TableRow>
              ) : filteredTenants.map((t) => (
                <TableRow key={t._id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50 last:border-0">
                  <TableCell className="px-10 py-6">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[var(--brand-color)] overflow-hidden">
                        {t.logo ? <img src={t.logo} alt="" className="w-full h-full object-contain p-2" /> : <Building2 size={24} />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900 text-base leading-tight">{t.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.label}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded">/{t.slug}</code>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://${t.slug}.nexa.ai`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-900 hover:text-[#ed0000] font-bold tracking-tight text-sm"
                    >
                      {t.slug}.nexa.ai
                      <ExternalLink size={12} className="text-slate-300" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "px-4 py-1.5 rounded-full border-none font-bold text-[10px] uppercase tracking-wider",
                      t.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )} variant="outline">
                      {t.isActive ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-10">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-widest transition-all border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        onClick={() => { setEditingTenant(t); setIsDrawerOpen(true); }}
                      >
                        <Pencil size={14} className="mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className={cn(
                          "rounded-xl h-10 px-6 font-bold text-[10px] uppercase tracking-widest transition-all",
                          t.isActive ? "border-slate-200 text-slate-400 hover:text-[var(--brand-color)] hover:bg-[var(--brand-color)]/5 hover:border-[var(--brand-color)]/10" : "bg-[var(--brand-color)] border-[var(--brand-color)] text-white hover:opacity-90"
                        )}
                        onClick={() => setConfirmModal({ open: true, tenant: t })}
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Add / Edit Tenant Drawer */}
      <CreateTenantDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setEditingTenant(null); }}
        onSuccess={fetchTenants}
        tenant={editingTenant}
      />

      {/* Status Confirmation Modal */}
      <AlertDialog open={confirmModal.open} onOpenChange={(o) => !o && setConfirmModal({ open: false, tenant: null })}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-[450px] p-12 bg-white animate-in zoom-in-95">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center mb-2",
              confirmModal.tenant?.isActive ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            )}>
              {confirmModal.tenant?.isActive ? <ShieldAlert size={40} /> : <ShieldCheck size={40} />}
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-2xl font-bold font-['Sen'] text-slate-900">
                {confirmModal.tenant?.isActive ? "Deactivate tenant?" : "Activate tenant?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
                {confirmModal.tenant?.isActive
                  ? `You are about to deactivate ${confirmModal.tenant.name}. This will immediately revoke core intelligence access for all associated users.`
                  : `Activating ${confirmModal.tenant?.name} will restore login capabilities and neural processing for this business unit.`
                }
              </AlertDialogDescription>
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-4 mt-10">
            <AlertDialogCancel className="rounded-2xl border-slate-100 h-14 flex-1 font-black text-slate-400 hover:bg-slate-50">Cancel Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleToggleStatus(); }}
              className={cn(
                "rounded-2xl h-14 flex-1 font-black shadow-xl",
                confirmModal.tenant?.isActive ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {confirmModal.tenant?.isActive ? "Confirm deactivation" : "Confirm activation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const MiniStatCard = ({ label, value, icon, trend }: any) => {
  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-rose-50/50 flex flex-col items-center justify-center p-8 gap-4 text-center group hover:-translate-y-1 transition-transform cursor-pointer h-full">
      <CardContent className="p-0 w-full text-left">
        <div className="flex justify-between items-start">
          <div className="w-10 h-10 rounded-xl bg-white border border-rose-100 flex items-center justify-center text-slate-400 group-hover:bg-[#ed0000] group-hover:text-white transition-all duration-500 shadow-sm">
            {icon}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full bg-white text-slate-400">
            {trend}
          </div>
        </div>
        <div className="mt-8">
          <h4 className="text-2xl font-bold text-slate-900 tracking-tighter leading-none">{value.toLocaleString()}</h4>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-3">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const CreateTenantDrawer = ({ isOpen, onClose, onSuccess, tenant }: any) => {
  const isEditing = !!tenant;
  const emptyForm = { name: '', label: '', slug: '', contactEmail: '', colorCode: '#ed0000' };
  const [formData, setFormData] = useState(emptyForm);
  const [logo, setLogo] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        label: tenant.label || '',
        slug: tenant.slug || '',
        contactEmail: tenant.contactEmail || '',
        colorCode: tenant.colorCode || '#ed0000'
      });
      setLogo(null);
    } else {
      setFormData(emptyForm);
      setLogo(null);
    }
    setError("");
  }, [tenant, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      const data = new FormData();
      data.append('name', formData.name);
      data.append('label', formData.label);
      data.append('slug', formData.slug.toLowerCase());
      data.append('contactEmail', formData.contactEmail);
      data.append('colorCode', formData.colorCode);
      if (logo) data.append('logo', logo);

      if (isEditing) {
        await axios.put(`/api/v1/provisioning/tenants/${tenant._id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({
          title: "Tenant Updated",
          description: `Successfully updated ${formData.name}.`,
        });
      } else {
        const response = await axios.post('/api/v1/provisioning/tenants', data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({
          title: "Tenant Provisioned",
          description: `Successfully added ${response.data.tenant.name} to the registry.`,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || (isEditing ? "Update failed. Please try again." : "Provisioning failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl bg-white p-0 flex flex-col border-none shadow-2xl animate-in slide-in-from-right duration-500">
        <SheetHeader className="p-12 pb-0">
          <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mb-6", isEditing ? "bg-blue-50 text-blue-600" : "bg-red-50 text-[#ed0000]")}>
            {isEditing ? <Pencil size={32} /> : <Building2 size={32} />}
          </div>
          <SheetTitle className="text-3xl font-bold font-['Sen'] text-slate-900 tracking-tight">
            {isEditing ? 'Update tenant info' : 'Add new tenant'}
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-sm font-medium mt-2 leading-relaxed">
            {isEditing ? `Editing ${tenant.name}. Update the fields below and save.` : 'Create a new business unit and configure its infrastructure.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-12 py-10 space-y-8 scrollbar-hide">
          {error && <div className="p-5 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-black uppercase tracking-wider animate-in shake">{error}</div>}

          <div className="space-y-3">
            <Label className="text-slate-700 font-medium text-sm ml-1">Entity name</Label>
            <Input
              placeholder="e.g. Grand Cereals Limited"
              className="h-12 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-medium text-slate-900 px-6"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium text-sm ml-1">Acronym / Label</Label>
              <Input
                placeholder="e.g. GCL"
                className="h-12 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-medium text-slate-900 px-6"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                required
              />
            </div>
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium text-sm ml-1">Infrastructure slug</Label>
              <div className="relative">
                <Input
                  placeholder="gcl"
                  className="h-12 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-medium text-slate-900 pl-6 pr-24 lowercase"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.replace(/\s+/g, '-').toLowerCase() })}
                  required
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px] uppercase tracking-tighter">.nexa.ai</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700 font-medium text-sm ml-1">Business email</Label>
            <Input
              type="email"
              placeholder="admin@corp.com"
              className="h-12 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-medium text-slate-900 px-6"
              value={formData.contactEmail}
              onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700 font-medium text-sm ml-1">Brand color code</Label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="#ed0000"
                  className="h-12 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-medium text-slate-900 pl-16 pr-6 uppercase"
                  value={formData.colorCode}
                  onChange={e => setFormData({ ...formData, colorCode: e.target.value })}
                />
                <div
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl border-2 border-white shadow-md cursor-pointer"
                  style={{ backgroundColor: formData.colorCode || '#ed0000' }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = formData.colorCode || '#ed0000';
                    input.addEventListener('input', (ev: any) => setFormData(prev => ({ ...prev, colorCode: ev.target.value })));
                    input.click();
                  }}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold ml-1">This color will be used as the secondary theme for their dashboard and chat interface.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700 font-medium text-sm ml-1">Brand identity</Label>
            <div className="border-2 border-dashed border-slate-100 rounded-[2.5rem] p-12 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer relative group">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                onChange={e => setLogo(e.target.files ? e.target.files[0] : null)}
              />
              {isEditing && tenant.logo && !logo ? (
                <>
                  <img src={tenant.logo} alt="Current logo" className="w-16 h-16 rounded-[1.5rem] object-contain mb-5 border border-slate-100 bg-white p-2" />
                  <p className="text-slate-900 text-sm font-medium tracking-tight">Current logo</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">Click to replace</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-[1.5rem] bg-white shadow-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud size={28} className="text-[#ed0000]" />
                  </div>
                  <p className="text-slate-900 text-sm font-medium tracking-tight">{logo ? logo.name : "Add Asset"}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">High-resolution PNG / JPG preferred</p>
                </>
              )}
            </div>
          </div>
        </form>

        <SheetFooter className="p-12 pt-8 bg-slate-50/50 space-x-6 border-t border-slate-100">
          <Button variant="ghost" className="rounded-2xl font-bold text-xs flex-1 h-11" onClick={onClose}>Cancel</Button>
          <Button
            className={cn(
              "text-white rounded-2xl font-bold text-xs flex-[2] h-11 shadow-2xl disabled:opacity-60",
              isEditing ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/40" : "bg-[#ed0000] hover:bg-[#c40000] shadow-red-500/40"
            )}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-3" size={18} /> : null}
            {isEditing
              ? (isSubmitting ? 'Updating tenant...' : 'Update tenant info')
              : (isSubmitting ? 'Adding tenant...' : 'Add tenant')
            }
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default Tenants;
