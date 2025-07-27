import { NextRequest, NextResponse } from 'next/server';

interface VoiceQueryRequest {
  query: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  console.log('🎤 Voice query API called');
  
  try {
    const body = await request.json();
    const { query, timestamp }: VoiceQueryRequest = body;
    
    console.log('📝 Query received:', query);
    console.log('⏰ Timestamp:', new Date(timestamp).toISOString());

    if (!query || !query.trim()) {
      console.error('❌ Empty query received');
      return NextResponse.json(
        { 
          success: false,
          error: 'Query is required',
          response: 'Please provide a valid question.'
        },
        { status: 400 }
      );
    }

    // Step 1: Get context from Context7 MCP (with error handling)
    console.log('🔍 Step 1: Getting context from Context7 MCP...');
    let mcpContext = '';
    let mcpDocumentation = '';
    let libraries: string[] = [];
    
    try {
      const mcpResponse = await fetch(`http://localhost:3000/api/mcp-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        // Increase timeout to 15 seconds for MCP
        signal: AbortSignal.timeout(15000)
      });

      console.log('📚 MCP response status:', mcpResponse.status);

      if (mcpResponse.ok) {
        const mcpData = await mcpResponse.json();
        mcpContext = mcpData.context || '';
        mcpDocumentation = mcpData.documentation || '';
        libraries = mcpData.libraries || [];
        
        console.log('✅ MCP context retrieved:', {
          hasContext: !!mcpContext,
          contextLength: mcpContext.length,
          hasDocumentation: !!mcpDocumentation,
          documentationLength: mcpDocumentation.length,
          libraries: libraries,
          source: mcpData.source
        });
      } else {
        console.warn('⚠️ MCP context retrieval failed:', mcpResponse.status);
      }
    } catch (mcpError) {
      console.warn('⚠️ MCP context error:', mcpError);
      // Continue without context - this is not critical
    }

    // Step 2: Process with Gemini 2.0 Flash
    console.log('🤖 Step 2: Processing with Gemini 2.0 Flash...');
    
    try {
      const geminiResponse = await fetch(`http://localhost:3000/api/gemini-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: mcpContext || mcpDocumentation, // Use either context or documentation
          libraries: libraries,
          timestamp
        }),
        // Add timeout for Gemini as well
        signal: AbortSignal.timeout(10000)
      });

      console.log('🧠 Gemini response status:', geminiResponse.status);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('❌ Gemini analysis failed:', geminiResponse.status, errorText);
        
        // Return a helpful fallback response instead of failing
        return NextResponse.json({
          success: true,
          response: `I understand you're asking about: "${query}". However, I'm currently having trouble accessing my knowledge base. Could you please rephrase your question or try asking about a specific technology like Next.js, React, or Python?`,
          context: mcpContext,
          documentation: mcpDocumentation,
          libraries: libraries,
          processingTime: Date.now() - timestamp,
          timestamp: new Date().toISOString(),
          fallback: true
        });
      }

      const geminiResult = await geminiResponse.json();
      console.log('✅ Gemini response received:', {
        hasResponse: !!geminiResult.response,
        responseLength: geminiResult.response?.length || 0,
        success: geminiResult.success
      });

      // Handle Gemini API errors gracefully
      if (!geminiResult.success) {
        return NextResponse.json({
          success: true,
          response: geminiResult.response || `I understand you're asking about: "${query}". I'm having some technical difficulties right now, but I can still help! For ${query.toLowerCase().includes('next') ? 'Next.js' : query.toLowerCase().includes('react') ? 'React' : query.toLowerCase().includes('typescript') ? 'TypeScript' : 'this topic'}, I recommend checking the official documentation for the most up-to-date information.`,
          context: mcpContext,
          documentation: mcpDocumentation,
          libraries: libraries,
          processingTime: Date.now() - timestamp,
          timestamp: new Date().toISOString(),
          fallback: true
        });
      }

      const finalResponse = {
        success: true,
        response: geminiResult.response || 'I received your question but got an empty response. Could you please rephrase your question?',
        context: mcpContext,
        documentation: mcpDocumentation,
        libraries: libraries,
        reasoning: geminiResult.reasoning,
        processingTime: Date.now() - timestamp,
        timestamp: new Date().toISOString()
      };

      console.log('🎉 Final response prepared:', {
        hasResponse: !!finalResponse.response,
        processingTime: finalResponse.processingTime
      });

      return NextResponse.json(finalResponse);

    } catch (geminiError) {
      console.error('💥 Gemini processing error:', geminiError);
      
      // Provide a helpful fallback response
      return NextResponse.json({
        success: true,
        response: generateIntelligentFallback(query),
        context: mcpContext,
        documentation: mcpDocumentation,
        libraries: libraries,
        processingTime: Date.now() - timestamp,
        timestamp: new Date().toISOString(),
        fallback: true
      });
    }

  } catch (error) {
    console.error('💥 Voice query processing error:', error);
    
    // Always provide a helpful response, never just fail
    const fallbackResponse = {
      success: true, // Mark as success to avoid error loops
      response: "I'm experiencing some technical difficulties, but I'm still here to help! Could you please try rephrasing your question? I'm great at helping with programming topics like Next.js, React, TypeScript, and Python.",
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - (Date.now() - 1000), // Approximate
      timestamp: new Date().toISOString(),
      fallback: true
    };

    console.log('❌ Error response:', fallbackResponse);
    
    return NextResponse.json(fallbackResponse, { status: 200 }); // Return 200 to avoid error loops
  }
}

