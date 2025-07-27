// src/lib/voice-assistant/mcp-client.ts

import { MCPSearchResult, MCP_ENDPOINT } from "./types";

export class MCPClient {
  private static readonly TIMEOUT_MS = 10000;
  private static readonly MAX_LIBRARIES = 2;
  private static readonly MAX_TOKENS = 4000;

  static async search(query: string): Promise<MCPSearchResult> {
    try {
      console.log(`🔍 MCP search for: "${query}"`);

      // Step 1: Find libraries
      const libraryIds = await this.findLibraries(query);
      if (libraryIds.length === 0) {
        console.log("📚 No libraries found");
        return { documentation: "", libraries: [] };
      }

      // Step 2: Get docs from top libraries
      const topLibraries = this.selectTopLibraries(libraryIds, query);
      const documentation = await this.getDocumentation(topLibraries);

      console.log(
        `📚 Retrieved ${documentation.length} chars from ${topLibraries.length} libraries`
      );

      return { documentation, libraries: topLibraries };
    } catch (error) {
      console.error("MCP search error:", error);
      return { documentation: "", libraries: [] };
    }
  }

  private static async findLibraries(query: string): Promise<string[]> {
    try {
      const response = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: "resolve-library-id",
            arguments: { libraryName: query },
          },
        }),
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (!response.ok) {
        console.warn(`MCP response not OK: ${response.status}`);
        return [];
      }

      const text = await response.text();
      const dataLines = text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.substring(6).trim())
        .filter((line) => line && line !== "[DONE]");

      if (dataLines.length > 0) {
        const data = JSON.parse(dataLines[dataLines.length - 1]);
        const content = data?.result?.content?.[0]?.text || "";

        const matches =
          content.match(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/g) || [];
        // FIX: Add explicit type annotation for the filter parameter
        return matches.filter(
          (m: string) => !m.match(/\.(js|ts|json|md)$/) && m !== "/org/project"
        );
      }

      return [];
    } catch (error) {
      console.error("Library search error:", error);
      return [];
    }
  }

  private static selectTopLibraries(
    libraryIds: string[],
    query: string
  ): string[] {
    const queryLower = query.toLowerCase();

    const scored = libraryIds.map((id) => {
      let score = 0;
      const [, org, repo] = id.split("/");
      const idLower = id.toLowerCase();

      // PRIORITY: Exact library name matches
      if (
        queryLower.includes("better auth") ||
        queryLower.includes("betterauth")
      ) {
        if (idLower.includes("better-auth") || org === "better-auth")
          score += 100;
      }

      if (queryLower.includes("nextjs") || queryLower.includes("next.js")) {
        if (org === "vercel" || org === "nextjs" || repo.includes("nextjs"))
          score += 80;
      }

      if (queryLower.includes("drizzle")) {
        if (org === "drizzle-team" || repo.includes("drizzle")) score += 100;
      }

      // Official organizations
      const officialOrgs = [
        "better-auth",
        "vercel",
        "nextjs",
        "facebook",
        "vuejs",
        "drizzle-team",
      ];
      if (officialOrgs.includes(org)) score += 50;

      // Documentation repos
      if (repo === "docs" || repo.includes("documentation")) score += 30;

      // Penalize wrong libraries heavily
      if (queryLower.includes("better auth") && idLower.includes("auth0"))
        score -= 50;
      if (queryLower.includes("better auth") && idLower.includes("nextauth"))
        score -= 50;

      // Avoid examples/demos
      if (
        repo.includes("example") ||
        repo.includes("demo") ||
        repo.includes("starter")
      )
        score -= 40;

      // General keyword matching
      const keywords = queryLower.split(/\s+/);
      for (const keyword of keywords) {
        if (keyword.length > 2 && idLower.includes(keyword)) score += 10;
      }

      return { id, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    console.log(
      "🎯 Top library scores:",
      sorted.slice(0, 5).map((s) => `${s.id}: ${s.score}`)
    );

    return sorted.slice(0, this.MAX_LIBRARIES).map((item) => item.id);
  }

  private static async getDocumentation(libraryIds: string[]): Promise<string> {
    const docs: string[] = [];

    // Process libraries in parallel for speed
    const docPromises = libraryIds.map(async (libraryId) => {
      try {
        const response = await fetch(MCP_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
              name: "get-library-docs",
              arguments: {
                context7CompatibleLibraryID: libraryId,
                tokens: this.MAX_TOKENS,
              },
            },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const text = await response.text();
          const dataLines = text
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.substring(6).trim())
            .filter((line) => line && line !== "[DONE]");

          if (dataLines.length > 0) {
            const data = JSON.parse(dataLines[dataLines.length - 1]);
            const content = data?.result?.content?.[0]?.text;

            if (content) {
              return `\n=== Documentation from ${libraryId} ===\n${content}`;
            }
          }
        }
      } catch (error) {
        console.error(`Error getting docs for ${libraryId}:`, error);
      }
      return null;
    });

    const results = await Promise.allSettled(docPromises);

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        docs.push(result.value);
      }
    });

    return docs.join("\n");
  }
}
