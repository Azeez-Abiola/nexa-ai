/**
 * Google Search Service - Hybrid approach for enriched information
 * Uses SerpAPI to search Google and combine with company policies
 */

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  error?: string;
}

/**
 * Search for information from Google using SerpAPI
 * Complements company policies with external information
 * 
 * Requires:
 * - SEARCH_API_PROVIDER=serpapi
 * - SEARCH_API_KEY=your_serpapi_key (from https://serpapi.com)
 */
export async function searchGoogle(
  query: string,
  limit: number = 3
): Promise<SearchResponse> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: "Search query cannot be empty"
      };
    }

    // Check if SerpAPI is configured
    const provider = process.env.SEARCH_API_PROVIDER;
    const apiKey = process.env.SEARCH_API_KEY;

    if (!provider || !apiKey) {
      return {
        success: false,
        error: "External search service not configured"
      };
    }

    // Handle SerpAPI integration
    if (provider.toLowerCase() === "serpapi") {
      return await searchWithSerpAPI(query, apiKey, limit);
    }

    return {
      success: false,
      error: `Unsupported search provider: ${provider}`
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to perform search"
    };
  }
}

/**
 * Search using SerpAPI (https://serpapi.com)
 */
async function searchWithSerpAPI(
  query: string,
  apiKey: string,
  limit: number
): Promise<SearchResponse> {
  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.append("q", query);
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("num", limit.toString());

    const serpController = new AbortController();
    const serpTimeout = setTimeout(() => serpController.abort(), 5_000);
    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: serpController.signal });
    } finally {
      clearTimeout(serpTimeout);
    }

    if (!response.ok) {
      return {
        success: false,
        error: `SerpAPI request failed: ${response.statusText}`
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error
      };
    }

    // Extract organic results from SerpAPI response
    const results: SearchResult[] = [];
    
    if (data.organic_results && Array.isArray(data.organic_results)) {
      for (const result of data.organic_results.slice(0, limit)) {
        results.push({
          title: result.title || "No title",
          link: result.link || "#",
          snippet: result.snippet || result.display_link || "No description available"
        });
      }
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error("[SerpAPI] Error message:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("[SerpAPI] Stack:", error.stack);
    }
    return {
      success: false,
      error: `SerpAPI request failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Fetch the actual text content from a URL. Strips HTML tags and trims to maxChars.
 * Times out after 4s so one slow page doesn't block the whole response.
 */
async function fetchPageText(url: string, maxChars = 3000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NexaAI/1.0)" }
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();
    // Strip scripts, styles, HTML tags, then collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

/**
 * Enrich search results by fetching the actual page content behind each URL.
 * Runs fetches in parallel with individual 4s timeouts. Results that fail or return
 * empty are left with their original snippet — the model still gets something.
 */
export async function enrichResultsWithPageContent(results: SearchResult[]): Promise<SearchResult[]> {
  const enriched = await Promise.all(
    results.map(async (r) => {
      const pageText = await fetchPageText(r.link, 3000);
      if (pageText && pageText.length > r.snippet.length * 2) {
        return { ...r, snippet: pageText };
      }
      return r;
    })
  );
  return enriched;
}

/**
 * Format search results for display in chat response
 * Clearly labels results as external sources
 */
export function formatSearchResultsForChat(results: SearchResult[]): string {
  if (results.length === 0) {
    return "";
  }

  let formatted = "\n\n🌐 **External Sources (Google Search):**\n";
  results.forEach((result, idx) => {
    formatted += `\n${idx + 1}. [${result.title}](${result.link})\n`;
    formatted += `   > ${result.snippet}\n`;
  });
  formatted += "\n---";

  return formatted;
}

/**
 * Prepare hybrid context for OpenAI combining policies and external search
 * Both sources are clearly labeled for the AI to distinguish them
 */
export function buildHybridContext(
  policies: any[],
  externalResults: SearchResult[]
): string {
  let context = "";

  // Company policies section
  if (policies && policies.length > 0) {
    context += "📋 **COMPANY POLICIES & INTERNAL DOCUMENTS:**\n";
    context += "=" + "=".repeat(40) + "\n";
    policies.forEach((policy, idx) => {
      context += `\n[POLICY ${idx + 1}] ${policy.title}\n`;
      context += `Category: ${policy.category}\n`;
      context += `Content:\n${policy.content}\n`;
      context += "-" + "-".repeat(40) + "\n";
    });
  }

  // External search results section
  if (externalResults && externalResults.length > 0) {
    context += "\n🌐 **EXTERNAL SOURCES (Google Search):**\n";
    context += "=" + "=".repeat(40) + "\n";
    externalResults.forEach((result, idx) => {
      context += `\n[SOURCE ${idx + 1}] ${result.title}\n`;
      context += `URL: ${result.link}\n`;
      context += `Info: ${result.snippet}\n`;
      context += "-" + "-".repeat(40) + "\n";
    });
  }

  return context;
}

/**
 * Get search-enhanced response with both policies and Google results
 */
export async function enhanceResponseWithSearch(
  userQuery: string,
  policyResults: string | null,
  useExternalSearch: boolean = false
): Promise<string> {
  let response = policyResults || "";

  if (useExternalSearch && process.env.SEARCH_API_PROVIDER) {
    try {
      const searchResults = await searchGoogle(userQuery);
      
      if (searchResults.success && searchResults.results) {
        const formattedResults = formatSearchResultsForChat(
          searchResults.results
        );
        response += formattedResults;
        response += "\n\n*External search results provided for reference.*";
      }
    } catch (error) {
      console.warn("Failed to enhance response with search:", error);
      // Continue without search results
    }
  }

  return response;
}
