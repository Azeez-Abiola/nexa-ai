import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle,
  Globe,
  Building2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Loader2,
  X,
  Mail,
  CheckCircle,
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const EmailDomains: React.FC = () => {
  const [domains, setDomains] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ domain: "", businessUnit: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDomains();
    fetchBusinessUnits();
  }, []);

  const fetchDomains = async () => {
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      const { data } = await axios.get('/api/v1/admin/auth/email-domains', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDomains(data.domains || []);
    } catch (error) {
      console.error('Failed to fetch domains', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBusinessUnits = async () => {
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      const { data } = await axios.get('/api/v1/analytics/business-units-list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinessUnits(data.businessUnits || []);
    } catch (error) {
      console.error('Failed to fetch BUs', error);
    }
  };

  const handleAddMapping = async () => {
    if (!newMapping.domain || !newMapping.businessUnit) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      await axios.post('/api/v1/admin/auth/email-domains', newMapping, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDomains();
      setIsModalOpen(false);
      setNewMapping({ domain: "", businessUnit: "" });
    } catch (error) {
      console.error('Mapping creation failed', error);
      alert('Failed to create mapping. Domain might already be assigned.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Are you certain you want to revoke this domain protocol?')) return;
    try {
      const token = localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token');
      await axios.delete(`/api/v1/admin/auth/email-domains/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDomains();
    } catch (error) {
      console.error('Deletion failed', error);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-['Sen']">Domain protocols</h2>
          <p className="text-slate-400 font-medium mt-1 text-sm">Verify and route identities based on corporate email infrastructure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              const rows = [['Domain','Mapped Business Unit'], ...domains.map((d: any) => [d.domain, d.businessUnit])];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexa-domains-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-12 px-5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <Download size={14} />
            Export CSV
          </button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-2xl h-12 px-6 shadow-xl shadow-red-500/20 flex items-center gap-2 group font-bold transition-all hover:scale-[1.02]"
          >
            <PlusCircle size={20} />
            Register domain
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Helper Card */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] p-8 bg-slate-900 text-white overflow-hidden relative h-full">
            <div className="relative z-10 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center">
                <ShieldCheck size={24} className="text-rose-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold font-['Sen'] leading-tight">Identity routing</h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed">
                  Auto-assign users to specific business units by mapping their corporate email domains to regional nodes.
                </p>
              </div>
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-[11px] font-bold text-slate-300">Automated verification</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-[11px] font-bold text-slate-300">Zero-trust routing</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Data Table */}
        <div className="lg:col-span-3">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-rose-50/50">
            <Table>
              <TableHeader className="bg-white/50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-6 px-10 font-bold text-slate-800 text-xs">Infrastructure domain</TableHead>
                  <TableHead className="font-bold text-slate-800 text-xs">Mapped unit</TableHead>
                  <TableHead className="font-bold text-slate-800 text-xs text-right px-10">Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                [1,2,3,4].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48 rounded-lg ml-10" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded-xl ml-auto mr-10" /></TableCell>
                  </TableRow>
                ))
              ) : domains.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">No domains mapped in registry.</TableCell></TableRow>
                ) : domains.map((d) => (
                  <TableRow key={d._id} className="hover:bg-white/40 transition-colors group">
                    <TableCell className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                          <Globe size={16} />
                        </div>
                        <span className="font-bold text-slate-900">{d.domain}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-white text-slate-600 border-none font-bold px-4 py-1.5 rounded-xl text-[10px] shadow-sm">
                        {d.businessUnit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-xl text-slate-300 hover:text-red-600 hover:bg-white transition-all"
                        onClick={() => handleDeleteMapping(d._id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] border-l-slate-100 p-0 overflow-hidden flex flex-col bg-white animate-in slide-in-from-right duration-500">
          <div className="p-12 pb-8 space-y-6">
            <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#ed0000]">
              <Globe size={32} />
            </div>
            <div>
              <SheetTitle className="text-2xl font-bold font-['Sen'] text-slate-900">Add domain mapping</SheetTitle>
              <SheetDescription className="text-slate-400 font-medium text-sm mt-2 leading-relaxed">
                Map a corporate domain to its business unit.
              </SheetDescription>
            </div>

            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <Label className="text-slate-700 font-medium text-sm ml-1">Work domain</Label>
                <Input
                  placeholder="e.g. corp.com"
                  className="h-14 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-bold text-slate-900 px-6 lowercase"
                  value={newMapping.domain}
                  onChange={e => setNewMapping({ ...newMapping, domain: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-700 font-medium text-sm ml-1">Destination unit</Label>
                <select
                  className="w-full h-14 rounded-2xl border-none bg-slate-50 focus-visible:ring-[#ed0000] font-bold text-slate-900 px-6 appearance-none cursor-pointer"
                  value={newMapping.businessUnit}
                  onChange={e => setNewMapping({ ...newMapping, businessUnit: e.target.value })}
                >
                  <option value="">Select unit architecture...</option>
                  {businessUnits.map(bu => (
                    <option key={bu._id} value={bu.name}>{bu.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-auto p-10 bg-slate-50/50 flex gap-4 border-t border-slate-100">
            <Button variant="ghost" className="flex-1 rounded-2xl h-12 font-bold text-xs" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              className="flex-[2] rounded-2xl h-12 bg-[#ed0000] hover:bg-[#c40000] text-white font-bold text-xs shadow-xl shadow-red-500/20 disabled:opacity-60"
              onClick={handleAddMapping}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
              {isSubmitting ? 'Adding...' : 'Add mapping'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EmailDomains;
