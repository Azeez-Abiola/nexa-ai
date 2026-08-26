/**
 * The contract every speech provider implements, so the rest of the app never learns
 * which vendor is speaking. Swapping provider is then an environment variable rather
 * than a change to the chat route.
 */

/** Thrown with an HTTP status so routes can tell a client mistake from an upstream fault. */
export class SpeechError extends Error {
  constructor(message: string, readonly status: number, readonly upstreamStatus?: number) {
    super(message);
    this.name = "SpeechError";
  }
}

/**
 * Per-character playback timings, used to highlight each word as it is spoken.
 *
 * Optional by design: only some providers return it. ElevenLabs does, Azure's REST
 * endpoint does not, and the client already treats highlighting as a bonus and plays
 * the audio regardless.
 */
export type SpeechAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export type SpeechResult = {
  audioBase64: string;
  alignment: SpeechAlignment | null;
};

/** Remaining allowance, when the provider exposes it. Null means "cannot tell". */
export type SpeechQuota = { used: number; limit: number } | null;

export interface SpeechProvider {
  readonly name: string;
  /** False when the provider's credentials are absent, so the caller can fail cleanly. */
  isConfigured(): boolean;
  synthesize(text: string): Promise<SpeechResult>;
  quota(): Promise<SpeechQuota>;
}
