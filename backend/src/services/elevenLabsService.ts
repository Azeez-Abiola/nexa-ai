import logger from "../utils/logger";

if (!process.env.ELEVENLABS_API_KEY) {
  logger.warn("[ElevenLabsService] ELEVENLABS_API_KEY not set — text-to-speech requests will fail at runtime");
}
if (!process.env.ELEVENLABS_VOICE_ID) {
  logger.warn("[ElevenLabsService] ELEVENLABS_VOICE_ID not set — text-to-speech requests will fail at runtime");
}

const MAX_CHARS = 5000;

/** Thrown with an HTTP status so the route can distinguish quota/plan problems from real faults. */
export class ElevenLabsError extends Error {
  constructor(message: string, readonly status: number, readonly upstreamStatus?: number) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const trimmed = text.trim().slice(0, MAX_CHARS);
  if (!trimmed) throw new ElevenLabsError("No text to synthesize", 400);

  // No hardcoded fallback voice on purpose. The stock library voices are not
  // usable via the API on a free plan (402 paid_plan_required), so guessing one
  // produces a failure that looks like an outage. Configure the voice explicitly.
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new ElevenLabsError("Text-to-speech is not configured", 503);

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: trimmed, model_id: modelId }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logger.error("[ElevenLabsService] TTS request failed", { status: res.status, body: errText.slice(0, 500) });

    // 401 bad key, 402 plan/voice not permitted, 429 monthly character quota gone.
    if (res.status === 401) throw new ElevenLabsError("Text-to-speech credentials are invalid", 503, 401);
    if (res.status === 402) throw new ElevenLabsError("This voice requires a paid ElevenLabs plan", 503, 402);
    if (res.status === 429) throw new ElevenLabsError("Monthly text-to-speech quota exhausted", 429, 429);
    throw new ElevenLabsError("Failed to generate speech", 502, res.status);
  }

  return Buffer.from(await res.arrayBuffer());
}

/** Remaining characters on the plan, so the UI can warn before the quota runs out. */
export async function getSpeechQuota(): Promise<{ used: number; limit: number } | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { character_count?: number; character_limit?: number };
    return { used: data.character_count ?? 0, limit: data.character_limit ?? 0 };
  } catch {
    return null;
  }
}
