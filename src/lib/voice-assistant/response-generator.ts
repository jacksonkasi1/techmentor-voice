import { geminiMain } from "@/lib/gemini-client";
import { ProcessingContext } from "./types";

export class ResponseGenerator {
  private static readonly MAX_CONTEXT_CHARS = 8000;

  static async generate(context: ProcessingContext): Promise<string> {
    const { query, documentation, libraries, isConversational } = context;

    try {
      if (isConversational) {
        return this.generateConversationalResponse(query);
      }

      return await this.generateTechnicalResponse(
        query,
        documentation,
        libraries
      );
    } catch (error) {
      console.error("Response generation error:", error);
      return this.generateFallbackResponse(query);
    }
  }

  private static generateConversationalResponse(query: string): string {
    const lowerQuery = query.toLowerCase();

    const responses: Record<string, string> = {
      hello:
        "Hello! I'm your TechMentor voice assistant, ready to help with any programming questions!",
      hi: "Hi there! I'm here to help with technical questions about frameworks, programming languages, and more!",
      hey: "Hey! Ready to assist with any technology questions you have!",
      "can you hear me":
        "Yes, I can hear you perfectly! I'm ready to help with technical questions.",
      "am i audible":
        "Yes, you're coming through crystal clear! What technology would you like to learn about?",
      test: "Test successful! I'm working great and ready for your technical questions.",
      testing:
        "Testing confirmed - everything is working perfectly! What can I help you with?",
      "how are you":
        "I'm functioning perfectly and ready to help with your programming questions!",
      "are you there":
        "I'm here and ready to help! Ask me about any technology or programming topic.",
      "are you working":
        "Yes, I'm working perfectly! What technology topic interests you today?",
    };

    // Find matching response
    for (const [key, response] of Object.entries(responses)) {
      if (lowerQuery.includes(key)) {
        return response;
      }
    }

    // Default conversational response
    const defaultResponses = [
      "Hello! I'm your TechMentor voice assistant. I'm here and ready to help you with any programming or technology questions. What would you like to learn about?",
      "Hi there! I can help you with technical questions about frameworks, programming languages, tools, and more. What can I explain for you?",
      "Hey! I'm working great and ready to assist. Ask me about any technology - React, Next.js, Python, databases, deployment, or anything else you're curious about!",
    ];

    return defaultResponses[
      Math.floor(Math.random() * defaultResponses.length)
    ];
  }

  private static async generateTechnicalResponse(
    query: string,
    documentation: string,
    libraries: string[]
  ): Promise<string> {
    console.log(`🤖 Generating response for: "${query}"`);
    console.log(
      `📚 Context: ${documentation?.length || 0} chars, Libraries: ${
        libraries.join(", ") || "none"
      }`
    );

    const prompt = `You are a technical expert. The user asked: "${query}"

${
  documentation
    ? `
IMPORTANT: You have access to SPECIFIC DOCUMENTATION below. You MUST use this documentation to answer the question. Do NOT give generic advice.

DOCUMENTATION:
=====================================
${documentation.slice(0, 12000)}
=====================================

INSTRUCTIONS:
1. Use the EXACT code examples and information from the documentation above
2. If the documentation shows Better Auth examples, use those (not NextAuth.js)
3. Include actual code snippets from the documentation
4. Be specific about the library versions and setup steps shown in the docs
5. Reference the specific libraries: ${libraries.join(", ")}
6. If the documentation covers the user's question, provide a complete answer with code examples
`
    : "No specific documentation found."
}

Provide a detailed, technical response using the documentation above:`;

    const result = await geminiMain.generateContent(prompt);
    const response = result.response.text().trim();

    console.log(`✅ Generated response: ${response.substring(0, 100)}...`);
    return response;
  }

  private static generateFallbackResponse(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("hello") ||
      lowerQuery.includes("hi") ||
      lowerQuery.includes("hear me")
    ) {
      return "Hello! I'm your TechMentor assistant and I'm working perfectly. What technology topic would you like to explore today?";
    }

    return `I understand you're asking about "${query}". I'm having a small technical hiccup, but I'm still here to help! Could you try rephrasing your question, or ask about a specific technology like React, Next.js, or Python?`;
  }
}
