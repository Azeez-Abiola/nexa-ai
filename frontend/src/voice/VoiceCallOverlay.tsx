import { useEffect, useMemo, useRef } from "react";
import { BiMicrophone, BiMicrophoneOff, BiPhoneOff } from "react-icons/bi";
import type { CallStatus } from "./useVoiceCall";
import styles from "./voiceCall.module.css";

type VoiceCallOverlayProps = {
  status: CallStatus;
  /** Follows the app's theme: the call screen was dark whatever the rest of the app was doing. */
  theme: string;
  muted: boolean;
  transcript: string;
  reply: string;
  /** How many words of the reply have been spoken, for the live caption. */
  spokenWords: number;
  error: string | null;
  /** Sampled every frame by the visualiser rather than passed as a prop, so the meter animates without re-rendering. */
  getLevel: () => number;
  onToggleMute: () => void;
  onEnd: () => void;
};

const BAR_COUNT = 41;
/** Idle bars sit at a visible sliver so the meter reads as "live but quiet", not broken. */
const MIN_BAR_SCALE = 0.05;

const STATUS_LABELS: Record<CallStatus, string> = {
  connecting: "Connecting…",
  listening: "Listening",
  capturing: "Listening",
  thinking: "Thinking…",
  speaking: "Nexa is speaking",
  error: "Call ended",
};

/**
 * The decibel meter: a mirrored row of bars driven by whichever side of the call is
 * making sound. Drawn on canvas and animated from a ref, because a 60fps level meter
 * pushed through React state would re-render the tree on every frame.
 */
function useVisualizer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  getLevel: () => number,
  status: CallStatus,
  isDark: boolean
) {
  // Read inside the animation loop so it always sees the current status without restarting.
  const statusRef = useRef(status);
  statusRef.current = status;
  const darkRef = useRef(isDark);
  darkRef.current = isDark;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // Bars fall away from the centre, so the loudest movement is in the middle.
    const weights = Array.from({ length: BAR_COUNT }, (_, i) => {
      const offset = Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
      return Math.pow(1 - offset, 1.6) * 0.85 + 0.15;
    });
    // Per-bar phase keeps neighbours from moving in lockstep, which looks mechanical.
    const phases = Array.from({ length: BAR_COUNT }, (_, i) => i * 0.7);
    const heights = new Array(BAR_COUNT).fill(MIN_BAR_SCALE);

    let raf = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const state = statusRef.current;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // RMS from speech rarely passes ~0.3, so scale it up to use the full height.
      const level = Math.min(1, getLevel() * 3.2);
      const speaking = state === "speaking";
      const thinking = state === "thinking" || state === "connecting";

      const gap = (width / BAR_COUNT) * 0.42;
      const barWidth = width / BAR_COUNT - gap;
      const maxBar = height * 0.86;
      const midY = height / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        let target: number;
        if (thinking) {
          // No audio to show while she thinks, so run a travelling wave to signal activity.
          const wave = Math.sin(time / 260 - i * 0.34);
          target = reduceMotion ? 0.18 : MIN_BAR_SCALE + Math.max(0, wave) * 0.32;
        } else {
          const shimmer = reduceMotion ? 1 : 0.78 + 0.22 * Math.sin(time / 150 + phases[i]);
          target = Math.max(MIN_BAR_SCALE, level * weights[i] * shimmer);
        }

        // Rise fast, fall slow: matches how a real level meter behaves and stops flicker.
        const current = heights[i];
        heights[i] = target > current ? current + (target - current) * 0.45 : current + (target - current) * 0.14;

        const barHeight = Math.max(barWidth * 0.9, heights[i] * maxBar);
        const x = i * (barWidth + gap) + gap / 2;
        const y = midY - barHeight / 2;

        // Brand red while Nexa talks, neutral while she listens, so you always know whose
        // turn it is. The neutral has to invert with the theme or it vanishes into the page.
        const intensity = Math.min(1, heights[i] * 1.4 + 0.25);
        const neutral = darkRef.current ? "245, 245, 245" : "51, 51, 61";
        ctx.fillStyle = speaking
          ? `rgba(237, 0, 0, ${0.45 + intensity * 0.55})`
          : `rgba(${neutral}, ${0.28 + intensity * 0.52})`;

        const radius = Math.min(barWidth / 2, barHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, getLevel]);
}

/**
 * Nexa's reply, lit up as she says it.
 *
 * Words already spoken are bright, the rest sit back, and the container keeps the word
 * being spoken in view so the text scrolls itself. On a long answer this is the
 * difference between a wall of text and being able to follow along.
 */
function SpokenCaption({ text, spokenWords }: { text: string; spokenWords: number }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const activeRef = useRef<HTMLSpanElement>(null);

  // Follow the voice. "nearest" scrolls only when the word has actually left the box,
  // so the text sits still and then moves up a line, rather than creeping continuously.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [spokenWords]);

  let wordIndex = -1;
  return (
    <p className={styles.nexa} aria-live="off">
      {words.map((part, i) => {
        // The split keeps whitespace, which is not a word and must not be counted.
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        wordIndex++;
        const isSpoken = wordIndex < spokenWords;
        const isCurrent = wordIndex === spokenWords - 1;
        return (
          <span
            key={i}
            ref={isCurrent ? activeRef : undefined}
            className={isSpoken ? styles.wordSpoken : styles.wordPending}
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}

export default function VoiceCallOverlay({
  status,
  theme,
  muted,
  transcript,
  reply,
  spokenWords,
  error,
  getLevel,
  onToggleMute,
  onEnd,
}: VoiceCallOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = theme === "dark";
  useVisualizer(canvasRef, getLevel, status, isDark);

  // Escape hangs up, matching the muscle memory of every other modal in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  const statusLabel = muted && (status === "listening" || status === "capturing") ? "Muted" : STATUS_LABELS[status];

  return (
    <div
      className={`${styles.overlay} ${isDark ? "" : styles.light}`}
      role="dialog"
      aria-modal="true"
      aria-label="Voice call with Nexa"
    >
      <div className={styles.header}>
        {/* The same lockup as the sidebar, and the same two files rather than a CSS
            filter: the mark must stay brand red on both themes, and any filter that
            lightens the black type would drag the red with it. */}
        <img
          src={isDark ? "/icons/nexa-logo-light.png" : "/icons/nexa-logo.png"}
          alt="Nexa"
          className={styles.logo}
        />
        {/* Announced politely so a screen reader narrates whose turn it is without interrupting. */}
        <span className={styles.status} aria-live="polite">{statusLabel}</span>
      </div>

      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.visualizer} aria-hidden="true" />
        <div className={styles.captions}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {transcript ? <p className={styles.you}>{transcript}</p> : null}
          {reply ? <SpokenCaption text={reply} spokenWords={spokenWords} /> : null}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        >
          <span className={`${styles.controlIcon} ${muted ? styles.mutedIcon : ""}`}>
            {muted ? <BiMicrophoneOff size={24} /> : <BiMicrophone size={24} />}
          </span>
          {muted ? "Unmute" : "Mute"}
        </button>

        <button
          type="button"
          className={`${styles.controlBtn} ${styles.endBtn}`}
          onClick={onEnd}
          aria-label="End voice call"
        >
          <span className={`${styles.controlIcon} ${styles.endIcon}`}>
            <BiPhoneOff size={24} />
          </span>
          End
        </button>
      </div>
    </div>
  );
}
