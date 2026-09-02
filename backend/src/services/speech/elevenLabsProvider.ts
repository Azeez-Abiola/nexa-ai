import { synthesizeSpeech as elevenLabsSynthesize, getSpeechQuota as elevenLabsQuota } from "../elevenLabsService";
import type { SpeechIntent, SpeechProvider, SpeechQuota, SpeechResult } from "./types";

/**
 * The existing ElevenLabs service, wrapped to fit the shared contract.
 *
 * Deliberately a thin adapter rather than a rewrite: it still returns per-character
 * alignment, which is what drives word-by-word highlighting in read-aloud, and that is
 * the one thing Azure cannot currently match.
 */
export const elevenLabsProvider: SpeechProvider = {
  name: "elevenlabs",

  isConfigured() {
    return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
  },

  // ElevenLabsError extends SpeechError, so failures already satisfy the contract.
  synthesize(text: string, intent?: SpeechIntent): Promise<SpeechResult> {
    return elevenLabsSynthesize(text, intent);
  },

  quota(): Promise<SpeechQuota> {
    return elevenLabsQuota();
  },
};
