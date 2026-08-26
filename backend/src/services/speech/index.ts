import logger from "../../utils/logger";
import { azureSpeechProvider } from "./azureSpeechProvider";
import { elevenLabsProvider } from "./elevenLabsProvider";
import { SpeechError, type SpeechProvider, type SpeechQuota, type SpeechResult } from "./types";

export { SpeechError };
export type { SpeechAlignment, SpeechResult, SpeechQuota } from "./types";

const PROVIDERS: Record<string, SpeechProvider> = {
  azure: azureSpeechProvider,
  elevenlabs: elevenLabsProvider,
};

/**
 * Which vendor speaks, chosen by SPEECH_PROVIDER ("azure" or "elevenlabs").
 *
 * Falls back to whichever is actually configured rather than failing outright, so a
 * missing or misspelled value degrades to a working voice instead of a silent app.
 */
function resolveProvider(): SpeechProvider {
  const requested = (process.env.SPEECH_PROVIDER || "").trim().toLowerCase();
  const chosen = PROVIDERS[requested];

  if (chosen?.isConfigured()) return chosen;

  if (requested && chosen && !chosen.isConfigured()) {
    logger.warn(`[Speech] SPEECH_PROVIDER=${requested} is not configured; falling back`);
  } else if (requested && !chosen) {
    logger.warn(`[Speech] Unknown SPEECH_PROVIDER "${requested}"; falling back`);
  }

  const fallback = [azureSpeechProvider, elevenLabsProvider].find((p) => p.isConfigured());
  if (fallback) {
    logger.warn(`[Speech] Using ${fallback.name} for text-to-speech`);
    return fallback;
  }

  logger.warn("[Speech] No speech provider is configured — read-aloud and voice mode will fail");
  return chosen || elevenLabsProvider;
}

// Resolved once at startup: the answer cannot change without a restart, and logging the
// decision on every request would be noise.
const provider = resolveProvider();

logger.info(`[Speech] Text-to-speech provider: ${provider.name}`);

/** Which vendor is live, for diagnostics. */
export const activeSpeechProvider = provider.name;

export function synthesizeSpeech(text: string): Promise<SpeechResult> {
  return provider.synthesize(text);
}

export function getSpeechQuota(): Promise<SpeechQuota> {
  return provider.quota();
}
