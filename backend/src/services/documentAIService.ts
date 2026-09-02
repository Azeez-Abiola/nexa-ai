import OpenAI from "openai";
import { DocxContent, XlsxContent, PptxContent } from "./documentGeneratorService";
import { generateJsonContent as claudeGenerateJsonContent } from "./claudeService";
import { generateJsonContent as kimiGenerateJsonContent } from "./kimiService";
import { generateJsonContent as deepseekGenerateJsonContent } from "./deepseekService";
import { AIModel, failoverChain } from "./aiRouter";
import logger from "../utils/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type DocumentType = "docx" | "xlsx" | "pptx" | "pdf";

const DOCX_SYSTEM = `You are a professional document writer. Given a user's request, produce a well-structured document in JSON.
Respond ONLY with valid JSON — no markdown fences, no extra text.
Format:
{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Section Heading",
      "level": 1,
      "paragraphs": ["paragraph 1", "paragraph 2"]
    }
  ]
}
Rules:
- heading is optional for the first section if the title already captures it
- level must be 1, 2, or 3
- Each paragraph should be a complete, coherent sentence or group of sentences
- Write substantive, professional content — not placeholder text`;

const XLSX_SYSTEM = `You are a data analyst. Given a user's request, produce structured spreadsheet data in JSON.
Respond ONLY with valid JSON — no markdown fences, no extra text.
Format:
{
  "sheets": [
    {
      "name": "Sheet Name",
      "headers": ["Column 1", "Column 2", "Column 3"],
      "rows": [
        ["value1", "value2", "value3"]
      ]
    }
  ]
}
Rules:
- Sheet name must be max 31 characters
- Include realistic, meaningful sample data appropriate to the request
- At least 5 data rows per sheet
- All values in rows must be strings`;

const PPTX_SYSTEM = `You are a presentation designer. Given a user's request, produce a structured presentation in JSON.
Respond ONLY with valid JSON — no markdown fences, no extra text.
Format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "notes": "Optional speaker notes"
    }
  ]
}
Rules:
- Include 6–12 slides for a typical presentation
- Each slide should have 3–5 concise bullet points
- Bullets should be short phrases, not full sentences
- notes is optional but helpful for complex slides
- The first slide content will be used as an agenda or overview`;

/** Ask one specific provider for the JSON. Throws on failure; the caller handles failover. */
async function callOneModel(system: string, userPrompt: string, model: AIModel): Promise<string> {
  if (model === "claude") {
    return claudeGenerateJsonContent(system, userPrompt);
  }
  if (model === "kimi") {
    return kimiGenerateJsonContent(system, userPrompt);
  }
  if (model === "deepseek") {
    return deepseekGenerateJsonContent(system, userPrompt);
  }
  // Use gpt-4o specifically — JSON mode requires Chat Completions API which gpt-5 does not support
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    // gpt-4o allows more, and documents run long; 4000 truncated them mid-JSON.
    max_tokens: 16000,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? "{}";
}

/**
 * The selected model, then any other configured one.
 *
 * Chat has had this for a while; document generation did not, so a single dead provider
 * meant no file at all while three working models sat idle. That is exactly what
 * happened when Moonshot retired the pinned Kimi model: replies kept arriving via the
 * chat router's failover, and every document request failed.
 */
async function callJsonModel(system: string, userPrompt: string, model: AIModel = "gpt"): Promise<string> {
  const chain = failoverChain(model);
  let lastError: unknown;

  for (const provider of chain) {
    try {
      const raw = await callOneModel(system, userPrompt, provider);
      if (provider !== model) {
        logger.info("[DocumentGen] Served by fallback provider", { requested: model, servedBy: provider });
      }
      return raw;
    } catch (err) {
      lastError = err;
      // Named, because the previous log said only that generation failed. Working out
      // which provider was even asked took a database query and four probes.
      logger.warn("[DocumentGen] Provider failed", {
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All providers failed to generate document content");
}

/**
 * Parse the model's JSON, or say plainly that it did not return usable JSON.
 *
 * The raw failure is "Unexpected end of JSON input", which describes the symptom of a
 * truncated response without naming the cause. Whoever reads the log needs to know the
 * model ran out of room rather than that the parser is broken.
 */
function parseDocumentJson<T>(raw: string, documentType: DocumentType): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const truncated = raw.length > 0 && !raw.trimEnd().endsWith("}");
    throw new Error(
      truncated
        ? `Model response for the ${documentType} was cut off before the JSON finished (${raw.length} chars). The document is likely too long for one response.`
        : `Model did not return valid JSON for the ${documentType}.`
    );
  }
}

export async function generateDocumentContent(
  prompt: string,
  documentType: DocumentType,
  model: AIModel = "gpt"
): Promise<DocxContent | XlsxContent | PptxContent> {
  if (documentType === "xlsx") {
    const raw = await callJsonModel(XLSX_SYSTEM, prompt, model);
    const parsed = parseDocumentJson<XlsxContent>(raw, documentType);
    if (!parsed.sheets || !Array.isArray(parsed.sheets) || parsed.sheets.length === 0) {
      throw new Error("AI returned invalid spreadsheet structure");
    }
    return parsed;
  }

  if (documentType === "pptx") {
    const raw = await callJsonModel(PPTX_SYSTEM, prompt, model);
    const parsed = parseDocumentJson<PptxContent>(raw, documentType);
    if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error("AI returned invalid presentation structure");
    }
    return parsed;
  }

  // docx and pdf share the same structure
  const raw = await callJsonModel(DOCX_SYSTEM, prompt, model);
  const parsed = parseDocumentJson<DocxContent>(raw, documentType);
  if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("AI returned invalid document structure");
  }
  return parsed;
}
