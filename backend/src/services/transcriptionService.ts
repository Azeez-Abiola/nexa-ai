import OpenAI, { toFile } from "openai";
import logger from "../utils/logger";

if (!process.env.OPENAI_API_KEY) {
  logger.warn("[TranscriptionService] OPENAI_API_KEY not set — speech-to-text requests will fail at runtime");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** OpenAI rejects audio above 25MB outright, so refuse it here rather than paying for the round trip. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Clips shorter than this are almost always a stray click or a room noise spike that
 * tripped the recorder. Transcribing them wastes a request and tends to come back as
 * a hallucinated "Thank you." or "Bye.", which in call mode gets spoken back at the user.
 */
const MIN_AUDIO_BYTES = 2 * 1024;

/** Thrown with an HTTP status so the route can separate client mistakes from real faults. */
export class TranscriptionError extends Error {
  constructor(message: string, readonly status: number, readonly upstreamStatus?: number) {
    super(message);
    this.name = "TranscriptionError";
  }
}

/**
 * Who does the listening: "openai" or "elevenlabs".
 *
 * Explicit rather than inferred. Both providers can be configured at once — a key being
 * present says nothing about whether it has credit — so picking automatically would mean
 * silently choosing a provider that cannot answer.
 */
const PROVIDER = (process.env.TRANSCRIBE_PROVIDER || "openai").trim().toLowerCase();

/**
 * Whisper is the safe default because every account with an OpenAI key can call it.
 * The gpt-4o transcribe models are faster and more accurate but are not enabled on
 * every account, so switching is opt-in via env rather than a surprise 404 in prod.
 */
const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

/** ElevenLabs' speech-to-text model. scribe_v1 is the generally available one. */
const ELEVENLABS_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

/**
 * Transcribe through ElevenLabs rather than OpenAI.
 *
 * Useful beyond a stopgap: an organisation already paying ElevenLabs to speak can have
 * it listen too, and keep both halves of a call with one vendor and one bill.
 */
async function transcribeWithElevenLabs(buffer: Buffer, filename: string): Promise<TranscriptionResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new TranscriptionError("Voice mode is temporarily unavailable. Please try again later.", 503);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("model_id", ELEVENLABS_STT_MODEL);

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
  } catch (error) {
    logger.error("[TranscriptionService] ElevenLabs request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new TranscriptionError("Couldn't make out what you said. Please try again.", 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("[TranscriptionService] ElevenLabs rejected the audio", {
      status: res.status,
      detail: detail.slice(0, 300),
    });
    // Same reticence as everywhere else: which vendor we use, and whether its balance
    // ran out, is ours to fix rather than the user's to read.
    if (res.status === 401) throw new TranscriptionError("Voice mode is temporarily unavailable. Please try again later.", 503, 401);
    if (res.status === 429) throw new TranscriptionError("Too many requests right now. Give it a moment and try again.", 429, 429);
    throw new TranscriptionError("Couldn't make out what you said. Please try again.", 502, res.status);
  }

  const data = (await res.json()) as { text?: string };
  return { text: (data?.text || "").trim() };
}

/**
 * Whisper guesses the language per clip, and on a short or noisy utterance it guesses
 * wrong often enough to return fluent nonsense in another language. Pinning it removes
 * that failure mode. Leave unset to keep auto-detection for multilingual deployments.
 */
const LANGUAGE = process.env.OPENAI_TRANSCRIBE_LANGUAGE || undefined;

export type TranscriptionResult = {
  text: string;
};

/**
 * Turn a recorded audio clip into text.
 *
 * `filename` matters more than it looks: the API picks its decoder from the extension,
 * so a WebM/Opus blob sent as "audio.wav" fails to decode. Pass the real container.
 */
export async function transcribeAudio(buffer: Buffer, filename: string): Promise<TranscriptionResult> {
  if (PROVIDER === "openai" && !process.env.OPENAI_API_KEY) {
    throw new TranscriptionError("Voice mode is temporarily unavailable. Please try again later.", 503);
  }
  if (!buffer?.length) {
    throw new TranscriptionError("No audio to transcribe", 400);
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new TranscriptionError("Recording is too long. Keep it under 25MB.", 413);
  }
  // Not an error: the caller recorded silence. Return empty text so call mode can
  // quietly go back to listening instead of surfacing a failure for a stray noise.
  if (buffer.length < MIN_AUDIO_BYTES) {
    return { text: "" };
  }

  if (PROVIDER === "elevenlabs") {
    return transcribeWithElevenLabs(buffer, filename);
  }

  try {
    const file = await toFile(buffer, filename);
    const result = await openai.audio.transcriptions.create({
      file,
      model: MODEL,
      ...(LANGUAGE ? { language: LANGUAGE } : {}),
      // Plain text keeps the response small; we have no use for word timings here.
      response_format: "text",
    });

    // response_format "text" resolves to a bare string, but the SDK's types cover every
    // format, so normalise both shapes rather than casting and hoping.
    const text = typeof result === "string" ? result : String((result as { text?: string })?.text ?? "");
    return { text: text.trim() };
  } catch (error) {
    const { status, code, type } = (error as { status?: number; code?: string; type?: string }) || {};
    logger.error("[TranscriptionService] Transcription failed", {
      status,
      code,
      type,
      message: error instanceof Error ? error.message : String(error),
    });

    if (status === 401) throw new TranscriptionError("Voice mode is temporarily unavailable. Please try again later.", 503, 401);

    // 429 is ambiguous at OpenAI: it covers both real throttling, which clears on its own
    // in seconds, and an exhausted balance, which never clears without someone topping up
    // the account. Reporting the second as the first sends people off to wait for a
    // recovery that cannot happen, so split them on the error type.
    // Deliberately vague to the user. Which provider we use and the state of its billing
    // is our problem, not theirs, and there is no action they could take anyway. The real
    // cause is in the log line above for whoever is on call.
    if (type === "insufficient_quota" || code === "credit_balance_exhausted") {
      throw new TranscriptionError("Voice mode is temporarily unavailable. Please try again later.", 402, 429);
    }
    if (status === 429) throw new TranscriptionError("Too many requests right now. Give it a moment and try again.", 429, 429);
    if (status === 413) throw new TranscriptionError("Recording is too long. Keep it under 25MB.", 413, 413);
    throw new TranscriptionError("Couldn't make out what you said. Please try again.", 502, status);
  }
}
