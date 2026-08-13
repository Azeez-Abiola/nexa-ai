import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wake word detection, so "Hey Nexa" opens a call without touching the screen.
 *
 * Runs entirely on the device. Porcupine is a small neural net compiled to WASM that
 * listens for one phrase and nothing else: no audio leaves the machine until it hears
 * its name, at which point the normal call flow takes over. That property is the whole
 * reason for using it over continuous speech recognition, which would mean streaming
 * everything said near the microphone to a server all day.
 *
 * Only works while Nexa is open and on screen. A web app cannot listen in the
 * background, so waking the app from closed needs a native shell (and on iOS is not
 * possible at all, since Apple reserves background hotwords for Siri).
 */

/** Picovoice AccessKey. Without it the feature stays off and the toggle is hidden. */
const ACCESS_KEY = import.meta.env.VITE_PICOVOICE_ACCESS_KEY || "";

/**
 * The trained "Hey Nexa" keyword, exported from the Picovoice console as a .ppn for the
 * "Web (WASM)" platform and dropped into public/wake/.
 */
const KEYWORD_PATH = import.meta.env.VITE_WAKE_KEYWORD_PATH || "/wake/hey-nexa.ppn";

/**
 * Escape hatch for testing before the custom keyword exists. Set to a built-in phrase
 * such as "Computer" or "Jarvis" to prove the pipeline works end to end; leave unset in
 * production, where the phrase must be "Hey Nexa".
 */
const BUILTIN_KEYWORD = import.meta.env.VITE_WAKE_BUILTIN || "";

/** The Porcupine parameter model, also from the console or the Picovoice repo. */
const MODEL_PATH = import.meta.env.VITE_WAKE_MODEL_PATH || "/wake/porcupine_params.pv";

/** Remembered across sessions: an always-listening mic must be a deliberate choice. */
const STORAGE_KEY = "nexa-wake-word-enabled";

/**
 * Ignore repeat detections inside this window. Porcupine can fire twice on one utterance
 * if the phrase is drawn out, and a second trigger while the call is opening would restart it.
 */
const RETRIGGER_COOLDOWN_MS = 2500;

export type WakeWordState = {
  /** False when no access key is configured, in which case the UI should not offer this at all. */
  available: boolean;
  enabled: boolean;
  /** True once the engine is actually listening, as opposed to merely switched on. */
  listening: boolean;
  loading: boolean;
  error: string | null;
  toggle: () => void;
};

type UseWakeWordOptions = {
  /**
   * Suspends detection without forgetting the preference. Passed true during a call,
   * because the call needs the microphone and two engines cannot hold it at once.
   */
  paused: boolean;
  /** Fired when the phrase is heard. */
  onDetected: () => void;
};

export function useWakeWord({ paused, onDetected }: UseWakeWordOptions): WakeWordState {
  const available = Boolean(ACCESS_KEY);

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!available) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<any>(null);
  const processorRef = useRef<any>(null);
  const lastDetectionRef = useRef(0);
  // Kept in a ref so the engine, which is created once, always calls the current handler.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* private browsing — the preference just will not persist */
      }
      if (next) setError(null);
      return next;
    });
  }, []);

  useEffect(() => {
    // Paused rather than disabled during a call: the preference survives, the mic is released.
    const shouldRun = available && enabled && !paused;
    if (!shouldRun) return;

    let cancelled = false;
    setLoading(true);

    const start = async () => {
      try {
        // Loaded on demand. The engine and its model are megabytes of WASM, and most
        // sessions never turn this on, so it has no business in the main bundle.
        const [{ PorcupineWorker, BuiltInKeyword }, { WebVoiceProcessor }] = await Promise.all([
          import("@picovoice/porcupine-web"),
          import("@picovoice/web-voice-processor"),
        ]);
        if (cancelled) return;

        const keyword = BUILTIN_KEYWORD
          ? (BUILTIN_KEYWORD as unknown as typeof BuiltInKeyword[keyof typeof BuiltInKeyword])
          : { publicPath: KEYWORD_PATH, label: "Hey Nexa" };

        const worker = await PorcupineWorker.create(
          ACCESS_KEY,
          keyword as any,
          () => {
            // Debounced: a drawn-out phrase can fire twice, and the second one would
            // land while the call is still opening and restart it.
            const now = Date.now();
            if (now - lastDetectionRef.current < RETRIGGER_COOLDOWN_MS) return;
            lastDetectionRef.current = now;
            onDetectedRef.current();
          },
          { publicPath: MODEL_PATH }
        );
        if (cancelled) {
          void worker.terminate();
          return;
        }
        workerRef.current = worker;

        await WebVoiceProcessor.subscribe(worker);
        if (cancelled) {
          void WebVoiceProcessor.unsubscribe(worker);
          void worker.terminate();
          return;
        }
        processorRef.current = WebVoiceProcessor;
        setListening(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Distinguish the three failures people actually hit, because the fix differs
        // completely and Picovoice's own messages are not written for end users.
        if (/permission|denied|NotAllowed/i.test(message)) {
          setError("Microphone access is blocked, so Nexa cannot listen for its name.");
        } else if (/AccessKey|activation|401|403/i.test(message)) {
          setError("Wake word is not licensed for this deployment.");
        } else if (/fetch|404|network|Failed to load/i.test(message)) {
          setError("Wake word model is missing, so “Hey Nexa” is unavailable.");
        } else {
          setError("Wake word could not start.");
        }
        setListening(false);
        // Switch off rather than retrying: none of these clear on their own, and a retry
        // loop against a missing model would hammer the network for the whole session.
        setEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      setListening(false);
      const worker = workerRef.current;
      const processor = processorRef.current;
      workerRef.current = null;
      processorRef.current = null;
      // Release the microphone before tearing the engine down, so a call starting right
      // after this never races the wake listener for the input device.
      if (processor && worker) {
        void Promise.resolve(processor.unsubscribe(worker))
          .catch(() => {})
          .finally(() => { void worker.terminate?.(); });
      } else if (worker) {
        void worker.terminate?.();
      }
    };
  }, [available, enabled, paused]);

  return { available, enabled, listening, loading, error, toggle };
}
