import { geminiLite } from '@/lib/gemini-client';
import { CONVERSATIONAL_PHRASES } from './types';

export class QueryCorrector {
  static async correct(query: string): Promise<string> {
    try {
      const prompt = `You are a voice query preprocessor for a technical assistant. Convert voice input to clean search terms.

User said: "${query}"

Rules:
1. If it's a general conversation ("hello", "can you hear me", "test"), return it as-is
2. If it mentions technology, extract the tech term only
3. Fix speech errors: "better also" → "better auth", "drizzle worm" → "drizzle orm"
4. Remove filler words: "um", "uh", "like", "you know"
5. Keep it simple - return 1-3 words maximum
6. NO explanations, NO parentheses, NO "unsure" - just the corrected term

Examples:
"can you hear me" → "can you hear me"
"hello there" → "hello"  
"tell me about better also" → "better auth"
"explain drizzle worm" → "drizzle orm"
"what is next to yes" → "nextjs"
"um how about react" → "react"

Return only the corrected term:`;

      const result = await geminiLite.generateContent(prompt);
      const correctedQuery = result.response.text().trim().replace(/['"]/g, '');

      console.log(`🔧 LLM correction: "${query}" → "${correctedQuery}"`);
      return correctedQuery || query;
    } catch (error) {
      console.error('Query correction error:', error);
      return query; // Fallback to original
    }
  }

  static isConversational(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    return CONVERSATIONAL_PHRASES.some(phrase => lowerQuery.includes(phrase));
  }
}