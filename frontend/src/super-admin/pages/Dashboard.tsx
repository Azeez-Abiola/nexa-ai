import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import {
  Users,
  MessageSquare,
  Building,
  Files,
  ShieldAlert,
  ArrowUpRight,
  UserPlus,
  Calendar as CalendarIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, startOfDay, isValid, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  totalConversations: number;
  totalDocs: number;
  totalTenants: number;
}

const Loader2 = ({ className, size }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const StatCard = ({ title, value, icon, trend, isLoading }: any) => {
  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white flex flex-col items-center justify-center p-8 gap-4 text-center group hover:-translate-y-1 transition-transform cursor-pointer border border-slate-50">
      <CardContent className="p-0 w-full text-left">
        <div className="flex justify-between items-start">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[var(--brand-color)] group-hover:text-white transition-all duration-500 shadow-sm">
            {icon}
          </div>
          {isLoading ? <Skeleton className="h-6 w-12 rounded-full" /> : (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full",
              trend === "Stable" ? "bg-slate-50 text-slate-400" : "bg-emerald-50 text-emerald-600"
            )}>
              {trend !== "Stable" && <ArrowUpRight size={10} />}
              {trend}
            </div>
          )}
        </div>
        <div className="mt-8">
          {isLoading ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-950 tracking-tight leading-none">{value.toLocaleString()}</h3>
          )}
          <p className="text-[11px] text-slate-400 font-medium mt-3 leading-relaxed uppercase tracking-wider">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const MonthGrid = ({ selectedDate, onSelect, currentMonth, onMonthChange }: any) => {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const startOfSelectedMonth = startOfMonth(currentMonth);
  const endOfSelectedMonth = endOfMonth(currentMonth);

  const daysInMonth = eachDayOfInterval({
    start: startOfSelectedMonth,
    end: endOfSelectedMonth
  });

  return (
    <div className="p-4 bg-white border border-slate-100 shadow-2xl rounded-2xl w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-xs font-bold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((d, i) => (
          <div key={`${d}-${i}`} className="text-[10px] font-bold text-slate-300 text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(day)}
            className={cn(
              "h-8 w-8 text-[11px] font-bold rounded-lg transition-all",
              isSameDay(day, selectedDate)
                ? "bg-[var(--brand-color)] text-white shadow-lg shadow-[var(--brand-color)]/20"
                : "text-slate-600 hover:bg-slate-50 hover:text-[var(--brand-color)]"
            )}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [buDistribution, setBuDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isSuperAdminContext = window.location.pathname.startsWith('/super-admin');

  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Use the correct token based on context
        const token = isSuperAdminContext
          ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
          : localStorage.getItem('nexa-token');
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, activityRes, distRes] = await Promise.all([
          axios.get('/api/v1/analytics/dashboard', { headers }),
          axios.get('/api/v1/analytics/chat-activity', { headers }),
          axios.get(isSuperAdminContext ? '/api/v1/analytics/business-units' : '/api/v1/analytics/top-users', { headers })
        ]);

        setStats(statsRes.data);
        setActivityData(activityRes.data.dailyActivity || []);
        setBuDistribution(isSuperAdminContext ? (distRes.data.stats || []) : (distRes.data.topUsers || []));
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);


  const COLORS = ['var(--brand-color)', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  const exportDashboardCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Users', stats?.totalUsers || 0],
      ['Total Conversations', stats?.totalConversations || 0],
      ['Total Documents', stats?.totalDocs || 0],
      ['Total Tenants', stats?.totalTenants || 0],
      ['Total Admins', stats?.totalAdmins || 0],
      ...buDistribution.map((bu: any) => [bu.name, bu.conversations]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexa-dashboard-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-['Sen']">Dashboard</h2>
          <p className="text-slate-400 font-medium mt-1 text-sm">Real-time platform intelligence.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportDashboardCSV}
            className="h-11 px-5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <Download size={14} />
            Export CSV
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="text"
              placeholder="Search metrics..."
              className="pl-10 h-11 bg-slate-50 border-none rounded-xl text-xs font-bold w-[250px] focus:ring-2 focus:ring-[var(--brand-color)]/10 transition-all focus:bg-white focus:shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-6",
        isSuperAdminContext ? "lg:grid-cols-5" : "lg:grid-cols-4"
      )}>
        {isLoading ? [1, 2, 3, 4, isSuperAdminContext && 5].filter(Boolean).map((i: any) => (
          <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-8 border border-slate-50">
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
          <StatCard title="Platform users" value={stats?.totalUsers || 0} icon={<Users size={20} />} trend="+12.5%" isLoading={false} />
          <StatCard title="System chats" value={stats?.totalConversations || 0} icon={<MessageSquare size={20} />} trend="+5.2%" isLoading={false} />
          <StatCard title="Knowledge docs" value={stats?.totalDocs || 0} icon={<Files size={20} />} trend="+89" isLoading={false} />
          {isSuperAdminContext && <StatCard title="Business units" value={stats?.totalTenants || 0} icon={<Building size={20} />} trend="Stable" isLoading={false} />}
          <StatCard title="Admins" value={stats?.totalAdmins || 0} icon={<UserPlus size={20} />} trend="+2" isLoading={false} />
        </>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
            <CardHeader className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold text-slate-900 tracking-tight font-['Sen']">User engagement</CardTitle>
                <p className="text-xs text-slate-400 font-medium tracking-wide">Daily volume across infrastructure nodes</p>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100 relative">
                <button
                  onClick={() => setShowPicker(showPicker === 'start' ? null : 'start')}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">From:</span>
                  <span className="text-[11px] font-bold text-slate-800">{format(parseISO(dateRange.start), 'MMM d, yyyy')}</span>
                </button>

                <div className="w-px h-4 bg-slate-200" />

                <button
                  onClick={() => setShowPicker(showPicker === 'end' ? null : 'end')}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">To:</span>
                  <span className="text-[11px] font-bold text-slate-800">{format(parseISO(dateRange.end), 'MMM d, yyyy')}</span>
                </button>

                {showPicker && (
                  <div className="absolute top-full mt-2 right-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <MonthGrid
                      selectedDate={parseISO(showPicker === 'start' ? dateRange.start : dateRange.end)}
                      currentMonth={currentMonth}
                      onMonthChange={setCurrentMonth}
                      onSelect={(date: Date) => {
                        const formatted = format(date, 'yyyy-MM-dd');
                        setDateRange({ ...dateRange, [showPicker]: formatted });
                        setShowPicker(null);
                      }}
                    />
                  </div>
                )}

                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 px-4 text-[10px] font-bold shadow-lg active:scale-95 transition-all">
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-[350px] p-8 pt-0">
              {isLoading ? (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-end gap-2 h-full">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${Math.random() * 80 + 20}%` }} />)}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="_id"
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dx={-10} />
                    <Tooltip
                      cursor={{ fill: 'var(--brand-color)', opacity: 0.05 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px' }}
                      itemStyle={{ color: 'var(--brand-color)', fontWeight: 'bold', fontSize: '11px' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--brand-color)"
                      radius={[6, 6, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-12 xl:col-span-5">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden h-full bg-white">
            <CardHeader className="p-8">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight font-['Sen']">
                {isSuperAdminContext ? 'Architecture utilization' : 'Top User Engagement'}
              </h3>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                {isSuperAdminContext ? 'System engagement distribution by unit' : 'Activity volume by unique infrastructure users'}
              </p>
            </CardHeader>
            <CardContent className="px-8 pb-10 flex flex-col items-center">
              <div className="relative w-full h-[220px]">
                {isLoading ? (
                  <div className="w-full h-full rounded-full border-8 border-slate-50 animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={buDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="conversations"
                        nameKey="name"
                        animationDuration={1500}
                      >
                        {buDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {!isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-slate-900 leading-none">100%</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status</span>
                  </div>
                )}
              </div>

              <div className="w-full mt-8 space-y-3 overflow-y-auto max-h-[220px] pr-2 scrollbar-hide">
                {isLoading ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />) : buDistribution.map((bu, idx) => (
                  <div key={bu.name} className="flex items-center justify-between group/item p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-xs text-slate-700 font-bold">{bu.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-bold text-slate-900">{bu.conversations.toLocaleString()}</span>
                      <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand-color)]"
                          style={{ width: `${Math.min(100, (bu.conversations / 1000) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
