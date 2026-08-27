/**
 * Connector spine check — `npm run check:connectors`.
 *
 * Exercises the parts of the connector gateway that can be verified without a
 * database or an API key: a real MCP session over the in-memory transport, the
 * caller-identity rule that keeps user context out of model-authored arguments, and
 * the three tool-calling dialects the four providers need.
 *
 * The point of the dialect checks is the last one: all three must agree on the tool
 * name. That single property is what "one connector, four models" reduces to, and it
 * is the kind of thing that breaks silently when a provider adapter is edited.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createKnowledgeBaseServer } from "../services/tools/mcp/knowledgeBaseServer";
import { callerMeta } from "../services/tools/mcp/callerContext";
import { toResponsesTools, toChatCompletionsTools } from "../services/tools/adapters/openaiShape";
import { toAnthropicTools } from "../services/tools/adapters/anthropicShape";
import { qualifyToolName, CanonicalTool, ToolContext } from "../services/tools/types";
import { createMicrosoftGraphServer } from "../services/tools/mcp/microsoftGraphServer";
import { encodeState, decodeState } from "../services/tools/auth/microsoftAuth";
import { encryptSecret, decryptSecret } from "../utils/encryption";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) { failures++; if (detail !== undefined) console.log("      ", JSON.stringify(detail)); }
}

async function main() {
  // ── 1. Real MCP handshake over the in-memory transport ────────────────────
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createKnowledgeBaseServer();
  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  check("MCP handshake completes over in-memory transport", true);

  // ── 2. tools/list ─────────────────────────────────────────────────────────
  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  check("tools/list returns both KB tools", JSON.stringify(names) === '["list_documents","search_documents"]', names);
  check("both tools declare readOnlyHint", listed.tools.every((t) => t.annotations?.readOnlyHint === true));

  // ── 3. A call with no caller identity must be refused ─────────────────────
  let refused = false;
  try {
    await client.callTool({ name: "search_documents", arguments: { query: "leave policy" } });
  } catch (err) {
    refused = String(err).includes("caller identity");
  }
  check("call without _meta caller identity is refused", refused);

  // ── 4. A call WITH caller identity reaches the handler ────────────────────
  const ctx: ToolContext = {
    userId: "507f1f77bcf86cd799439011",
    businessUnit: "UAC Foods",
    department: "HR",
    isAdmin: false,
    provider: "claude"
  };
  const called = await client.callTool({
    name: "search_documents",
    arguments: { query: "leave policy" },
    _meta: callerMeta(ctx)
  });
  const text = (called.content as any[])?.[0]?.text ?? "";
  // Mongo is not connected here, so the handler's own failure path is what we
  // expect — the point is that it got past identity enforcement and into the tool.
  check("call with _meta reaches the tool handler", typeof text === "string" && text.length > 0, text.slice(0, 120));
  check("a failed tool returns isError, not a thrown transport error", called.isError === true);

  // ── 5. Name qualification ─────────────────────────────────────────────────
  const q = qualifyToolName("knowledge_base", "search_documents");
  check("qualified name is provider-safe", /^[a-zA-Z0-9_-]{1,64}$/.test(q) && q === "knowledge_base__search_documents", q);
  const long = qualifyToolName("a".repeat(80), "search_documents");
  check("over-long names are truncated to 64 chars", long.length <= 64, long);

  // ── 6. The four provider dialects ─────────────────────────────────────────
  const catalog: CanonicalTool[] = listed.tools.map((t) => ({
    name: qualifyToolName("knowledge_base", t.name),
    description: t.description ?? "",
    parameters: t.inputSchema as any,
    label: "Searching the knowledge base",
    remoteName: t.name,
    connectorId: "knowledge_base",
    connectorLabel: "Knowledge Base",
    access: "read"
  }));

  const responses = toResponsesTools(catalog);
  check("Responses API: flattened function tool",
    responses[0].type === "function" && typeof responses[0].name === "string" && !("function" in responses[0]),
    responses[0]);

  const chat = toChatCompletionsTools(catalog);
  check("Chat Completions: nested under `function` (DeepSeek + Kimi)",
    chat[0].type === "function" && typeof (chat[0] as any).function?.name === "string",
    chat[0]);

  const anthropic = toAnthropicTools(catalog);
  check("Anthropic: schema under `input_schema`",
    typeof anthropic[0].name === "string" && "input_schema" in anthropic[0] && !("parameters" in anthropic[0]),
    anthropic[0]);

  check("all three dialects agree on the tool name",
    responses[0].name === (chat[0] as any).function.name &&
    responses[0].name === anthropic[0].name);

  await client.close();

  // ── 7. Microsoft OAuth state must be authenticated ────────────────────────
  // The consent callback is an unauthenticated browser redirect, so `state` is the
  // only thing carrying the user's identity. If it were forgeable, an attacker could
  // bind their own Microsoft account to someone else's Nexa user.
  const goodState = encodeState("user-abc");
  check("signed state round-trips to the same user", decodeState(goodState)?.userId === "user-abc");

  const tamperedUser = Buffer.from(
    Buffer.from(goodState, "base64url").toString("utf8").replace("user-abc", "user-xyz")
  ).toString("base64url");
  check("state with a swapped userId is rejected", decodeState(tamperedUser) === null);

  check("garbage state is rejected", decodeState("not-a-real-state") === null);

  const staleRaw = Buffer.from(goodState, "base64url").toString("utf8").split(".");
  staleRaw[1] = String(Date.now() - 60 * 60 * 1000); // an hour old
  check("expired state is rejected",
    decodeState(Buffer.from(staleRaw.join(".")).toString("base64url")) === null);

  // ── 8. Connector credentials use their own key ────────────────────────────
  process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  const sealed = encryptSecret("refresh-token-value");
  check("refresh token round-trips through its own key", decryptSecret(sealed) === "refresh-token-value");
  check("ciphertext does not contain the plaintext", !sealed.includes("refresh-token-value"));

  process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY = "b".repeat(64);
  let wrongKeyRejected = false;
  try { decryptSecret(sealed); } catch { wrongKeyRejected = true; }
  check("a credential sealed with another key will not decrypt", wrongKeyRejected);

  // ── 9. The Graph server ───────────────────────────────────────────────────
  const [gClient, gServer] = InMemoryTransport.createLinkedPair();
  const graph = createMicrosoftGraphServer();
  const graphClient = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await graph.connect(gServer);
  await graphClient.connect(gClient);

  const graphTools = await graphClient.listTools();
  const graphNames = graphTools.tools.map((t) => t.name).sort();
  check("Graph server exposes the three read tools",
    JSON.stringify(graphNames) === '["list_recent_files","read_file","search_files"]', graphNames);
  check("every Graph tool is read-only",
    graphTools.tools.every((t) => t.annotations?.readOnlyHint === true));

  // Graph is only ever called with a delegated user token, so a call with no user
  // behind it must be refused rather than falling back to anything broader.
  const noUser = await graphClient.callTool({
    name: "search_files",
    arguments: { query: "budget" },
    _meta: callerMeta({ businessUnit: "UAC Foods", isAdmin: true, provider: "gpt" } as ToolContext)
  });
  check("Graph call with no user identity is refused", noUser.isError === true,
    (noUser.content as any[])?.[0]?.text?.slice(0, 90));

  await graphClient.close();

  console.log(failures === 0 ? "\nAll spine checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error("harness error:", err); process.exit(1); });
