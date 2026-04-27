import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface NotificationRow {
  _id: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsBellProps {
  isDark?: boolean;
  /** Polling interval in ms; 0 disables. Default 30 s. */
  pollIntervalMs?: number;
}

const POLL_DEFAULT = 30_000;

const NotificationsBell: React.FC<NotificationsBellProps> = ({ isDark = false, pollIntervalMs = POLL_DEFAULT }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const token = useMemo(
    () => localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token"),
    []
  );
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const refreshCount = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get<{ unreadCount: number }>(
        "/api/v1/notifications/unread-count",
        { headers }
      );
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* swallow — polling is best-effort */
    }
  }, [headers, token]);

  const refreshList = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await axios.get<{ notifications: NotificationRow[]; unreadCount: number }>(
        "/api/v1/notifications?limit=20",
        { headers }
      );
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, [headers, token]);

  // Initial fetch + polling.
  useEffect(() => {
    refreshCount();
    if (!pollIntervalMs) return;
    const id = setInterval(refreshCount, pollIntervalMs);
    return () => clearInterval(id);
  }, [refreshCount, pollIntervalMs]);

  // When the dropdown opens, fetch the full list.
  useEffect(() => {
    if (open) refreshList();
  }, [open, refreshList]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleClickItem = async (n: NotificationRow) => {
    if (!n.read) {
      try {
        await axios.patch(`/api/v1/notifications/${n._id}/read`, {}, { headers });
        setItems((prev) => prev.map((p) => (p._id === n._id ? { ...p, read: true } : p)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* swallow */
      }
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await axios.patch("/api/v1/notifications/read-all", {}, { headers });
      setItems((prev) => prev.map((p) => ({ ...p, read: true })));
      setUnreadCount(0);
    } catch {
      /* swallow */
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors",
          isDark
            ? "border-[#3f3f3f] bg-[#333] text-gray-300 hover:text-white hover:border-[#555]"
            : "border-slate-200 bg-slate-50 text-slate-500 hover:text-[var(--brand-color)] hover:border-[var(--brand-color)]/40"
        )}
      >
        <Bell size={20} strokeWidth={1.6} />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-color)] text-white text-[10px] font-black flex items-center justify-center shadow-md"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className={cn(
            "absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[480px] flex flex-col rounded-2xl border shadow-2xl z-50 overflow-hidden",
            isDark ? "bg-[#1a1a1a] border-[#333]" : "bg-white border-slate-100"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              isDark ? "border-[#333]" : "border-slate-100"
            )}
          >
            <p className={cn("font-black font-['Sen'] text-sm", isDark ? "text-white" : "text-slate-900")}>
              Notifications {unreadCount > 0 ? <span className="text-[var(--brand-color)]">({unreadCount})</span> : null}
            </p>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
                unreadCount === 0
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-[var(--brand-color)] hover:opacity-80"
              )}
            >
              {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Mark all read
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <div className="py-12 text-center">
                <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Bell size={28} className="text-slate-300 mx-auto mb-3" />
                <p className={cn("text-sm font-bold", isDark ? "text-gray-300" : "text-slate-700")}>
                  Nothing new
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  We'll let you know when something happens.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => handleClickItem(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors",
                        isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-slate-50",
                        !n.read && (isDark ? "bg-[#1f1f1f]" : "bg-[var(--brand-color)]/[0.03]")
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {!n.read ? (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--brand-color)] shrink-0" />
                        ) : (
                          <span className="mt-1.5 w-2 h-2 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm font-bold leading-tight truncate",
                              isDark ? "text-white" : "text-slate-900"
                            )}
                          >
                            {n.title}
                          </p>
                          <p
                            className={cn(
                              "text-xs leading-snug mt-0.5",
                              isDark ? "text-gray-400" : "text-slate-500"
                            )}
                          >
                            {n.body}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsBell;
