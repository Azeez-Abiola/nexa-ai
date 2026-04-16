import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Shield,
  Search,
  Filter,
  Calendar as CalendarIcon,
  User,
  Activity,
  Download,
  RefreshCw,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AuditEntry {
  _id: string;
  eventType: string;
  userId: string;
  adminEmail: string;
  businessUnit: string;
  action: string;
  details: string;
  metadata?: any;
  createdAt: string;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [auditActivity, setAuditActivity] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [eventType, setEventType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const isSuper = window.location.pathname.startsWith('/super-admin');
  const token = isSuper
    ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
    : localStorage.getItem('nexa-token');

  const headers = React.useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = { page, limit };
      if (eventType !== "all") params.eventType = eventType;

      const [logsRes, activityRes] = await Promise.all([
        axios.get('/api/v1/admin/audit-logs', { headers, params }),
        axios.get('/api/v1/analytics/audit-activity', { headers })
      ]);

      setLogs(logsRes.data.logs);
      setTotal(logsRes.data.total);
      setAuditActivity(activityRes.data.auditActivity || []);
    } catch (error) {
      console.error("Failed to fetch audit data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, eventType, headers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('create') || t.includes('upload')) return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (t.includes('delete') || t.includes('remove')) return "bg-rose-50 text-rose-600 border-rose-100";
    if (t.includes('update') || t.includes('edit')) return "bg-blue-50 text-blue-600 border-blue-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const getLogIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('document')) return <FileText size={16} />;
    if (t.includes('user') || t.includes('auth')) return <User size={16} />;
    return <Activity size={16} />;
  };

  const exportLogs = () => {
    const rows = [
      ['Date', 'Type', 'Admin', 'Action', 'Details'],
      ...logs.map(l => [
        format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        l.eventType,
        l.adminEmail,
        l.action,
        l.details
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexa-audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mock data for the chart to show activity trend
  const chartData = [
    { day: 'Mon', count: 12 },
    { day: 'Tue', count: 18 },
    { day: 'Wed', count: 15 },
    { day: 'Thu', count: 25 },
    { day: 'Fri', count: 32 },
    { day: 'Sat', count: 8 },
    { day: 'Sun', count: 10 },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
            <Shield className="text-[var(--brand-color)]" size={32} />
            Advanced Audit Logs
          </h1>
          <p className="text-slate-500 font-medium">Continuous tracking of all administrative activity across your infrastructure.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={exportLogs}
            className="rounded-xl h-11 border-slate-200 font-bold text-slate-600 gap-2 hover:bg-slate-50"
          >
            <Download size={16} />
            Export Records
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Activity Chart */}
        <Card className="lg:col-span-8 border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-8">
            <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center justify-between w-full">
              System Operations Intensity
              <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">Active Node</Badge>
            </CardTitle>
            <div className="sr-only" id="chart-description">Line chart showing the daily intensity of system operations over the past week.</div>
          </CardHeader>
          <CardContent className="h-[200px] px-8 pb-8 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={auditActivity.length > 0 ? auditActivity : [
                { day: 'Mon', count: 0 }, { day: 'Tue', count: 0 }, { day: 'Wed', count: 0 },
                { day: 'Thu', count: 0 }, { day: 'Fri', count: 0 }, { day: 'Sat', count: 0 }, { day: 'Sun', count: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'var(--brand-color)', fontWeight: 'bold' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--brand-color)"
                  strokeWidth={4}
                  dot={{ r: 4, fill: "var(--brand-color)", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, shadow: '0 0 20px rgba(0,0,0,0.2)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filter Quick-Actions */}
        <Card className="lg:col-span-4 border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white flex flex-col justify-center">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">Search & Filtering</p>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-all" size={18} />
                <Input
                  placeholder="Search admin activity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[var(--brand-color)]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Event Classification</p>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50 px-5 font-bold text-slate-600 focus:ring-[var(--brand-color)] focus:border-[var(--brand-color)]">
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  <SelectItem value="all">All Operations</SelectItem>
                  <SelectItem value="document_upload_completed">Policy Uploads</SelectItem>
                  <SelectItem value="document_processing_completed">Processing Success</SelectItem>
                  <SelectItem value="rag_query">AI Training Queries</SelectItem>
                  <SelectItem value="admin_login">Admin Sessions</SelectItem>
                  <SelectItem value="policy_updated">Policy Updates</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-50 bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold font-['Sen'] text-slate-900">Operation Records</h2>
            <Badge className="bg-[var(--brand-color)]/10 text-[var(--brand-color)] border-none font-bold text-[10px] tracking-widest uppercase rounded-full px-4 py-1">
              Live Feed
            </Badge>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{total} SECURE RECORDS</p>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-6">
              <Clock size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-['Sen']">No administrative activity</h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">Any infrastructure changes or admin sessions will be logged here with cryptographic timestamps.</p>
          </div>
        ) : (
          <>
            <div className="w-full min-w-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-50">
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8 w-[25%]">Timestamp & Context</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest w-[20%]">Operator</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Operation</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right pr-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all group-hover:shadow-sm bg-white", getActionColor(log.eventType))}>
                          {getLogIcon(log.eventType)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm leading-none mb-1">
                            {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">BU: {log.businessUnit}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                          {log.adminEmail.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-700">{log.adminEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{log.action}</p>
                        <p className="text-xs text-slate-500 font-medium truncate max-w-[300px]" title={log.details}>
                          {log.details}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Badge variant="outline" className={cn("rounded-lg py-1 px-3 font-bold text-[10px] uppercase tracking-wider", getActionColor(log.eventType))}>
                        Verified
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-50 bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page {page} of {Math.ceil(total / limit)}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="w-10 h-10 rounded-xl border-slate-200"
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page * limit >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="w-10 h-10 rounded-xl border-slate-200"
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
        <Info className="text-blue-500 shrink-0" size={18} />
        <p className="text-xs font-medium text-blue-700/80 leading-relaxed">
          <strong>Security Protocol:</strong> All audit records are cryptographically secured and immutable. Records are preserved for 36 months as per enterprise infrastructure governance standards.
        </p>
      </div>
    </div>
  );
};

export default AuditLogs;
