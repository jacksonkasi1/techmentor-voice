import { geminiLite } from '@/lib/gemini-client';
import { CONVERSATIONAL_PHRASES } from './types';

export class QueryCorrector {
  static isConversational(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    return CONVERSATIONAL_PHRASES.some(phrase => lowerQuery.includes(phrase));
  }

  static async correct(query: string): Promise<string> {
    try {
      const prompt = `Extract the main technology/library name from this voice query for documentation search.

User said: "${query}"

Rules:
1. Keep specific library names intact: "better auth" should stay "better auth"
2. Fix speech errors: "better also" → "better auth", "drizzle worm" → "drizzle orm"  
3. For integration questions, keep both technologies: "better auth next js" → "better auth nextjs"
4. Remove filler words but keep technical terms
5. Return 1-4 words maximum

Examples:
"explain better auth next js github integration" → "better auth nextjs"
"tell me about better also" → "better auth"
"how to use drizzle worm with next" → "drizzle orm nextjs"
"react hooks tutorial" → "react hooks"

Corrected search term:`;

      const result = await geminiLite.generateContent(prompt);
      const correctedQuery = result.response.text().trim().replace(/['"]/g, '');

      console.log(`🔧 LLM correction: "${query}" → "${correctedQuery}"`);
      return correctedQuery || query;
    } catch (error) {
      console.error('Query correction error:', error);
      return query;
    }
  }
}