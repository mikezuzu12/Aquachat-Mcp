// Tavily REST API client (no npm package needed - just using fetch)
// This REPLACES lib/webSearchDuckDuckGo.ts. Delete that file after adding this one,
// and update any other imports of `searchWebWithContextDuckDuckGo` to point here.

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export async function searchWeb(
  query: string,
  options?: {
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
    includeAnswer?: boolean;
  }
): Promise<{
  answer?: string;
  results: SearchResult[];
  query: string;
}> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.warn("⚠️ TAVILY_API_KEY not found - web search will be disabled");
    return { results: [], query };
  }

  try {
    console.log(`🔍 Searching web for: "${query}"`);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: options?.searchDepth || "basic",
        max_results: options?.maxResults || 5,
        include_answer: options?.includeAnswer ?? true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Tavily API error:", response.status, errorText);
      return { results: [], query };
    }

    const data = await response.json();
    console.log(`✅ Found ${data.results?.length || 0} results`);

    return {
      answer: data.answer || undefined,
      results:
        data.results?.map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          content: r.content || "",
          score: r.score,
        })) || [],
      query,
    };
  } catch (error) {
    console.error("❌ Web search error:", error);
    return { results: [], query };
  }
}

// Used by the bot's `search_web` tool. Returns a short plain-text summary
// (not a big source dump) since it gets fed straight into the model's context.
export async function searchWebWithContext(
  query: string,
  context: string
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return "Web search is not available right now (missing API key).";
  }

  try {
    const result = await searchWeb(query, {
      searchDepth: "advanced",
      maxResults: 5,
      includeAnswer: true,
    });

    if (!result.answer && result.results.length === 0) {
      return "No results found for that query.";
    }

    let response = "";
    if (result.answer) {
      response += `${result.answer}\n\n`;
    }
    if (result.results.length > 0) {
      response += "Sources:\n";
      result.results.slice(0, 3).forEach((r, i) => {
        response += `${i + 1}. ${r.title} — ${r.url}\n`;
      });
    }
    return response.trim();
  } catch (error) {
    console.error("Web search with context error:", error);
    return "I encountered an error while searching. Please try again.";
  }
}