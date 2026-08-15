import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { AlertTriangle, Download, FileWarning, Lock, SearchX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportCsvSections } from "../lib/exportCsv";

/**
 * What the knowledge base could not answer.
 *
 * Every other panel reports how busy Nexa was. This one reports where it let people
 * down, which is the half you can actually act on: an unanswered question is a document
 * somebody needs to upload, in the user's own words.
 */

type UnansweredQuery = { query: string; businessUnit: string; count: number; lastAskedAt: string };
type FailedDoc = { details: string; businessUnit: string; filename: string; createdAt: string };

type GapsPayload = {
  days: number;
  emptyRetrievals: number;
  accessDenied: number;
  failedDocuments: number;
  totalQueries: number;
  missRate: number | null;
  dailyMisses: { date: string; count: number }[];
  topUnanswered: UnansweredQuery[];
  failedDocuments_list: FailedDoc[];
};

const WINDOW_OPTIONS = [7, 30, 90];

const KnowledgeGapsPanel: React.FC = () => {
  const isSuper = window.location.pathname.startsWith("/super-admin");
  const [data, setData] = useState<GapsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const authHeaders = useCallback(() => {
    const token = isSuper
      ? localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token")
      : localStorage.getItem("nexa-token");
    return { Authorization: `Bearer ${token}` };
  }, [isSuper]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get<GapsPayload>(`/api/v1/analytics/knowledge-gaps?days=${days}`, { headers: authHeaders() })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => console.error("Failed to load knowledge gaps", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authHeaders, days]);

  const handleExport = () => {
    if (!data) return;
    exportCsvSections("knowledge-gaps", [
      {
        title: `Knowledge gaps — last ${data.days} days`,
        headers: ["Metric", "Value"],
        rows: [
          ["Questions asked", data.totalQueries],
          ["Unanswered (nothing retrieved)", data.emptyRetrievals],
          ["Miss rate %", data.missRate ?? "n/a"],
          ["Blocked by permissions", data.accessDenied],
          ["Documents that failed processing", data.failedDocuments],
        ],
      },
      {
        title: "Most asked, unanswered",
        headers: ["Question", "Business unit", "Times asked", "Last asked"],
        rows: data.topUnanswered.map((q) => [
          q.query,
          q.businessUnit,
          q.count,
          format(new Date(q.lastAskedAt), "yyyy-MM-dd HH:mm"),
        ]),
      },
      {
        title: "Documents that failed to process",
        headers: ["File", "Business unit", "Detail", "When"],
        rows: data.failedDocuments_list.map((d) => [
          d.filename,
          d.businessUnit,
          d.details,
          format(new Date(d.createdAt), "yyyy-MM-dd HH:mm"),
        ]),
      },
    ]);
  };

  // A miss rate is only meaningful against a reasonable number of questions; on a handful
  // it swings wildly, so the tone stays neutral until there is something to judge.
  const missTone = useMemo(() => {
    if (!data || data.missRate === null || data.totalQueries < 20) return "text-slate-900";
    if (data.missRate >= 25) return "text-rose-600";
    if (data.missRate >= 10) return "text-amber-600";
    return "text-emerald-600";
  }, [data]);

  const stat = (label: string, value: React.ReactNode, icon: React.ReactNode, sub: string, tone = "text-slate-900") => (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-[var(--brand-color)] opacity-90">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20 rounded-lg" />
      ) : (
        <p className={`mt-3 font-['Sen'] text-3xl font-black tracking-tight ${tone}`}>{value}</p>
      )}
      <p className="mt-2 text-[11px] font-medium leading-snug text-slate-400">{sub}</p>
    </div>
  );

  return (
    <Card className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-100 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <AlertTriangle size={16} className="text-[var(--brand-color)]" />
            Knowledge gaps
          </CardTitle>
          <p className="mt-1 text-xs font-medium text-slate-400">
            What Nexa was asked and could not answer. Each one is a document worth adding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100/80 p-1">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                  days === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={loading || !data}
            title="Export these gaps as CSV"
            className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stat("Unanswered", data?.emptyRetrievals ?? "—", <SearchX size={18} />, "Questions where nothing relevant was found")}
          {stat(
            "Miss rate",
            data?.missRate === null || data?.missRate === undefined ? "—" : `${data.missRate}%`,
            <AlertTriangle size={18} />,
            `Of ${data?.totalQueries ?? 0} questions asked`,
            missTone
          )}
          {stat("Blocked", data?.accessDenied ?? "—", <Lock size={18} />, "Refused by knowledge group permissions")}
          {stat("Failed uploads", data?.failedDocuments ?? "—", <FileWarning size={18} />, "Documents that never became searchable")}
        </div>

        <div>
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Most asked, still unanswered
          </h4>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : !data?.topUnanswered.length ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm font-medium italic text-slate-400">
              Nothing went unanswered in this period.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.topUnanswered.slice(0, 10).map((q, i) => (
                <li
                  key={`${q.query}-${i}`}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    {/* The user's own words, so an admin can see exactly what was expected. */}
                    <p className="truncate text-sm font-semibold text-slate-800">{q.query}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                      {isSuper ? `${q.businessUnit} · ` : ""}
                      last asked {format(new Date(q.lastAskedAt), "d MMM, HH:mm")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 shadow-sm">
                    ×{q.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Only shown when there is something wrong: a permanently empty panel trains
            people to stop looking at it. */}
        {!loading && data && data.failedDocuments_list.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-rose-500">
              <FileWarning size={13} />
              Documents that failed to process
            </h4>
            <ul className="space-y-2">
              {data.failedDocuments_list.slice(0, 5).map((d, i) => (
                <li
                  key={`${d.filename}-${i}`}
                  className="rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3"
                >
                  <p className="truncate text-sm font-semibold text-slate-800">{d.filename || d.details}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                    {isSuper ? `${d.businessUnit} · ` : ""}
                    {format(new Date(d.createdAt), "d MMM, HH:mm")} · not searchable until re-uploaded
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KnowledgeGapsPanel;