// Keep the rest of the functions the same...
function generateIntelligentFallback(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Provide specific help based on query content
  if (lowerQuery.includes('next.js') || lowerQuery.includes('nextjs')) {
    return `For Next.js questions like "${query}", I recommend checking the official Next.js documentation at nextjs.org. They have excellent guides on routing, API routes, server components, and deployment. You can also find great examples in their GitHub repository.`;
  }
  
  if (lowerQuery.includes('react')) {
    return `For React questions about "${query}", the official React documentation at react.dev is your best resource. They have comprehensive guides on hooks, components, state management, and best practices. The React team keeps it very up-to-date.`;
  }
  
  if (lowerQuery.includes('typescript')) {
    return `For TypeScript questions like "${query}", I recommend the TypeScript handbook at typescriptlang.org. It covers types, interfaces, generics, and advanced patterns. The playground tool there is great for testing TypeScript concepts.`;
  }
  
  if (lowerQuery.includes('python')) {
    return `For Python questions about "${query}", check the official Python documentation at python.org. They have excellent tutorials, library references, and community guides. Python's documentation is known for being very beginner-friendly.`;
  }
  
  if (lowerQuery.includes('javascript') || lowerQuery.includes('js')) {
    return `For JavaScript questions like "${query}", MDN Web Docs (developer.mozilla.org) is the gold standard. They have comprehensive guides on ES6+, async/await, DOM manipulation, and modern JavaScript features.`;
  }
  
  if (lowerQuery.includes('cloudflare')) {
    return `For Cloudflare questions about "${query}", check out the Cloudflare Developers documentation at developers.cloudflare.com. They have great guides for Workers, Pages, R2, and other services with practical examples.`;
  }
  
  // Generic but helpful fallback
  return `I understand you're asking about "${query}". While I'm having some technical difficulties accessing my full knowledge base right now, I can still help! Try asking more specific questions about programming topics, or check the official documentation for the technology you're working with. I'm particularly good at helping with web development, APIs, and modern JavaScript frameworks.`;
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    service: 'TechMentor Voice Query API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      'POST /api/voice-query': 'Main voice query processing',
      'GET /api/voice-query': 'Health check',
      'POST /api/mcp-context': 'Context7 MCP integration',
      'POST /api/gemini-analyze': 'Gemini 2.0 Flash analysis',
      'POST /api/tts': 'Text-to-speech conversion'
    },
    environment: {
      hasAssemblyAI: !!process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
      nodeEnv: process.env.NODE_ENV
    },
    timestamp: new Date().toISOString()
  });
}