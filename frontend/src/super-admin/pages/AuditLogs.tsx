import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Shield,
  Search,
  User,
  Activity,
  Download,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  CalendarDays,
  X
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfToday, endOfToday, startOfYesterday, endOfYesterday } from 'date-fns';
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
  userId?: string;
  adminId?: string;
  adminEmail?: string;
  businessUnit: string;
  action: string;
  details: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

const PRESET_LABELS: Record<DatePreset, string> = {
  all: 'All time',
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom range',
};

const EMPTY_CHART = [
  { day: 'Mon', count: 0 }, { day: 'Tue', count: 0 }, { day: 'Wed', count: 0 },
  { day: 'Thu', count: 0 }, { day: 'Fri', count: 0 }, { day: 'Sat', count: 0 }, { day: 'Sun', count: 0 }
];

function presetToRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfToday().toISOString(), to: endOfToday().toISOString() };
    case 'yesterday':
      return { from: startOfYesterday().toISOString(), to: endOfYesterday().toISOString() };
    case '7d':
      return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() };
    case '30d':
      return { from: startOfDay(subDays(now, 29)).toISOString(), to: endOfDay(now).toISOString() };
    default:
      return {};
  }
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [auditActivity, setAuditActivity] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [eventType, setEventType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  // Reset page when any filter changes
  useEffect(() => { setPage(1); }, [eventType, datePreset, customFrom, customTo]);

  const isSuper = window.location.pathname.startsWith('/super-admin');
  const token = isSuper
    ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
    : localStorage.getItem('nexa-token');
  const headers = React.useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = { page, limit };
      if (eventType !== 'all') params.eventType = eventType;
      if (debouncedSearch) params.search = debouncedSearch;

      if (datePreset === 'custom') {
        if (customFrom) params.from = new Date(customFrom).toISOString();
        if (customTo) params.to = endOfDay(new Date(customTo)).toISOString();
      } else if (datePreset !== 'all') {
        const { from, to } = presetToRange(datePreset);
        if (from) params.from = from;
        if (to) params.to = to;
      }

      const [logsRes, activityRes] = await Promise.all([
        axios.get('/api/v1/admin/audit-logs', { headers, params }),
        axios.get('/api/v1/analytics/audit-activity', { headers })
      ]);

      setLogs(logsRes.data.logs ?? []);
      setTotal(logsRes.data.total ?? 0);
      setAuditActivity(activityRes.data.auditActivity ?? []);
    } catch (error) {
      console.error('Failed to fetch audit data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, eventType, debouncedSearch, datePreset, customFrom, customTo, headers]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearFilters = () => {
    setEventType('all');
    setSearchQuery('');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  };

  const hasActiveFilters = eventType !== 'all' || debouncedSearch || datePreset !== 'all';

  const getActionColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('login')) return 'bg-violet-50 text-violet-600 border-violet-100';
    if (t.includes('logout')) return 'bg-orange-50 text-orange-600 border-orange-100';
    if (t.includes('create') || t.includes('upload')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (t.includes('delete') || t.includes('remove')) return 'bg-rose-50 text-rose-600 border-rose-100';
    if (t.includes('update') || t.includes('edit')) return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getLogIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('login')) return <LogIn size={16} />;
    if (t.includes('logout')) return <LogOut size={16} />;
    if (t.includes('document')) return <FileText size={16} />;
    if (t.includes('user') || t.includes('auth')) return <User size={16} />;
    return <Activity size={16} />;
  };

  const exportLogs = () => {
    const rows = [
      ['Date', 'Time', 'Type', 'Operator', 'Business Unit', 'Action', 'Details'],
      ...logs.map(l => [
        format(new Date(l.createdAt), 'yyyy-MM-dd'),
        format(new Date(l.createdAt), 'HH:mm:ss'),
        l.eventType,
        l.adminEmail ?? '',
        l.businessUnit,
        l.action,
        l.details
      ])
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexa-audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-w-0 max-w-full space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
            <Shield className="text-[var(--brand-color)]" size={32} />
            Audit Logs
          </h1>
          <p className="text-slate-500 font-medium">Continuous tracking of all administrative activity across your infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="rounded-xl h-11 border-slate-200 font-bold text-slate-500 gap-2 hover:bg-slate-50"
            >
              <X size={15} />
              Clear filters
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportLogs}
            className="rounded-xl h-11 border-slate-200 font-bold text-slate-600 gap-2 hover:bg-slate-50"
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Chart + Filters row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Activity Chart */}
        <Card className="lg:col-span-8 border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-8">
            <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center justify-between w-full">
              System Operations — Last 7 Days
              <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">Active Node</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] px-8 pb-8 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={auditActivity.length > 0 ? auditActivity : EMPTY_CHART}>
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
                  dot={{ r: 4, fill: 'var(--brand-color)', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filters panel */}
        <Card className="lg:col-span-4 border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-8 space-y-5">
            {/* Search */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Search</p>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-all" size={16} />
                <Input
                  placeholder="Email, action, details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-11 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[var(--brand-color)]/10 transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Event type */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Type</p>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="h-11 rounded-xl border-slate-100 bg-slate-50 px-4 font-bold text-slate-600 text-sm focus:ring-[var(--brand-color)] focus:border-[var(--brand-color)]">
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  <SelectItem value="all">All Operations</SelectItem>
                  <SelectItem value="admin_login">Admin Login</SelectItem>
                  <SelectItem value="admin_logout">Admin Logout</SelectItem>
                  <SelectItem value="user_login">User Login</SelectItem>
                  <SelectItem value="user_logout">User Logout</SelectItem>
                  <SelectItem value="document_upload_completed">Document Uploads</SelectItem>
                  <SelectItem value="document_processing_completed">Processing Success</SelectItem>
                  <SelectItem value="rag_query">AI Queries</SelectItem>
                  <SelectItem value="policy_updated">Policy Updates</SelectItem>
                  <SelectItem value="user_created">User Created</SelectItem>
                  <SelectItem value="user_deleted">User Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date / time */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <CalendarDays size={12} />
                Date & Time
              </p>
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-100 bg-slate-50 px-4 font-bold text-slate-600 text-sm focus:ring-[var(--brand-color)] focus:border-[var(--brand-color)]">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  {(Object.keys(PRESET_LABELS) as DatePreset[]).map(k => (
                    <SelectItem key={k} value={k}>{PRESET_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {datePreset === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">From</p>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)]/20 focus:border-[var(--brand-color)]"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">To</p>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={e => setCustomTo(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)]/20 focus:border-[var(--brand-color)]"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active filters:</span>
          {eventType !== 'all' && (
            <Badge variant="outline" className="rounded-full text-[10px] font-bold bg-[var(--brand-color)]/5 text-[var(--brand-color)] border-[var(--brand-color)]/20 px-3">
              {eventType.replace(/_/g, ' ')}
            </Badge>
          )}
          {datePreset !== 'all' && (
            <Badge variant="outline" className="rounded-full text-[10px] font-bold bg-violet-50 text-violet-600 border-violet-100 px-3 flex items-center gap-1">
              <CalendarDays size={10} />
              {datePreset === 'custom' && customFrom && customTo
                ? `${customFrom} → ${customTo}`
                : PRESET_LABELS[datePreset]}
            </Badge>
          )}
          {debouncedSearch && (
            <Badge variant="outline" className="rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200 px-3">
              "{debouncedSearch}"
            </Badge>
          )}
        </div>
      )}

      {/* Logs table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-50 bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold font-['Sen'] text-slate-900">Operation Records</h2>
            <Badge className="bg-[var(--brand-color)]/10 text-[var(--brand-color)] border-none font-bold text-[10px] tracking-widest uppercase rounded-full px-4 py-1">
              Live Feed
            </Badge>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{total.toLocaleString()} RECORDS</p>
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
            <h3 className="text-xl font-bold text-slate-900 font-['Sen']">No activity found</h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">
              {hasActiveFilters
                ? 'No records match the current filters. Try adjusting the date range or event type.'
                : 'Any infrastructure changes or login sessions will be logged here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="w-full min-w-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-50">
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8 w-[28%]">Date & Time</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest w-[22%]">Operator</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Operation</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right pr-8">Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ts = new Date(log.createdAt);
                    const operatorEmail = log.adminEmail ?? '—';
                    const operatorInitial = operatorEmail !== '—' ? operatorEmail.charAt(0).toUpperCase() : '?';
                    return (
                      <TableRow key={log._id} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                        <TableCell className="pl-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center transition-all group-hover:shadow-sm bg-white shrink-0', getActionColor(log.eventType))}>
                              {getLogIcon(log.eventType)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm leading-none mb-1">
                                {format(ts, 'MMM d, yyyy')}
                              </p>
                              <p className="text-[11px] font-bold text-slate-400 tabular-nums">
                                {format(ts, 'HH:mm:ss')}
                              </p>
                              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-tighter mt-0.5">
                                {log.businessUnit}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px] shrink-0">
                              {operatorInitial}
                            </div>
                            <span className="text-xs font-bold text-slate-700 break-all">{operatorEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{log.action}</p>
                            <p className="text-xs text-slate-500 font-medium truncate max-w-[280px]" title={log.details}>
                              {log.details}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Badge variant="outline" className={cn('rounded-lg py-1 px-3 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap', getActionColor(log.eventType))}>
                            {log.eventType.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-50 bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" disabled={page === 1}
                  onClick={() => setPage(p => p - 1)} className="w-10 h-10 rounded-xl border-slate-200">
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="outline" size="icon" disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)} className="w-10 h-10 rounded-xl border-slate-200">
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default AuditLogs;
