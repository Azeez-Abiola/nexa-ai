/**
 * Post-process assistant replies so structured source pills (rendered by the UI)
 * aren't duplicated by inline "Source:" lines the model may emit anyway.
 */

const INLINE_SOURCE_LINE_RE = /^Source:\s*.+$/gim;

const VAGUE_CITATION_PHRASES = [
  /\bas cited above\b/gi,
  /\bcurrent version\b/gi,
  /\blatest version\b/gi,
  /\bN\/A\b/g,
];

/** Remove inline Source: lines when the UI will show source pills. */
export function stripInlineSourceLines(content: string): string {
  return content.replace(INLINE_SOURCE_LINE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Remove vague citation placeholders models sometimes emit despite prompt rules. */
export function stripVagueCitationPhrases(content: string): string {
  let out = content;
  for (const re of VAGUE_CITATION_PHRASES) {
    out = out.replace(re, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeAssistantResponse(
  content: string,
  options: { hasStructuredSources?: boolean } = {}
): string {
  let out = content;
  if (options.hasStructuredSources) {
    out = stripInlineSourceLines(out);
  }
  return stripVagueCitationPhrases(out);
}
