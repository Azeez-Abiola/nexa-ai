import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format, subDays } from "date-fns";
import { BarChart3, Users, MessageSquare, Files, Building2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
} from "recharts";

type DashboardPayload = {
  totalUsers: number;
  totalAdmins: number;
  totalConversations: number;
  totalPolicies: number;
  totalTenants: number;
  totalDocs: number;
  usersWhoChatted: number;
  scope?: string;
};

type DailyPoint = { _id: string; count: number };
type AuditPoint = { day: string; count: number; date: string };
type BuStat = { name: string; users: number; admins: number; policies: number; conversations: number };
type TopUser = { name: string; email: string; conversations: number };

const POLL_MS = 15000;
const CHART_COLORS = ["var(--brand-color)", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

const Analytics: React.FC = () => {
  const isSuper = window.location.pathname.startsWith("/super-admin");
  const [stats, setStats] = useState<DashboardPayload | null>(null);
  const [chatSeries, setChatSeries] = useState<DailyPoint[]>([]);
  const [auditSeries, setAuditSeries] = useState<AuditPoint[]>([]);
  const [buStats, setBuStats] = useState<BuStat[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const authHeaders = useCallback(() => {
    const token = isSuper
      ? localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token")
      : localStorage.getItem("nexa-token");
    return { Authorization: `Bearer ${token}` };
  }, [isSuper]);

  const fetchAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent;
      if (!silent) setLoading(true);
      const headers = authHeaders();
      const end = format(new Date(), "yyyy-MM-dd");
      const start = format(subDays(new Date(), 29), "yyyy-MM-dd");
      try {
        const chatUrl = `/api/v1/analytics/chat-activity?startDate=${start}&endDate=${end}`;
        const reqs: Promise<{ data: unknown }>[] = [
          axios.get<DashboardPayload>("/api/v1/analytics/dashboard", { headers }),
          axios.get<{ dailyActivity: DailyPoint[] }>(chatUrl, { headers }),
          axios.get<{ auditActivity: AuditPoint[] }>("/api/v1/analytics/audit-activity", { headers })
        ];
        if (isSuper) {
          reqs.push(axios.get<{ stats: BuStat[] }>("/api/v1/analytics/business-units", { headers }));
        } else {
          reqs.push(axios.get<{ topUsers: TopUser[] }>("/api/v1/analytics/top-users?limit=8", { headers }));
        }
        const results = await Promise.all(reqs);
        const dash = results[0].data as DashboardPayload;
        const chat = results[1].data as { dailyActivity: DailyPoint[] };
        const audit = results[2].data as { auditActivity: AuditPoint[] };
        setStats(dash);
        setChatSeries(chat.dailyActivity || []);
        setAuditSeries(audit.auditActivity || []);
        if (isSuper) {
          const bu = results[3].data as { stats: BuStat[] };
          setBuStats(bu.stats || []);
        } else {
          const tu = results[3].data as { topUsers: TopUser[] };
          setTopUsers(tu.topUsers || []);
        }
        setLastUpdated(new Date());
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [authHeaders, isSuper]
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchAll({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  const overviewPie = useMemo(() => {
    if (!stats) return [];
    const rows = [
      { name: "Directory users", value: stats.totalUsers },
      { name: "Members using AI", value: stats.usersWhoChatted },
      { name: "Knowledge policies", value: stats.totalDocs }
    ];
    return rows.filter((r) => r.value > 0);
  }, [stats]);

  const buBarData = useMemo(
    () =>
      (buStats || []).map((s) => ({
        name: s.name.length > 14 ? `${s.name.slice(0, 12)}…` : s.name,
        fullName: s.name,
        users: s.users,
        conversations: s.conversations
      })),
    [buStats]
  );

  const topUserBarData = useMemo(
    () =>
      (topUsers || []).map((u) => ({
        name: (u.name || u.email || "User").length > 18 ? `${(u.name || u.email).slice(0, 16)}…` : u.name || u.email,
        conversations: u.conversations
      })),
    [topUsers]
  );

  const metric = (label: string, value: number | string, icon: React.ReactNode, sub?: string) => (
    <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</CardTitle>
        <div className="text-[var(--brand-color)] opacity-90">{icon}</div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {loading ? (
          <Skeleton className="h-9 w-24 rounded-lg" />
        ) : (
          <p className="text-3xl font-black text-slate-900 font-['Sen'] tracking-tight">{value}</p>
        )}
        {sub && <p className="text-[11px] text-slate-400 font-medium mt-2 leading-snug">{sub}</p>}
      </CardContent>
    </Card>
  );

  const chartCard = (
    title: string,
    subtitle: string,
    heightClass: string,
    children: React.ReactNode,
    opts?: { compact?: boolean; className?: string }
  ) => (
    <Card
      className={cn(
        "border border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden",
        opts?.className
      )}
    >
      <CardHeader className={cn("pb-2 px-6", opts?.compact ? "pt-4" : "pt-6")}>
        <CardTitle
          className={cn(
            "font-bold text-slate-900 font-['Sen'] tracking-tight",
            opts?.compact ? "text-base" : "text-lg"
          )}
        >
          {title}
        </CardTitle>
        <p className="text-xs text-slate-400 font-medium mt-1 leading-snug">{subtitle}</p>
      </CardHeader>
      <CardContent className={cn("px-3 pb-4 sm:px-4 sm:pb-5", heightClass)}>
        {loading ? (
          <div
            className={cn(
              "h-full flex items-end gap-2 px-2",
              opts?.compact ? "min-h-[180px]" : "min-h-[240px]"
            )}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${20 + (i * 7) % 60}%` }} />
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-w-0 max-w-full space-y-10 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
          <BarChart3 className="text-[var(--brand-color)]" size={32} />
          Analytics
        </h1>
        <p className="text-slate-500 font-medium mt-1 text-sm max-w-2xl">
          Live metrics and trends. Figures refresh automatically every few seconds while you stay on this page.
          {lastUpdated && (
            <span className="block mt-1 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Last updated {format(lastUpdated, "MMM d, yyyy HH:mm:ss")}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12 xl:items-stretch">
        <div
          className={cn(
            "grid gap-4 min-w-0 xl:col-span-8",
            isSuper ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-2"
          )}
        >
          {metric("Users", stats?.totalUsers ?? "—", <Users size={20} />, isSuper ? "Platform directory" : "Business unit directory")}
          {metric(
            "Members using AI",
            stats?.usersWhoChatted ?? "—",
            <MessageSquare size={20} />,
            "Users who have sent or received at least one chat message"
          )}
          {metric("Knowledge policies", stats?.totalDocs ?? "—", <Files size={20} />, "Indexed policies in the knowledge base")}
          {isSuper && metric("Business units", stats?.totalTenants ?? "—", <Building2 size={20} />)}
          {metric("Admins", stats?.totalAdmins ?? "—", <UserPlus size={20} />)}
          {isSuper &&
            metric(
              "Legacy policy records",
              stats?.totalPolicies ?? "—",
              <Files size={18} />,
              "Separate Policy model rows (not RAG uploads)"
            )}
          {isSuper &&
            metric(
              "Conversation documents",
              stats?.totalConversations ?? "—",
              <MessageSquare size={18} />,
              "User conversation documents in scope (may include empty threads)"
            )}
        </div>

        <div className="flex flex-col gap-4 min-w-0 xl:col-span-4">
          {chartCard(
            "Audit events (7 days)",
            "Admin and security actions in your visibility scope.",
            "h-[220px] min-h-[200px] xl:h-[240px]",
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={auditSeries} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill="#64748b" radius={[5, 5, 0, 0]} maxBarSize={28} name="Events" />
              </BarChart>
            </ResponsiveContainer>,
            { compact: true }
          )}

          {chartCard(
            "Engagement mix",
            "Users, AI adoption, and indexed policies.",
            "h-[240px] min-h-[220px] xl:h-[260px]",
            overviewPie.length === 0 ? (
              <div className="h-full min-h-[160px] flex items-center justify-center text-sm text-slate-400 font-medium px-2 text-center">
                No data to chart yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={overviewPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={false}
                  >
                    {overviewPie.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            ),
            { compact: true }
          )}
        </div>
      </div>

      <div className="space-y-6 pt-2">
        {chartCard(
          "Conversation records opened (30 days)",
          "Daily count of conversation documents created in scope (platform or your BU).",
          "h-[300px] sm:h-[320px]",
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chatSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="_id"
                tickFormatter={(val) => {
                  try {
                    return new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  } catch {
                    return val;
                  }
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                dy={8}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} dx={-6} />
              <Tooltip
                cursor={{ fill: "var(--brand-color)", opacity: 0.06 }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  padding: "10px"
                }}
                labelFormatter={(v) => String(v)}
              />
              <Bar dataKey="count" fill="var(--brand-color)" radius={[6, 6, 0, 0]} maxBarSize={36} name="Records" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {isSuper
          ? chartCard(
              "Users by business unit",
              "Headcount per tenant (directory users).",
              "h-[300px] sm:h-[320px]",
              buBarData.length === 0 ? (
                <div className="h-full min-h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium">
                  No business units to show.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={buBarData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                    />
                    <Tooltip formatter={(v: number) => [v, "Users"]} labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ""} />
                    <Bar dataKey="users" fill="var(--brand-color)" radius={[0, 6, 6, 0]} name="Users" />
                  </BarChart>
                </ResponsiveContainer>
              )
            )
          : chartCard(
              "Top users by conversation rows",
              "Users with the most conversation documents in your BU.",
              "h-[300px] sm:h-[320px]",
              topUserBarData.length === 0 ? (
                <div className="h-full min-h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium">
                  No engagement data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={topUserBarData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                    />
                    <Tooltip />
                    <Bar dataKey="conversations" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Conversations" />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
      </div>
    </div>
  );
};

export default Analytics;
