import logger from "../../utils/logger";
import { SpeechError, type SpeechIntent, type SpeechProvider, type SpeechQuota, type SpeechResult } from "./types";

/**
 * Azure AI Speech, via the REST endpoint rather than the Speech SDK.
 *
 * REST keeps this to one fetch and no extra dependency. The cost is word timings: those
 * arrive as WordBoundary events over the SDK's websocket and have no REST equivalent, so
 * alignment is null here and the client falls back to plain playback without
 * highlighting. Worth revisiting with the SDK if highlighting matters on Azure.
 */

const MAX_CHARS = 5000;

const KEY = process.env.AZURE_SPEECH_KEY || "";
/** e.g. "westeurope", "uksouth". Part of the hostname, so it must match the resource. */
const REGION = process.env.AZURE_SPEECH_REGION || "";

/**
 * Nigerian English by default, because that is who Nexa is speaking to. Azure ships
 * en-NG-EzinneNeural (female) and en-NG-AbeoNeural (male); override for anything else.
 */
const VOICE = process.env.AZURE_SPEECH_VOICE || "en-NG-EzinneNeural";

/** MP3 so the browser can play the bytes directly, matching the existing client. */
const OUTPUT_FORMAT = process.env.AZURE_SPEECH_FORMAT || "audio-24khz-48kbitrate-mono-mp3";

/** SSML is XML: unescaped user text can break the document or inject markup. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Language is derived from the voice name ("en-NG-EzinneNeural" -> "en-NG"). */
function localeFromVoice(voice: string): string {
  const parts = voice.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "en-US";
}

export const azureSpeechProvider: SpeechProvider = {
  name: "azure",

  isConfigured() {
    return Boolean(KEY && REGION);
  },

  // Intent is accepted and ignored: one neural voice, one latency profile.
  async synthesize(text: string, _intent?: SpeechIntent): Promise<SpeechResult> {
    const trimmed = text.trim().slice(0, MAX_CHARS);
    if (!trimmed) throw new SpeechError("No text to synthesize", 400);
    if (!this.isConfigured()) {
      throw new SpeechError("Voice mode is temporarily unavailable. Please try again later.", 503);
    }

    const ssml =
      `<speak version="1.0" xml:lang="${localeFromVoice(VOICE)}">` +
      `<voice name="${VOICE}">${escapeXml(trimmed)}</voice>` +
      `</speak>`;

    let res: Response;
    try {
      res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
          // Azure rejects requests without one.
          "User-Agent": "nexa-ai",
        },
        body: ssml,
      });
    } catch (error) {
      logger.error("[AzureSpeech] Request failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw new SpeechError("Couldn't generate speech. Please try again.", 502);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error("[AzureSpeech] Synthesis rejected", { status: res.status, detail: detail.slice(0, 300) });

      // Vague on purpose for anything the user cannot act on. Which vendor we use and
      // whether its quota ran out is ours to fix; the real cause is in the log above.
      if (res.status === 401 || res.status === 403) {
        throw new SpeechError("Voice mode is temporarily unavailable. Please try again later.", 503, res.status);
      }
      if (res.status === 429) {
        throw new SpeechError("Too many requests right now. Give it a moment and try again.", 429, 429);
      }
      throw new SpeechError("Couldn't generate speech. Please try again.", 502, res.status);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length === 0) throw new SpeechError("Couldn't generate speech. Please try again.", 502);

    return {
      audioBase64: audio.toString("base64"),
      // No REST equivalent of the SDK's word-boundary events; the client copes.
      alignment: null,
    };
  },

  async quota(): Promise<SpeechQuota> {
    // Azure exposes consumption through Cost Management, not the Speech endpoint, so
    // there is no cheap per-request answer. Null means "cannot tell", and the client
    // leaves the control enabled rather than guessing it is exhausted.
    return null;
  },
};
