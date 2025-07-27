import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiRequest {
  query: string;
  context?: string;
  libraries?: string[];
  timestamp: number;
}

// interface GeminiResponse {
//   response: string;
//   reasoning?: string;
// }

export async function POST(request: NextRequest) {
  try {
    const { query, context, libraries, timestamp }: GeminiRequest = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log(`Processing with Gemini 2.0 Flash: "${query}"`);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build the prompt with context
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, context, libraries);

    console.log('Sending request to Gemini...');
    
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    console.log('Gemini response received successfully');

    return NextResponse.json({
      success: true,
      response: text,
      reasoning: `Processed using Gemini 2.0 Flash with ${context ? 'MCP context' : 'general knowledge'}`,
      processingTime: Date.now() - timestamp,
      libraries: libraries || [],
      model: 'gemini-2.0-flash'
    });

  } catch (error) {
    console.error('Gemini analysis error:', error);
    
    // Provide a helpful fallback response
    const fallbackResponse = generateFallbackResponse((await request.json()).query);
    
    return NextResponse.json({
      success: false,
      response: fallbackResponse,
      reasoning: 'Fallback response due to Gemini API error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function buildSystemPrompt(): string {
  return `You are TechMentor Voice, an expert AI programming assistant specializing in real-time technical documentation and code guidance. You help developers by providing accurate, up-to-date information about programming languages, frameworks, and tools.

CORE CAPABILITIES:
- Provide accurate code examples and explanations
- Answer questions about popular frameworks (Next.js, React, Python, etc.)
- Explain best practices and modern development patterns
- Help with debugging and troubleshooting
- Suggest optimal solutions for technical challenges

RESPONSE GUIDELINES:
1. **Be Conversational**: Since this is a voice interface, speak naturally as if talking to a colleague
2. **Be Concise but Complete**: Provide thorough answers without being overly verbose
3. **Use Examples**: Include practical code examples when relevant
4. **Stay Current**: Focus on modern, up-to-date practices and syntax
5. **Be Practical**: Prioritize actionable advice over theoretical explanations

VOICE-OPTIMIZED FORMATTING:
- Speak in a friendly, professional tone
- Use clear transitions between concepts
- When mentioning code, briefly describe what you're showing
- Avoid excessive technical jargon unless necessary

Remember: The user is speaking to you and will hear your response, so make it conversational and easy to follow when spoken aloud.`;
}

function buildUserPrompt(query: string, context?: string, libraries?: string[]): string {
  let prompt = `User Question: "${query}"\n\n`;

  if (context) {
    prompt += `RELEVANT DOCUMENTATION CONTEXT:\n${context}\n\n`;
  }

  if (libraries && libraries.length > 0) {
    prompt += `DETECTED LIBRARIES/FRAMEWORKS: ${libraries.join(', ')}\n\n`;
  }

  prompt += `Please provide a comprehensive, voice-friendly response that:
1. Directly answers the user's question
2. Uses the provided documentation context when relevant
3. Includes practical code examples if applicable
4. Explains the reasoning behind your recommendations
5. Suggests next steps or related concepts if helpful

Keep the response conversational and suitable for voice delivery while being technically accurate and helpful.`;

  return prompt;
}

function generateFallbackResponse(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Provide basic responses for common query types
  if (lowerQuery.includes('next.js') || lowerQuery.includes('nextjs')) {
    return `I'd be happy to help with Next.js! However, I'm currently unable to access the latest documentation. For Next.js questions, I recommend checking the official Next.js documentation at nextjs.org, or try asking your question again in a moment.`;
  }
  
  if (lowerQuery.includes('react')) {
    return `For React questions, I recommend checking the official React documentation at react.dev. The documentation there has the most up-to-date information about React hooks, components, and best practices.`;
  }
  
  if (lowerQuery.includes('typescript')) {
    return `TypeScript questions are best answered by checking the official TypeScript handbook at typescriptlang.org. They have comprehensive guides on types, interfaces, and advanced TypeScript patterns.`;
  }
  
  if (lowerQuery.includes('python')) {
    return `For Python questions, the official Python documentation at python.org is your best resource. They have detailed guides on syntax, libraries, and best practices.`;
  }
  
  if (lowerQuery.includes('cloudflare')) {
    return `Cloudflare documentation can be found at developers.cloudflare.com. They have comprehensive guides for Workers, Pages, and other Cloudflare services.`;
  }

  // Generic fallback
  return `I apologize, but I'm currently unable to process your request fully due to a temporary service issue. For immediate help, I recommend checking the official documentation for the technology you're asking about, or try asking your question again in a moment.`;
}

export async function GET() {
  return NextResponse.json({
    service: 'Gemini 2.0 Flash Analysis',
    status: 'running',
    model: 'gemini-2.0-flash',
    capabilities: [
      'Code explanation and generation',
      'Technical documentation assistance',
      'Best practices recommendations',
      'Debugging and troubleshooting',
      'Framework-specific guidance'
    ],
    timestamp: new Date().toISOString()
  });
}