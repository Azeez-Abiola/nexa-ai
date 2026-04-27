import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cn } from '@/lib/utils';
import {
  Building2,
  Search,
  ChevronRight,
  Users,
  MessageSquare,
  Files,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Layers,
  PlusCircle,
  Download,
  UserPlus
} from 'lucide-react';
import InviteAdminSheet from '../components/InviteAdminSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export type DirectoryProps = {
  /** When true, directory is shown inside Tenants (e.g. second tab). */
  embedded?: boolean;
  /** Open parent tenant add flow instead of navigating away. */
  onRequestAddTenant?: () => void;
};

const Directory: React.FC<DirectoryProps> = ({ embedded = false, onRequestAddTenant }) => {
  const navigate = useNavigate();
  const [bus, setBus] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBU, setSelectedBU] = useState<string | null>(null);
  const [buDetails, setBuDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [inviteAdminOpen, setInviteAdminOpen] = useState(false);
  const [inviteAdminBu, setInviteAdminBu] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchBUs();
  }, []);

  const fetchBUs = async () => {
    try {
      const { data } = await axios.get('/api/v1/public/business-unit-names');
      setBus(data.names || []);
    } catch (error) {
      console.error('Failed to fetch BUs', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBUDetails = async (name: string) => {
    setSelectedBU(name);
    setBuDetails(null);
    setIsDetailLoading(true);
    try {
      const isSuperCtx = window.location.pathname.startsWith('/super-admin');
      const token = isSuperCtx
        ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
        : localStorage.getItem('nexa-token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch stats for this BU from the analytics endpoint
      const { data: distData } = await axios.get('/api/v1/analytics/business-units', { headers });
      const stats = (distData.stats || []).find((s: any) => s.name === name) || { users: 0, policies: 0, conversations: 0 };

      // Fetch staff/admins for this BU
      const [adminsRes, usersRes] = await Promise.all([
        axios.get('/api/v1/admin/auth/admins', { headers }),
        axios.get(`/api/v1/admin/auth/users?businessUnit=${encodeURIComponent(name)}`, { headers })
      ]);

      setBuDetails({
        stats,
        admins: (adminsRes.data.admins || []).filter((a: any) => a.businessUnit === name),
        users: usersRes.data.users || []
      });
    } catch (error) {
      console.error('Failed to fetch BU details', error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const filteredBUs = bus.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()));

  if (selectedBU) {
    if (isDetailLoading) {
      return (
        <div className="min-w-0 max-w-full space-y-8 animate-in fade-in duration-500">
          <Skeleton className="h-8 w-48 rounded-lg" />

          <div className="flex items-center gap-5">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="border-slate-200 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-7 w-12 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1, 2].map(i => (
              <Card key={i} className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                  <Skeleton className="h-4 w-40 rounded" />
                </CardHeader>
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="flex items-center justify-between py-2">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-3 w-44 rounded" />
                      </div>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0 max-w-full space-y-8 animate-in slide-in-from-right-4 duration-300">
        <Button
          variant="ghost"
          onClick={() => setSelectedBU(null)}
          className="group text-slate-500 hover:text-slate-900 font-bold -ml-2"
        >
          <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          {embedded ? 'Back to list' : 'Back to Directory'}
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[#ed0000] flex items-center justify-center text-white shadow-xl shadow-red-900/10 border-4 border-white">
              <Building2 size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-black font-['Sen'] text-slate-900">{selectedBU}</h2>
                <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] mt-1 tracking-widest uppercase">Verified</Badge>
              </div>
              <p className="text-slate-400 font-medium">Core business unit profile and performance monitoring</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setInviteAdminBu(selectedBU || undefined);
              setInviteAdminOpen(true);
            }}
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-xl h-11 px-6 shadow-lg shadow-red-900/10 flex items-center gap-2 group font-bold w-fit"
          >
            <UserPlus size={18} />
            Invite admin
          </Button>
        </div>

        <InviteAdminSheet
          isOpen={inviteAdminOpen}
          onClose={() => setInviteAdminOpen(false)}
          onSuccess={() => fetchBUDetails(selectedBU!)}
          defaultBusinessUnit={inviteAdminBu}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileStatCard value={buDetails.stats.users} label="Individual users" icon={<Users size={16} />} color="blue" />
          <ProfileStatCard value={buDetails.stats.conversations} label="Chat sessions" icon={<MessageSquare size={16} />} color="red" />
          <ProfileStatCard value={buDetails.stats.policies} label="Uploaded documents" icon={<Files size={16} />} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <ShieldCheck size={16} className="text-[#ed0000]" />
                Designated administrators
              </CardTitle>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{buDetails.admins.length} total</span>
            </CardHeader>
            <Table>
              <TableBody>
                {buDetails.admins.length === 0 ? (
                  <TableRow><TableCell className="text-center py-12 text-slate-400 font-medium italic">No administrators assigned to this unit.</TableCell></TableRow>
                ) : buDetails.admins.map((a: any) => (
                  <TableRow key={a._id}>
                    <TableCell>
                      <p className="font-bold text-slate-800">{a.fullName}</p>
                      <p className="text-xs text-slate-400 font-medium">{a.email}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-400 border-slate-200">Admin</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <Layers size={16} className="text-[#ed0000]" />
                Recent staff activity
              </CardTitle>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{buDetails.users.length} records</span>
            </CardHeader>
            <Table>
              <TableBody>
                {buDetails.users.length === 0 ? (
                  <TableRow><TableCell className="text-center py-12 text-slate-400 font-medium italic">No staff activity reported yet.</TableCell></TableRow>
                ) : buDetails.users.slice(0, 10).map((u: any) => (
                  <TableRow key={u._id}>
                    <TableCell>
                      <p className="font-bold text-slate-800">{u.fullName}</p>
                      <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 italic">User Profile</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black font-['Sen']">Registered business units</h2>
          <p className="text-slate-400 font-medium">Directory of all business units currently integrated into Nexa AI.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const rows = [['Business Unit', 'Status'], ...bus.map(b => [b, 'Active'])];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexa-directory-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-11 px-5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <Download size={14} />
            Export CSV
          </button>
          <Button
            variant="outline"
            onClick={() => {
              setInviteAdminBu(undefined);
              setInviteAdminOpen(true);
            }}
            className="rounded-xl h-11 px-5 border-slate-200 bg-white text-slate-700 hover:border-[#ed0000]/40 hover:text-[#ed0000] flex items-center gap-2 font-bold"
          >
            <UserPlus size={18} />
            Invite admin
          </Button>
          <Button
            onClick={() => {
              if (embedded) onRequestAddTenant?.();
              else navigate('/super-admin/tenants');
            }}
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-xl h-11 px-6 shadow-2xl shadow-red-500/30 flex items-center gap-3 group font-bold transition-all hover:-translate-y-1"
          >
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Add tenant
          </Button>
        </div>
      </div>
      <div className="relative w-full md:w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Search directory..."
          className="h-12 pl-10 bg-white border-slate-200 rounded-xl focus:ring-[#ed0000]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i} className="border-slate-200 overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <Skeleton className="w-4 h-4 rounded" />
                  </div>
                  <Skeleton className="h-6 w-32 rounded-lg mb-2" />
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBUs.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-medium">No business units match your search.</div>
          ) : filteredBUs.map((bu) => (
            <Card
              key={bu}
              onClick={() => fetchBUDetails(bu)}
              className="cursor-pointer border-slate-200 hover:border-[#ed0000]/30 hover:shadow-xl hover:shadow-red-900/5 transition-all group overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-[#ed0000] border border-slate-100 group-hover:bg-[#ed0000] group-hover:text-white group-hover:border-[#ed0000] transition-all duration-300">
                      <Building2 size={24} />
                    </div>
                    <ChevronRight size={18} className="text-slate-200 group-hover:text-[#ed0000] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 tracking-tight mb-1">{bu}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-500 transition-colors">Registered Business Unit</p>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    STATUS: ACTIVE
                  </div>
                  <div className="flex items-center gap-1 italic">
                    <Calendar size={10} />
                    PORTAL SYNCED
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InviteAdminSheet
        isOpen={inviteAdminOpen}
        onClose={() => setInviteAdminOpen(false)}
        onSuccess={fetchBUs}
        defaultBusinessUnit={inviteAdminBu}
      />
    </div>
  );
};

const ProfileStatCard = ({ value, label, icon, color }: any) => {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-500",
    red: "bg-red-50 text-[#ed0000]",
    emerald: "bg-emerald-50 text-emerald-500"
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", colorMap[color])}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{value.toLocaleString()}</h4>
        </div>
      </CardContent>
    </Card>
  );
};

export default Directory;
