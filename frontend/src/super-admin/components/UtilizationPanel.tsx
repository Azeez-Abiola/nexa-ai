import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { format, startOfMonth, subDays } from "date-fns";
import { Download, Gauge, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type UtilizationRow = {
  businessUnit: string;
  activeUsers: number;
  conversations: number;
  messages: number;
  assistantMessages: number;
  shareOfLlmCalls: number;
};

type UtilizationResponse = {
  rows: UtilizationRow[];
  totalLlmCalls: number;
  unattributedLlmCalls: number;
};

/** Quick ranges — most reporting asks are "this month" or "last 30 days". */
const PRESETS: { label: string; from: () => Date | null }[] = [
  { label: "All time", from: () => null },
  { label: "This month", from: () => startOfMonth(new Date()) },
  { label: "Last 30 days", from: () => subDays(new Date(), 30) },
  { label: "Last 7 days", from: () => subDays(new Date(), 7) },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

const UtilizationPanel: React.FC = () => {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [data, setData] = useState<UtilizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const query = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    // Make `to` inclusive of the whole selected day rather than stopping at 00:00.
    if (to) params.set("to", `${to}T23:59:59.999Z`);
    return params.toString();
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = query();
      const res = await axios.get<UtilizationResponse>(
        `/api/v1/analytics/utilization-by-bu${qs ? `?${qs}` : ""}`,
        { headers: authHeaders() }
      );
      setData(res.data);
    } catch {
      setError("Could not load utilization data.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, query]);

  useEffect(() => {
    load();
  }, [load]);

  /** Fetch the CSV as a blob so the auth header is sent — a plain link can't carry it. */
  const download = async () => {
    setDownloading(true);
    try {
      const qs = query();
      const res = await axios.get(
        `/api/v1/analytics/utilization-by-bu?format=csv${qs ? `&${qs}` : ""}`,
        { headers: authHeaders(), responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexa-utilization-${from || "start"}_to_${to || iso(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    const start = preset.from();
    setFrom(start ? iso(start) : "");
    setTo(start ? iso(new Date()) : "");
  };

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Gauge className="h-4 w-4 text-slate-400" />
            Platform Utilization by Business Unit
          </CardTitle>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Assistant replies are LLM calls — use the share column to apportion provider spend.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={downloading || loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download CSV
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              {p.label}
            </button>
          ))}
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
            />
          </label>
        </div>

        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data || data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-slate-400">
            No activity in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Business Unit</th>
                  <th className="py-2 pr-4 text-right">Active Users</th>
                  <th className="py-2 pr-4 text-right">Conversations</th>
                  <th className="py-2 pr-4 text-right">Messages</th>
                  <th className="py-2 pr-4 text-right">LLM Calls</th>
                  <th className="py-2 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.businessUnit} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 font-semibold text-slate-800">{r.businessUnit}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{r.activeUsers}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{r.conversations}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{r.messages}</td>
                    <td className="py-2 pr-4 text-right font-bold text-slate-900">{r.assistantMessages}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{r.shareOfLlmCalls}%</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-bold text-slate-900">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4 text-right">{data.totalLlmCalls}</td>
                  <td className="py-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>

            {data.unattributedLlmCalls > 0 && (
              <p className="mt-3 text-[11px] font-medium text-amber-600">
                {data.unattributedLlmCalls} call(s) excluded — they belong to deleted users with no
                business unit and cannot be attributed.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UtilizationPanel;
