import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Where the call currently is in its turn-taking cycle.
 *
 * connecting → listening → capturing → thinking → speaking → listening → …
 *
 * "listening" means the mic is open and we are waiting for speech to start;
 * "capturing" means you are mid-sentence and we are waiting for you to finish.
 */
export type CallStatus = "connecting" | "listening" | "capturing" | "thinking" | "speaking" | "error";

type UseVoiceCallOptions = {
  /** Drives the whole lifecycle: the mic opens when this goes true and everything tears down when it goes false. */
  active: boolean;
  token: string | null;
  /** Hand a finished transcript to the app, resolve with the text Nexa should say back. */
  onTurn: (transcript: string) => Promise<string>;
  /** Surfaced to the user; the call keeps running unless `fatal` is set. */
  onError?: (message: string, fatal: boolean) => void;
};

/** Silence this long after you have spoken ends your turn. Short enough to feel responsive, long enough to survive a mid-sentence pause. */
const END_OF_TURN_SILENCE_MS = 800;
/** Frames above threshold before we believe speech started, so a single click or knock cannot trigger a turn. */
const SPEECH_ONSET_FRAMES = 3;
/** Barge-in needs more evidence than turn onset: the speaker is bleeding into the mic, and a false trigger cuts Nexa off mid-word. */
const BARGE_IN_FRAMES = 6;
const BARGE_IN_MULTIPLIER = 2.2;
/** A single turn cannot run forever; force the turn closed rather than uploading a huge clip. */
const MAX_TURN_MS = 30_000;
/** While waiting for speech we roll the recorder over so an idle call never accumulates minutes of silence. */
const IDLE_RECORDER_RESET_MS = 10_000;
/** Absolute floor for the speech threshold, so a silent room cannot calibrate itself into hair-trigger sensitivity. */
const MIN_SPEECH_THRESHOLD = 0.014;
const NOISE_FLOOR_MULTIPLIER = 3;
const CALIBRATION_MS = 400;

/**
 * Roughly a sentence or two of speech. We synthesise the reply in chunks and play them
 * back to back so Nexa starts talking after the first chunk instead of after the whole
 * answer has been generated, which on a long reply is several seconds of dead air.
 */
const TTS_CHUNK_TARGET_CHARS = 180;

/**
 * These calls use fetch rather than axios (FormData upload, and no interceptors wanted),
 * so they do not inherit the axios baseURL set in main.tsx. In dev the Vite proxy makes a
 * relative path work either way; in production the frontend and backend are on different
 * hosts, so a relative path would hit the static site instead of the API.
 */
function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Pick a container the browser can actually record. Safari has no WebM encoder, so mp4 is the fallback. */
function pickRecorderMime(): { mimeType: string; extension: string } | null {
  const candidates: { mimeType: string; extension: string }[] = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "mp4" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return null;
}

/**
 * Split a reply for synthesis, breaking on sentence ends so each chunk sounds like a
 * complete thought. Splitting mid-sentence makes the seam between chunks audible.
 */
function chunkForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || (text.trim() ? [text] : []);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TTS_CHUNK_TARGET_CHARS) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export function useVoiceCall({ active, token, onTurn, onError }: UseVoiceCallOptions) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [muted, setMuted] = useState(false);
  /** Your last utterance and Nexa's last reply, shown as captions on the call screen. */
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outAnalyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  /** Smoothed 0..1 level the visualiser reads every frame without re-rendering React. */
  const levelRef = useRef(0);
  /** Read inside the analysis loop, which must never close over a stale status. */
  const statusRef = useRef<CallStatus>("connecting");
  const mutedRef = useRef(false);
  const activeRef = useRef(active);

  /**
   * The caller re-creates these on most renders. Holding them in refs keeps them out of
   * the effect dependency lists below, otherwise the analysis loop would restart, and the
   * audio graph would tear down and re-open, on every single render of the parent.
   */
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const noiseFloorRef = useRef(0);
  const calibratingUntilRef = useRef(0);
  const voiceFramesRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const speechDetectedRef = useRef(false);
  const turnStartedAtRef = useRef(0);
  const recorderInfoRef = useRef<{ mimeType: string; extension: string } | null>(null);
  /** Set when a recorder stop should be thrown away (idle rollover, hang-up) rather than transcribed. */
  const discardRef = useRef(false);

  const setCallStatus = useCallback((next: CallStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /** Level for the visualiser: Nexa's output while she talks, your mic the rest of the time. */
  const getLevel = useCallback(() => levelRef.current, []);

  const stopPlayback = useCallback(() => {
    const el = audioElRef.current;
    if (el) {
      el.pause();
      el.onended = null;
      el.onerror = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  /** Begin a fresh listening window: recorder rolling, VAD counters cleared. */
  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const stream = streamRef.current;
    const info = recorderInfoRef.current;
    if (!stream || !info) return;

    // Never leave a recorder running on the same stream. A barge-in can start listening
    // while the turn that was interrupted is still unwinding, and without this the old
    // recorder is orphaned: still capturing, never stopped, its chunks never read.
    const existing = recorderRef.current;
    if (existing && existing.state !== "inactive") {
      existing.onstop = null;
      try { existing.stop(); } catch { /* already stopping */ }
    }
    recorderRef.current = null;

    speechDetectedRef.current = false;
    voiceFramesRef.current = 0;
    lastVoiceAtRef.current = 0;
    turnStartedAtRef.current = performance.now();
    chunksRef.current = [];
    discardRef.current = false;

    try {
      // Recording starts before speech does, on purpose. Starting it only once the VAD
      // fires would clip the first syllable of every sentence, which is exactly the word
      // that carries the intent ("cancel", "no", "stop").
      const recorder = new MediaRecorder(stream, { mimeType: info.mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(200);
      recorderRef.current = recorder;
      setCallStatus("listening");
    } catch {
      onErrorRef.current?.("Could not start recording from your microphone.", true);
      setCallStatus("error");
    }
  }, [setCallStatus]);

  /** Speak one reply, chunk by chunk, prefetching the next while the current one plays. */
  const speak = useCallback(
    async (text: string) => {
      const chunks = chunkForSpeech(text);
      if (chunks.length === 0) return;

      const fetchChunk = async (chunk: string): Promise<Blob | null> => {
        try {
          const res = await fetch(apiUrl("/api/v1/chat/tts"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
            body: JSON.stringify({ text: chunk }),
          });
          if (!res.ok) {
            const detail = await res.json().catch(() => null);
            throw new Error(detail?.error || `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { audio: string };
          const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
          return new Blob([bytes], { type: "audio/mpeg" });
        } catch (err) {
          onErrorRef.current?.(err instanceof Error ? err.message : "Couldn't generate speech", true);
          return null;
        }
      };

      let pending = fetchChunk(chunks[0]);
      for (let i = 0; i < chunks.length; i++) {
        const blob = await pending;
        // Hung up or interrupted while the audio was being generated.
        if (!activeRef.current || statusRef.current !== "speaking") return;
        if (!blob) return;
        pending = i + 1 < chunks.length ? fetchChunk(chunks[i + 1]) : Promise.resolve(null);

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const el = audioElRef.current!;
        el.src = url;

        try {
          await new Promise<void>((resolve, reject) => {
            el.onended = () => resolve();
            el.onerror = () => reject(new Error("Playback failed"));
            el.play().catch(reject);
          });
        } catch {
          // A barge-in pauses the element mid-chunk, which surfaces here as a rejection.
          // That is a normal interruption, not a failure worth reporting.
          if (statusRef.current === "speaking") onErrorRef.current?.("Couldn't play Nexa's reply.", false);
          return;
        } finally {
          URL.revokeObjectURL(url);
          if (audioUrlRef.current === url) audioUrlRef.current = null;
        }
      }
    },
    []
  );

  /** Transcribe the captured turn, get a reply, speak it, then hand the mic back. */
  const runTurn = useCallback(
    async (audio: Blob) => {
      const info = recorderInfoRef.current;
      setCallStatus("thinking");
      try {
        const form = new FormData();
        form.append("audio", audio, `speech.${info?.extension || "webm"}`);
        const res = await fetch(apiUrl("/api/v1/chat/transcribe"), {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          body: form,
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error || `HTTP ${res.status}`);
        }
        const { text } = (await res.json()) as { text: string };
        if (!activeRef.current) return;

        // Nothing intelligible: go straight back to listening rather than making the
        // user sit through "sorry, I didn't catch that" on every stray noise.
        if (!text.trim()) {
          startListening();
          return;
        }

        setTranscript(text.trim());
        const answer = await onTurnRef.current(text.trim());
        if (!activeRef.current) return;

        const spoken = (answer || "").trim();
        if (!spoken) {
          startListening();
          return;
        }
        setReply(spoken);
        setCallStatus("speaking");
        await speak(spoken);
      } catch (err) {
        if (!activeRef.current) return;
        onErrorRef.current?.(err instanceof Error ? err.message : "Something went wrong on that turn.", false);
      } finally {
        // Whatever happened, the call continues — hand the mic back. Unless a barge-in
        // already did: interrupting reopens the mic itself, and restarting it here would
        // throw away the opening words the user has by now already spoken.
        const alreadyListening = statusRef.current === "listening" || statusRef.current === "capturing";
        if (activeRef.current && !alreadyListening) startListening();
      }
    },
    [setCallStatus, speak, startListening]
  );

  /** Close the current turn and send it for transcription. */
  const endTurn = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const info = recorderInfoRef.current;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: info?.mimeType || "audio/webm" });
      chunksRef.current = [];
      recorderRef.current = null;
      if (discardRef.current || !activeRef.current) return;
      void runTurn(blob);
    };
    recorder.stop();
  }, [runTurn]);

  /**
   * One rAF loop drives everything: the level meter, end-of-turn detection, and barge-in.
   * Levels live in a ref rather than state so the visualiser can animate at 60fps without
   * re-rendering the React tree on every frame.
   */
  useEffect(() => {
    if (!active) return;

    const buffer = new Uint8Array(1024);
    const readLevel = (analyser: AnalyserNode | null) => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buffer.length);
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const state = statusRef.current;
      const micLevel = readLevel(micAnalyserRef.current);
      const outLevel = readLevel(outAnalyserRef.current);

      // Show whichever side of the call is actually making sound.
      const target = state === "speaking" ? outLevel : mutedRef.current ? 0 : micLevel;
      // Asymmetric smoothing: jump to peaks so the meter feels live, ease down so it does not flicker.
      levelRef.current = target > levelRef.current
        ? levelRef.current + (target - levelRef.current) * 0.5
        : levelRef.current + (target - levelRef.current) * 0.12;

      const now = performance.now();

      // Spend the first moments of the call measuring the room so the threshold suits
      // a noisy office as well as a quiet one.
      if (calibratingUntilRef.current && now < calibratingUntilRef.current) {
        noiseFloorRef.current = Math.max(noiseFloorRef.current, micLevel);
        return;
      }
      const threshold = Math.max(MIN_SPEECH_THRESHOLD, noiseFloorRef.current * NOISE_FLOOR_MULTIPLIER);

      if (mutedRef.current) return;

      if (state === "listening" || state === "capturing") {
        if (micLevel > threshold) {
          voiceFramesRef.current++;
          lastVoiceAtRef.current = now;
          if (!speechDetectedRef.current && voiceFramesRef.current >= SPEECH_ONSET_FRAMES) {
            speechDetectedRef.current = true;
            setCallStatus("capturing");
          }
        } else {
          voiceFramesRef.current = 0;
        }

        if (speechDetectedRef.current) {
          const silentFor = now - lastVoiceAtRef.current;
          const turnLength = now - turnStartedAtRef.current;
          if (silentFor > END_OF_TURN_SILENCE_MS || turnLength > MAX_TURN_MS) {
            endTurn();
          }
        } else if (now - turnStartedAtRef.current > IDLE_RECORDER_RESET_MS) {
          // Nobody has said anything: roll the recorder rather than banking silence.
          discardRef.current = true;
          const recorder = recorderRef.current;
          if (recorder && recorder.state !== "inactive") {
            recorder.onstop = () => {
              chunksRef.current = [];
              recorderRef.current = null;
              if (activeRef.current) startListening();
            };
            recorder.stop();
          }
        }
        return;
      }

      if (state === "speaking") {
        // Barge-in. Echo cancellation removes most of Nexa's own voice from the mic, but
        // not all of it on loudspeakers, so this needs a higher bar than turn onset.
        if (micLevel > threshold * BARGE_IN_MULTIPLIER) {
          voiceFramesRef.current++;
          if (voiceFramesRef.current >= BARGE_IN_FRAMES) {
            voiceFramesRef.current = 0;
            stopPlayback();
            startListening();
          }
        } else {
          voiceFramesRef.current = 0;
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, endTurn, setCallStatus, startListening, stopPlayback]);

  /** Open and tear down the audio graph as the call starts and ends. */
  useEffect(() => {
    activeRef.current = active;
    if (!active) return;

    let cancelled = false;
    setCallStatus("connecting");
    setTranscript("");
    setReply("");
    levelRef.current = 0;
    noiseFloorRef.current = 0;

    const start = async () => {
      const info = pickRecorderMime();
      if (!info || !navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current?.("Voice calls aren't supported in this browser.", true);
        setCallStatus("error");
        return;
      }
      recorderInfoRef.current = info;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Echo cancellation is what makes barge-in possible on speakers: without it
          // Nexa's own voice comes back through the mic and interrupts her constantly.
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        onErrorRef.current?.("Microphone access is blocked. Allow it in your browser to use voice mode.", true);
        setCallStatus("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      audioCtxRef.current = ctx;
      // Browsers start the context suspended unless it was created in a gesture; the call
      // button is one, but resume anyway so a re-entered call is never silent.
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});

      const micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micAnalyser.smoothingTimeConstant = 0.4;
      ctx.createMediaStreamSource(stream).connect(micAnalyser);
      micAnalyserRef.current = micAnalyser;

      // Nexa's playback runs through the graph too, so the same visualiser can show her voice.
      const el = new Audio();
      el.crossOrigin = "anonymous";
      audioElRef.current = el;
      const outAnalyser = ctx.createAnalyser();
      outAnalyser.fftSize = 2048;
      outAnalyser.smoothingTimeConstant = 0.4;
      const elSource = ctx.createMediaElementSource(el);
      elSource.connect(outAnalyser);
      outAnalyser.connect(ctx.destination);
      outAnalyserRef.current = outAnalyser;

      calibratingUntilRef.current = performance.now() + CALIBRATION_MS;
      startListening();
    };

    void start();

    return () => {
      cancelled = true;
      activeRef.current = false;
      discardRef.current = true;

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* already stopping */ }
      }
      recorderRef.current = null;
      chunksRef.current = [];

      stopPlayback();
      audioElRef.current = null;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      micAnalyserRef.current = null;
      outAnalyserRef.current = null;
      void audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;

      levelRef.current = 0;
      setMuted(false);
      mutedRef.current = false;
    };
  }, [active, setCallStatus, startListening, stopPlayback]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      // Disable the track itself rather than just ignoring levels, so the browser's
      // in-use indicator matches what the UI claims.
      streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

  /** Cut Nexa off mid-sentence and take the turn back. */
  const interrupt = useCallback(() => {
    if (statusRef.current !== "speaking") return;
    stopPlayback();
    startListening();
  }, [startListening, stopPlayback]);

  return { status, muted, toggleMute, transcript, reply, getLevel, interrupt };
}
