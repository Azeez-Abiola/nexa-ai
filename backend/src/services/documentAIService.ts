import OpenAI from "openai";
import { DocxContent, XlsxContent, PptxContent } from "./documentGeneratorService";

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

async function callJsonModel(system: string, userPrompt: string): Promise<string> {
  // Use gpt-4o specifically — JSON mode requires Chat Completions API which gpt-5 does not support
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? "{}";
}

export async function generateDocumentContent(
  prompt: string,
  documentType: DocumentType
): Promise<DocxContent | XlsxContent | PptxContent> {
  if (documentType === "xlsx") {
    const raw = await callJsonModel(XLSX_SYSTEM, prompt);
    const parsed = JSON.parse(raw) as XlsxContent;
    if (!parsed.sheets || !Array.isArray(parsed.sheets) || parsed.sheets.length === 0) {
      throw new Error("AI returned invalid spreadsheet structure");
    }
    return parsed;
  }

  if (documentType === "pptx") {
    const raw = await callJsonModel(PPTX_SYSTEM, prompt);
    const parsed = JSON.parse(raw) as PptxContent;
    if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error("AI returned invalid presentation structure");
    }
    return parsed;
  }

  // docx and pdf share the same structure
  const raw = await callJsonModel(DOCX_SYSTEM, prompt);
  const parsed = JSON.parse(raw) as DocxContent;
  if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("AI returned invalid document structure");
  }
  return parsed;
}
