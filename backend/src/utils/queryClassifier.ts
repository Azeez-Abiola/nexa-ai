/**
 * Lightweight classifier for trivial / conversational queries.
 *
 * Queries that match are pure greetings or acknowledgements — they carry no
 * knowledge-seeking intent and need neither RAG retrieval nor a large system
 * prompt. Both the route handler (RAG bypass) and the OpenAI service (light
 * prompt) import from here so the classification logic is defined exactly once.
 */

const TRIVIAL_QUERY_MAX_LEN = 60;

const TRIVIAL_RE =
  /^(?:hi+|hello+|hey+|howdy|hiya|yo+|sup|greetings|good\s+(?:morning|afternoon|evening|day)|how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up|wassup|thanks?\s*(?:you|a\s+lot|so\s+much)?|ok(?:ay)?|sure|great|got\s+it|nice|cool|sounds\s+good|no\s+worries|np|lol|haha|bye+|goodbye|see\s+you|cheers|perfect|alright|welcome|ty|thx|noted|understood|makes?\s+sense)[!?.,:]*$/i;

/**
 * Returns true when the query is a short greeting or conversational filler
 * that requires no knowledge retrieval and only a brief response.
 */
export function isSimpleQuery(query: string): boolean {
  const q = query.trim();
  return q.length > 0 && q.length <= TRIVIAL_QUERY_MAX_LEN && TRIVIAL_RE.test(q);
}
