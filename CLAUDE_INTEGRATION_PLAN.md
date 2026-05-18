# Execution Plan: Add Claude (Anthropic) to Nexa AI

## Overview
Add Claude as a second AI model option alongside GPT-5. Users pick their preferred model per query via a toggle in the chat UI. The backend routes the request to the correct service.

---

## Current State
- GPT-5 is the only AI provider, hardcoded in `backend/src/services/openaiService.ts`
- Model is set via `process.env.OPEN_AI_MODEL` — no per-request selection
- No model selector UI exists
- Streaming is done via SSE (`text/event-stream`) — same mechanism works for Claude
- Document generation (docx, pptx, xlsx, pdf) lives in a **separate** service: `backend/src/services/documentAIService.ts`
  - Uses `gpt-4o` with `response_format: { type: "json_object" }` to produce structured JSON
  - That JSON is then passed to `documentGeneratorService.ts` to build the actual file
  - This is triggered when the user's message is detected as a document generation request in `conversation.ts`

---

## New Files to Create

### 1. `backend/src/services/claudeService.ts`
The Claude equivalent of `openaiService.ts`. Exports the same function signatures so routes can call either service identically.

```
Exports:
  - generateAIResponse(userMessage, policies, conversationHistory, businessUnit?, customSystemPrompt?) → Promise<string>
  - streamAIResponse(userMessage, policies, conversationHistory, businessUnit?, customSystemPrompt?, imageAttachments?) → AsyncGenerator<string>
```

Implementation notes:
- Uses `@anthropic-ai/sdk` (already installed ✅)
- Model: `process.env.CLAUDE_MODEL || "claude-opus-4-7"`
- System prompt passed in top-level `system` field (not inside `messages[]`)
- Streaming: `claude.messages.stream({...})` → iterate `stream.text_stream`
- Images: Anthropic `{ type: "image", source: { type: "base64", media_type, data } }` format
- Retry logic: 3 attempts, exponential backoff, retries on 429 / 5xx / network errors
- 90-second AbortController timeout
- Warns on startup if `ANTHROPIC_API_KEY` is missing (does not crash server)

---

### 2. `backend/src/services/aiRouter.ts`
Thin dispatch module. Routes call to the correct service based on a `model` string.

```ts
export type AIModel = "gpt" | "claude";

export function parseModel(raw: unknown): AIModel
// Returns "claude" if raw === "claude", otherwise "gpt" (safe default)

export function getStreamAIResponse(model: AIModel): typeof streamAIResponse
// Returns claudeService.streamAIResponse or openaiService.streamAIResponse

export function getGenerateAIResponse(model: AIModel): typeof generateAIResponse
// Returns claudeService.generateAIResponse or openaiService.generateAIResponse
```

---

## Files to Modify

### 3. `backend/src/services/documentAIService.ts` ⚠️ CRITICAL
**Document generation must work when Claude is selected — otherwise users get a broken experience.**

Currently `callJsonModel()` is hardcoded to `gpt-4o`. We need it to also support Claude.

Changes:
- Update `callJsonModel(system, userPrompt)` to accept a third `model: AIModel` param
- When `model === "claude"`: call `claude.messages.create()` with the same system + user prompt, instructing it to return only valid JSON (Claude follows this reliably without a formal JSON mode)
- When `model === "gpt"`: keep existing `gpt-4o` + `response_format: json_object` path unchanged
- Add a `stripJsonFences(raw: string)` helper to strip any accidental ` ```json ``` ` wrapping from Claude's output before parsing
- Update `generateDocumentContent(prompt, documentType)` signature to `generateDocumentContent(prompt, documentType, model: AIModel = "gpt")`

```ts
// Before
export async function generateDocumentContent(prompt, documentType)

// After
export async function generateDocumentContent(prompt, documentType, model: AIModel = "gpt")
```

Then in `conversation.ts`, pass the active model through to `generateDocumentContent`:
```ts
// Before
const docContent = await generateDocumentContent(docPrompt, docType);

// After
const docContent = await generateDocumentContent(docPrompt, docType, model);
```

This ensures Claude users can generate all four document types without falling back to GPT silently.

---

### 4. `backend/src/services/openaiService.ts`
**Change:** Add `export` keyword to `buildSystemPrompt` so `claudeService.ts` can import and reuse it.

```diff
- function buildSystemPrompt(correctBUName, policyContext, hasPolicies) {
+ export function buildSystemPrompt(correctBUName, policyContext, hasPolicies) {
```

---

