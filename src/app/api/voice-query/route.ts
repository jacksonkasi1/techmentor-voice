import { NextRequest, NextResponse } from 'next/server';

interface VoiceQueryRequest {
  query: string;
  timestamp: number;
}

interface MCPResponse {
  context?: string;
  libraries?: string[];
}

interface GeminiResponse {
  response: string;
  reasoning?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query, timestamp }: VoiceQueryRequest = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`Processing voice query: "${query}" at ${new Date(timestamp).toISOString()}`);

    // Step 1: Get context from Context7 MCP
    let mcpContext: MCPResponse = {};
    try {
      const mcpResponse = await fetch(`${process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3000'}/api/mcp-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (mcpResponse.ok) {
        mcpContext = await mcpResponse.json();
        console.log('MCP context retrieved successfully');
      } else {
        console.warn('MCP context retrieval failed, continuing without context');
      }
    } catch (error) {
      console.warn('MCP context error:', error);
      // Continue without context
    }

    // Step 2: Process with Gemini 2.0 Flash
    const geminiResponse = await fetch(`${process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3000'}/api/gemini-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        context: mcpContext.context,
        libraries: mcpContext.libraries,
        timestamp
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini analysis failed: ${geminiResponse.status}`);
    }

    const geminiResult: GeminiResponse = await geminiResponse.json();

    // Return the complete response
    return NextResponse.json({
      success: true,
      response: geminiResult.response,
      context: mcpContext.context,
      libraries: mcpContext.libraries,
      reasoning: geminiResult.reasoning,
      processingTime: Date.now() - timestamp,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Voice query processing error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process voice query',
        response: "I'm sorry, I encountered an error processing your request. Please try asking your question again, or check if the services are running properly."
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'TechMentor Voice Query API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      '/api/voice-query': 'POST - Main voice query processing',
      '/api/mcp-context': 'POST - Context7 MCP integration',
      '/api/gemini-analyze': 'POST - Gemini 2.0 Flash analysis',
      '/api/tts': 'POST - Text-to-speech conversion'
    },
    timestamp: new Date().toISOString()
  });
}