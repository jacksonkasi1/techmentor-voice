import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiRequest {
  query: string;
  context?: string;
  libraries?: string[];
  timestamp: number;
}

interface GeminiResponse {
  response: string;
  reasoning?: string;
}

export async function POST(request: NextRequest) {
  console.log('🧠 Gemini Analyze API called');
  
  try {
    const { query, context, libraries, timestamp }: GeminiRequest = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Query is required' 
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ Gemini API key not configured');
      return NextResponse.json({
        success: false,
        error: 'Gemini API key not configured',
        response: generateKeyMissingFallback(query)
      });
    }

    console.log(`🤖 Processing with Gemini 2.0 Flash: "${query}"`);
    console.log(`📚 Context length: ${context?.length || 0} chars`);
    console.log(`🏷️ Libraries: ${libraries?.join(', ') || 'none'}`);

    // Initialize Gemini with error handling
    let genAI;
    let model;
    
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    } catch (initError) {
      console.error('❌ Failed to initialize Gemini:', initError);
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize Gemini',
        response: generateInitializationFallback(query)
      });
    }

    // Build the prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, context, libraries);

    console.log('📤 Sending request to Gemini...');
    
    try {
      // Add timeout wrapper for Gemini request
      const geminiPromise = model.generateContent([
        { text: systemPrompt },
        { text: userPrompt }
      ]);

      // Race against timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini request timeout')), 10000);
      });

      const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        console.warn('⚠️ Empty response from Gemini');
        return NextResponse.json({
          success: false,
          error: 'Empty response from Gemini',
          response: generateEmptyResponseFallback(query)
        });
      }

      console.log('✅ Gemini response received successfully');
      console.log(`📝 Response length: ${text.length} characters`);

      return NextResponse.json({
        success: true,
        response: text,
        reasoning: `Processed using Gemini 2.0 Flash with ${context ? 'MCP context' : 'general knowledge'}`,
        processingTime: Date.now() - timestamp,
        libraries: libraries || [],
        model: 'gemini-2.0-flash-exp'
      });

    } catch (geminiError: any) {
      console.error('❌ Gemini request failed:', geminiError);
      
      // Handle specific Gemini errors
      let fallbackResponse = '';
      let errorType = 'unknown';
      
      if (geminiError.message?.includes('timeout')) {
        errorType = 'timeout';
        fallbackResponse = generateTimeoutFallback(query);
      } else if (geminiError.message?.includes('quota') || geminiError.message?.includes('limit')) {
        errorType = 'quota';
        fallbackResponse = generateQuotaFallback(query);
      } else if (geminiError.message?.includes('safety') || geminiError.message?.includes('blocked')) {
        errorType = 'safety';
        fallbackResponse = generateSafetyFallback(query);
      } else {
        fallbackResponse = generateGenericFallback(query);
      }
      
      return NextResponse.json({
        success: false,
        error: `Gemini error: ${errorType}`,
        response: fallbackResponse,
        errorDetails: geminiError.message
      });
    }

  } catch (error: any) {
    console.error('💥 Gemini analysis error:', error);
    
    // Always provide a helpful fallback response
    const query = (await request.json().catch(() => ({ query: 'unknown' }))).query;
    
    return NextResponse.json({
      success: false,
      response: generateGenericFallback(query),
      reasoning: 'Fallback response due to API error',
      error: error?.message || 'Unknown error'
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
2. **Be Concise but Complete**: Provide thorough answers without being overly verbose (aim for 100-200 words)
3. **Use Examples**: Include practical code examples when relevant, but keep them short
4. **Stay Current**: Focus on modern, up-to-date practices and syntax
5. **Be Practical**: Prioritize actionable advice over theoretical explanations

VOICE-OPTIMIZED FORMATTING:
- Speak in a friendly, professional tone
- Use clear transitions between concepts
- When mentioning code, briefly describe what you're showing
- Avoid excessive technical jargon unless necessary
- Keep responses focused and structured

Remember: The user is speaking to you and will hear your response, so make it conversational and easy to follow when spoken aloud. Aim for responses that are helpful but not overwhelming.`;
}

function buildUserPrompt(query: string, context?: string, libraries?: string[]): string {
  let prompt = `User Question: "${query}"\n\n`;

  if (context && context.trim().length > 0) {
    // Limit context length to prevent token overflow
    const maxContextLength = 2000;
    const truncatedContext = context.length > maxContextLength 
      ? context.substring(0, maxContextLength) + '...(truncated)'
      : context;
    prompt += `RELEVANT DOCUMENTATION CONTEXT:\n${truncatedContext}\n\n`;
  }

  if (libraries && libraries.length > 0) {
    prompt += `DETECTED LIBRARIES/FRAMEWORKS: ${libraries.join(', ')}\n\n`;
  }

  prompt += `Please provide a comprehensive, voice-friendly response that:
1. Directly answers the user's question
2. Uses the provided documentation context when relevant
3. Includes a brief, practical code example if applicable (keep it short!)
4. Explains the reasoning behind your recommendations
5. Suggests next steps or related concepts if helpful

Keep the response conversational and suitable for voice delivery while being technically accurate and helpful. Aim for 100-200 words maximum.`;

  return prompt;
}

// Fallback response generators
function generateKeyMissingFallback(query: string): string {
  return `I understand you're asking about "${query}". However, I need a Gemini API key to provide detailed responses. For immediate help, I recommend checking the official documentation for the technology you're asking about. You can also try searching for "${query}" on Stack Overflow or the relevant project's GitHub repository.`;
}

function generateInitializationFallback(query: string): string {
  return `I'm having trouble initializing my knowledge system right now. For your question about "${query}", I recommend checking the official documentation or community resources. If this is about web development, MDN Web Docs, the Next.js docs, or React documentation are excellent starting points.`;
}

function generateEmptyResponseFallback(query: string): string {
  return `I received your question about "${query}" but got an empty response from my knowledge system. Could you try rephrasing your question or being more specific? For example, instead of asking generally about a topic, try asking about a specific implementation or use case.`;
}

function generateTimeoutFallback(query: string): string {
  return `I'm taking longer than usual to process your question about "${query}". This might be due to high demand. For immediate help, try breaking down your question into smaller parts, or check the official documentation for the technology you're asking about.`;
}

function generateQuotaFallback(query: string): string {
  return `I've reached my processing limit for now regarding "${query}". For immediate assistance, I recommend checking the official documentation or community forums for the technology you're interested in. Stack Overflow and GitHub discussions are also great resources.`;
}

function generateSafetyFallback(query: string): string {
  return `I want to help with your question about "${query}", but I need to be careful about the content I generate. Could you try rephrasing your question or being more specific about what you're trying to accomplish? I'm here to help with programming and technical topics.`;
}

function generateGenericFallback(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('next.js') || lowerQuery.includes('nextjs')) {
    return `For Next.js questions like "${query}", I recommend checking the official Next.js documentation at nextjs.org. They have excellent guides on routing, API routes, server components, and deployment. The Learn section is particularly helpful for getting started.`;
  }
  
  if (lowerQuery.includes('react')) {
    return `For React questions about "${query}", the official React documentation at react.dev is your best resource. They have comprehensive guides on hooks, components, and modern React patterns. The tutorial section is great for hands-on learning.`;
  }
  
  if (lowerQuery.includes('typescript')) {
    return `For TypeScript questions like "${query}", check out the TypeScript handbook at typescriptlang.org. It covers types, interfaces, generics, and advanced patterns. The playground tool is excellent for testing TypeScript concepts.`;
  }
  
  if (lowerQuery.includes('python')) {
    return `For Python questions about "${query}", the official Python documentation at python.org is excellent. They have great tutorials, library references, and community guides. The Python Package Index (PyPI) is also helpful for finding libraries.`;
  }
  
  return `I'm experiencing some technical difficulties with your question about "${query}". For immediate help, I recommend checking the official documentation for the technology you're working with, or searching for your specific question on Stack Overflow. I'll try to get back to full functionality soon!`;
}

export async function GET() {
  return NextResponse.json({
    service: 'Gemini 2.0 Flash Analysis',
    status: 'running',
    model: 'gemini-2.0-flash-exp',
    capabilities: [
      'Code explanation and generation',
      'Technical documentation assistance',
      'Best practices recommendations',
      'Debugging and troubleshooting',
      'Framework-specific guidance'
    ],
    fallbacks: [
      'API key missing fallback',
      'Timeout handling',
      'Quota limit handling',
      'Safety filter handling',
      'Generic error handling'
    ],
    timeout: '10 seconds',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
}