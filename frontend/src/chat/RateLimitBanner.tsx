import React, { useEffect, useState } from "react";
import { BiInfoCircle, BiErrorCircle, BiX } from "react-icons/bi";

export interface RateLimitInfo {
  /** Requests left in the current window (from the RateLimit header). */
  remaining: number;
  /** Total allowed in the window. */
  limit: number;
  /** Epoch ms when the window resets and the quota refreshes. */
  resetAt: number;
}

interface RateLimitBannerProps {
  info: RateLimitInfo | null;
  /** Show a warning once remaining drops to this many or fewer. Default 3. */
  warnThreshold?: number;
  /** Called when the window has refreshed so the parent can clear its state. */
  onExpire?: () => void;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

const RateLimitBanner: React.FC<RateLimitBannerProps> = ({
  info,
  warnThreshold = 3,
  onExpire,
}) => {
  const [now, setNow] = useState(() => Date.now());
  // Remember which window the user dismissed so it doesn't nag every second,
  // but reappears for a fresh window.
  const [dismissedResetAt, setDismissedResetAt] = useState<number | null>(null);

  const exhausted = !!info && info.remaining <= 0;
  const warning = !!info && !exhausted && info.remaining <= warnThreshold;
  const active = exhausted || warning;

  // Tick every second only while the banner is actually showing.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const msLeft = info ? info.resetAt - now : 0;

  // Once the window elapses, clear the limit so the UI returns to normal.
  useEffect(() => {
    if (active && msLeft <= 0) onExpire?.();
  }, [active, msLeft, onExpire]);

  if (!active || msLeft <= 0) return null;
  // The warning (not the hard block) can be dismissed for the current window.
  if (warning && dismissedResetAt === info!.resetAt) return null;

  const countdown = formatCountdown(msLeft);

  return (
    <div
      className={`rl-banner ${exhausted ? "rl-banner--blocked" : "rl-banner--warn"}`}
      role="status"
      aria-live="polite"
    >
      <span className="rl-banner__icon">
        {exhausted ? <BiErrorCircle size={22} /> : <BiInfoCircle size={22} />}
      </span>
      <div className="rl-banner__body">
        <div className="rl-banner__title">
          {exhausted
            ? "Message limit reached"
            : `${info!.remaining} message${info!.remaining === 1 ? "" : "s"} left`}
        </div>
        <div className="rl-banner__subtitle">
          {exhausted ? (
            <>You can send new messages in <strong>{countdown}</strong>.</>
          ) : (
            <>Your limit refreshes in <strong>{countdown}</strong>.</>
          )}
        </div>
      </div>
      {warning && (
        <button
          type="button"
          className="rl-banner__close"
          aria-label="Dismiss"
          onClick={() => setDismissedResetAt(info!.resetAt)}
        >
          <BiX size={20} />
        </button>
      )}

      <style>{`
        .rl-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
          padding: 12px 16px;
          margin: 0 auto 12px;
          border-radius: 16px;
          border: 1px solid transparent;
          animation: rl-banner-in 0.25s ease;
        }
        @keyframes rl-banner-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rl-banner--warn {
          background: #fff7ed;
          border-color: #fed7aa;
          color: #9a3412;
        }
        .rl-banner--blocked {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }
        .rl-banner__icon { display: flex; flex-shrink: 0; }
        .rl-banner--warn .rl-banner__icon { color: #ea580c; }
        .rl-banner--blocked .rl-banner__icon { color: var(--brand-color, #ed0000); }
        .rl-banner__body { flex: 1; min-width: 0; }
        .rl-banner__title { font-weight: 600; font-size: 14px; line-height: 1.3; }
        .rl-banner__subtitle { font-size: 13px; opacity: 0.85; line-height: 1.4; }
        .rl-banner__subtitle strong { font-variant-numeric: tabular-nums; }
        .rl-banner__close {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.15s, background 0.15s;
        }
        .rl-banner__close:hover { opacity: 1; background: rgba(0, 0, 0, 0.06); }

        .dark-theme .rl-banner--warn {
          background: rgba(234, 88, 12, 0.12);
          border-color: rgba(234, 88, 12, 0.35);
          color: #fdba74;
        }
        .dark-theme .rl-banner--blocked {
          background: rgba(237, 0, 0, 0.12);
          border-color: rgba(237, 0, 0, 0.4);
          color: #fca5a5;
        }
        .dark-theme .rl-banner--warn .rl-banner__icon { color: #fb923c; }
        .dark-theme .rl-banner__close:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
};

export default RateLimitBanner;