### 5. `backend/src/routes/conversation.ts`
**Primary authenticated chat endpoint** — handles streaming + non-streaming + document generation.

Changes:
- Import `parseModel`, `getStreamAIResponse`, `getGenerateAIResponse` from `aiRouter`
- In `message-stream` handler: extract `model = parseModel(req.body.model)` after multer runs
- Replace `streamAIResponse(...)` with `getStreamAIResponse(model)(...)`
- In `/:id/message` handler: same — extract model, use `getGenerateAIResponse(model)(...)`
- Pass `model` to `generateDocumentContent(docPrompt, docType, model)` so document generation also uses the selected model

```ts
// Before
const generator = streamAIResponse(aiUserMessage, policyContext, ...);
const docContent = await generateDocumentContent(docPrompt, docType);

// After
const model = parseModel(req.body.model);
const generator = getStreamAIResponse(model)(aiUserMessage, policyContext, ...);
const docContent = await generateDocumentContent(docPrompt, docType, model);
```

---

### 6. `backend/src/routes/chat.ts`
**Public (unauthenticated) chatbot endpoint.**

Changes:
- Import `parseModel`, `getStreamAIResponse` from `aiRouter`
- In `POST /public/stream`: extract `model = parseModel(req.body.model)`
- Replace `streamAIResponse(...)` with `getStreamAIResponse(model)(...)`

---

### 7. `frontend/src/App.tsx`
**Main authenticated chat UI.**

Changes:
- Add state: `const [selectedModel, setSelectedModel] = useState<"gpt" | "claude">("gpt")`
- Add `ModelToggle` inline component (pill button group: "GPT-5" | "Claude")
- Render `<ModelToggle />` in input toolbar at both locations (home screen + conversation footer)
- Update `streamResponse()` to accept and pass `model` param:
  - JSON body: `{ content, model: selectedModel }`
  - FormData: `formData.append("model", selectedModel)`

---

### 8. `frontend/src/chat/ChatBotMessageSection.tsx`
**Public landing page chatbot.**

Changes:
- Pass `model: "gpt"` in fetch body (ensures backend param is always handled)
- Optionally add a local model toggle with `useState<"gpt"|"claude">("gpt")`

---

### 9. `frontend/src/styles.css` (or equivalent)
**Add CSS for the model toggle pill:**

```css
.model-toggle { display: flex; align-items: center; gap: 2px; border: 1px solid rgba(0,0,0,0.15); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.04); }
.model-toggle-btn { padding: 3px 10px; font-size: 11px; font-weight: 500; border: none; background: transparent; cursor: pointer; color: rgba(0,0,0,0.5); }
.model-toggle-btn.active { background: white; color: var(--brand-color, #ed0000); box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 6px; }
```

---

### 10. `backend/.env`
**Add two lines:**
```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-7
```

---

## Execution Order

| # | Action | File |
|---|--------|------|
| 1 | ✅ Install `@anthropic-ai/sdk` | `backend/package.json` |
| 2 | Add `ANTHROPIC_API_KEY` + `CLAUDE_MODEL` to env | `backend/.env` |
| 3 | Export `buildSystemPrompt` | `openaiService.ts` |
| 4 | Create Claude service | `claudeService.ts` (new) |
| 5 | Create AI router | `aiRouter.ts` (new) |
| 6 | Update document AI service — Claude JSON generation + model param | `documentAIService.ts` ⚠️ |
| 7 | Update conversation route — pass model to AI + doc generation | `conversation.ts` |
| 8 | Update chat route | `chat.ts` |
| 9 | Add model state + toggle UI | `App.tsx` |
| 10 | Pass model in public chatbot | `ChatBotMessageSection.tsx` |
| 11 | Add toggle CSS | `styles.css` |

---

## Verification Steps

1. `npm run build` in backend — zero TypeScript errors
2. Send a message with **GPT-5** selected — response streams as before
3. Switch to **Claude**, send a message — Claude response streams correctly
4. Test file/image attachment with Claude selected — images handled correctly
5. With **Claude** selected, ask it to generate a `.docx`, `.pptx`, `.xlsx`, and `.pdf` — all four should download correctly
6. With **GPT-5** selected, repeat document generation — still works unchanged
7. Test public chatbot — still works (defaults to GPT)
8. Check network tab — request body includes `model: "gpt"` or `model: "claude"`

---

## Rollback
If Claude fails at runtime (missing API key, quota exceeded), `parseModel` defaults to `"gpt"` — so removing `ANTHROPIC_API_KEY` from env effectively disables Claude gracefully.
