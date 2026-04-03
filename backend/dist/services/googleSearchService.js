"use strict";
/**
 * Google Search Service - Hybrid approach for enriched information
 * Uses SerpAPI to search Google and combine with company policies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchGoogle = searchGoogle;
exports.formatSearchResultsForChat = formatSearchResultsForChat;
exports.buildHybridContext = buildHybridContext;
exports.enhanceResponseWithSearch = enhanceResponseWithSearch;
/**
 * Search for information from Google using SerpAPI
 * Complements company policies with external information
 *
 * Requires:
 * - SEARCH_API_PROVIDER=serpapi
 * - SEARCH_API_KEY=your_serpapi_key (from https://serpapi.com)
 */
async function searchGoogle(query, limit = 3) {
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
    }
    catch (error) {
        return {
            success: false,
            error: "Failed to perform search"
        };
    }
}
/**
 * Search using SerpAPI (https://serpapi.com)
 */
async function searchWithSerpAPI(query, apiKey, limit) {
    try {
        const url = new URL("https://serpapi.com/search");
        url.searchParams.append("q", query);
        url.searchParams.append("api_key", apiKey);
        url.searchParams.append("num", limit.toString());
        const response = await fetch(url.toString());
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
        const results = [];
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
    }
    catch (error) {
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
 * Format search results for display in chat response
 * Clearly labels results as external sources
 */
function formatSearchResultsForChat(results) {
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
function buildHybridContext(policies, externalResults) {
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
async function enhanceResponseWithSearch(userQuery, policyResults, useExternalSearch = false) {
    let response = policyResults || "";
    if (useExternalSearch && process.env.SEARCH_API_PROVIDER) {
        try {
            const searchResults = await searchGoogle(userQuery);
            if (searchResults.success && searchResults.results) {
                const formattedResults = formatSearchResultsForChat(searchResults.results);
                response += formattedResults;
                response += "\n\n*External search results provided for reference.*";
            }
        }
        catch (error) {
            console.warn("Failed to enhance response with search:", error);
            // Continue without search results
        }
    }
    return response;
}
