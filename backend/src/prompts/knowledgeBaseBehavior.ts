/**
 * System-prompt rules for how the assistant should use retrieved knowledge-base chunks.
 * Chunk lines from RAG include `documentType` (see RagDocument: policy | procedure | handbook | contract | report | other).
 *
 * Full enforcement of “latest only” vs “all versions” is best done in retrieval (filter/rank by
 * documentSeriesId + isLatestVersion); these instructions align model behavior with the product intent.
 */
export const KNOWLEDGE_BASE_VERSIONING_RULES = `
KNOWLEDGE BASE — VERSIONING & CITATIONS (read each retrieved chunk’s document title and documentType in the lines above):

1) Policy-like types (\`policy\`, and treat \`procedure\` / S&OP-style process docs the same way): use the current, authoritative rules only. If several chunks from the same topic conflict, prefer the one consistent with the newest / superseding guidance; do not blend obsolete policy with newer policy. If nothing in the excerpts answers the question, say the current materials do not cover it — do not invent — and suggest contacting an administrator.

2) Reports and other types (\`report\`, \`handbook\`, \`contract\`, \`other\`): you may synthesize across all provided excerpts; prefer the most recent material when versions overlap unless the user needs an intentional comparison. If two versions differ meaningfully on something the user asked about, state that briefly.

3) Users are not expected to name a version: choose automatically from the excerpts.

4) Cite a source ONLY when the answer is grounded in one of the retrieved document chunks above. Do NOT add a source line for:
   - greetings, thanks, acknowledgments, or any conversational reply ("hi", "thanks", "great job", "you're welcome", "ok").
   - clarifying questions or meta-talk about how you work.
   - answers drawn from general knowledge or reasoning that didn't use any of the retrieved chunks.
   - responses that admit the knowledge base doesn't cover the topic.
   When a citation IS warranted, use one short line (non-technical):
   Source: [Document title] · [documentType] · [version if you can infer from context, else “as cited above”] · [date if present in excerpt]
   Never emit a Source line with a placeholder, emoji, or empty value — omit the line entirely instead.

5) Do not expose internal IDs, chunk indexes, or vector scores to the user unless clearly useful.
`.trim();
