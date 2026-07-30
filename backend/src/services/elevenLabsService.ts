import logger from "../utils/logger";

if (!process.env.ELEVENLABS_API_KEY) {
  logger.warn("[ElevenLabsService] ELEVENLABS_API_KEY not set — text-to-speech requests will fail at runtime");
}

// "Rachel" — a stock ElevenLabs voice, used only if ELEVENLABS_VOICE_ID isn't configured.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MAX_CHARS = 5000;

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const trimmed = text.trim().slice(0, MAX_CHARS);
  if (!trimmed) throw new Error("No text to synthesize");

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
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
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
