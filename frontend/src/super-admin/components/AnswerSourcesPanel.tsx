import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Download, Globe, Library, Layers, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportCsvSections } from "../lib/exportCsv";

/**
 * Where answers came from: the knowledge base, the open web, both, or neither.
 *
 * Answers the question the usage charts cannot — not "how much is Nexa used" but "is the
 * knowledge base actually being used". If most answers cite nothing at all, people are
 * asking things the documents do not cover.
 */

type Buckets = { knowledgeBase: number; web: number; both: number; model: number };

type SourcesPayload = {
  days: number;
  totalAnswers: number;
  totals: Buckets;
  groundedRate: number | null;
  percentages: { knowledgeBase: number | null; web: number | null; both: number | null; model: number | null };
  daily: ({ date: string } & Buckets)[];
};

const WINDOW_OPTIONS = [7, 30, 90];

const SEGMENTS: {
  key: keyof Buckets;
  label: string;
  hint: string;
  colour: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "knowledgeBase",
    label: "Your documents",
    hint: "Cited approved company documents only",
    colour: "#ed0000",
    icon: <Library size={16} />
  },
  {
    key: "both",
    label: "Documents + web",
    hint: "Combined company documents with a live search",
    colour: "#8b5cf6",
    icon: <Layers size={16} />
  },
  {
    key: "web",
    label: "Internet",
    hint: "Cited the open web only",
    colour: "#3b82f6",
    icon: <Globe size={16} />
  },
  {
    key: "model",
    label: "Model knowledge",
    hint: "Cited nothing — answered from general training",
    colour: "#94a3b8",
    icon: <Sparkles size={16} />
  }
];

const AnswerSourcesPanel: React.FC = () => {
  const isSuper = window.location.pathname.startsWith("/super-admin");
  const [data, setData] = useState<SourcesPayload | null>(null);
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
      .get<SourcesPayload>(`/api/v1/analytics/answer-sources?days=${days}`, { headers: authHeaders() })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => console.error("Failed to load answer sources", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authHeaders, days]);

  const handleExport = () => {
    if (!data) return;
    exportCsvSections("answer-sources", [
      {
        title: `Where answers came from — last ${data.days} days`,
        headers: ["Source", "Answers", "Share %"],
        rows: SEGMENTS.map((s) => [s.label, data.totals[s.key], data.percentages[s.key] ?? "n/a"]).concat([
          ["Total answers", data.totalAnswers, ""],
          ["Grounded in your documents %", data.groundedRate ?? "n/a", ""]
        ])
      },
      {
        title: "Daily breakdown",
        headers: ["Date", "Your documents", "Documents + web", "Internet", "Model knowledge"],
        rows: data.daily.map((d) => [d.date, d.knowledgeBase, d.both, d.web, d.model])
      }
    ]);
  };

  const total = data?.totalAnswers ?? 0;

  return (
    <Card className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-100 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Library size={16} className="text-[var(--brand-color)]" />
            Where answers came from
          </CardTitle>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Whether Nexa answered from your documents, the internet, or its own general knowledge.
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
            title="Export this breakdown as CSV"
            className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {loading ? (
          <Skeleton className="h-4 w-full rounded-full" />
        ) : total === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm font-medium italic text-slate-400">
            No answers in this period.
          </p>
        ) : (
          <>
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Grounded in your documents
                </span>
                <span className="font-['Sen'] text-2xl font-black tracking-tight text-slate-900">
                  {data?.groundedRate ?? 0}%
                </span>
              </div>
              {/* One bar rather than a pie: these are parts of a whole and the eye compares
                  lengths far better than angles. */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {SEGMENTS.map((s) => {
                  const value = data?.totals[s.key] ?? 0;
                  if (value === 0) return null;
                  return (
                    <div
                      key={s.key}
                      style={{ width: `${(value / total) * 100}%`, backgroundColor: s.colour }}
                      title={`${s.label}: ${value}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SEGMENTS.map((s) => (
                <div key={s.key} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      <span style={{ color: s.colour }}>{s.icon}</span>
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-3 font-['Sen'] text-3xl font-black tracking-tight text-slate-900">
                    {data?.percentages[s.key] ?? 0}%
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {data?.totals[s.key] ?? 0} of {total} answers
                  </p>
                  <p className="mt-2 text-[11px] font-medium leading-snug text-slate-400">{s.hint}</p>
                </div>
              ))}
            </div>

            {/* Only when it is worth saying. A quiet nudge beats a permanent banner. */}
            {data && data.percentages.model !== null && data.percentages.model >= 50 && (
              <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs font-medium text-amber-700">
                More than half of answers cited nothing at all, so people are mostly asking things
                your documents do not cover. The knowledge gaps below show what they were.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AnswerSourcesPanel;
