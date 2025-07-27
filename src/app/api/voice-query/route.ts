import { NextRequest, NextResponse } from 'next/server';
import { VoiceQueryRequest, VoiceQueryResponse } from '@/lib/voice-assistant/types';
import { QueryCorrector } from '@/lib/voice-assistant/query-corrector';
import { MCPClient } from '@/lib/voice-assistant/mcp-client';
import { ResponseGenerator } from '@/lib/voice-assistant/response-generator';

export async function POST(request: NextRequest): Promise<NextResponse<VoiceQueryResponse>> {
  console.log('🎤 Voice query processing started');
  
  try {
    const { query, timestamp }: VoiceQueryRequest = await request.json();
    console.log(`📝 Original query: "${query}"`);

    // Check if it's a conversational query
    const isConversational = QueryCorrector.isConversational(query);

    if (isConversational) {
      console.log('🗣️ Handling conversational query directly');
      
      const response = await ResponseGenerator.generate({
        query,
        correctedQuery: query,
        documentation: '',
        libraries: [],
        isConversational: true
      });
      
      return NextResponse.json({
        success: true,
        response,
        queryCorrection: { original: query, corrected: query },
        context: { libraries: [], hasDocumentation: false },
        processingTime: Date.now() - timestamp,
        timestamp: new Date().toISOString()
      });
    }

    // For technical queries, use the full pipeline
    console.log('🔧 Technical query - using full pipeline');

    // Step 1: Correct the query
    const correctedQuery = await QueryCorrector.correct(query);

    // Step 2: Search MCP for documentation
    const { documentation, libraries } = await MCPClient.search(correctedQuery);

    // Step 3: Generate final response
    const finalResponse = await ResponseGenerator.generate({
      query,
      correctedQuery,
      documentation,
      libraries,
      isConversational: false
    });

    console.log('✅ Response generated successfully');

    return NextResponse.json({
      success: true,
      response: finalResponse,
      queryCorrection: {
        original: query,
        corrected: correctedQuery
      },
      context: {
        libraries: libraries || [],
        hasDocumentation: !!documentation
      },
      processingTime: Date.now() - timestamp,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Voice query error:', error);
    
    // Always return a helpful response
    return NextResponse.json({
      success: true,
      response: "I'm having trouble processing your question. Could you please try asking again?",
      fallback: true,
      processingTime: Date.now() - Date.now(),
      timestamp: new Date().toISOString()
    });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'TechMentor Voice Query API',
    status: 'running',
    version: '2.0',
    architecture: 'modular',
    modules: [
      'QueryCorrector - Voice input correction',
      'MCPClient - Documentation search',
      'ResponseGenerator - AI response generation'
    ],
    flow: [
      '1. Voice Query → Query Correction',
      '2. Corrected Query → MCP Documentation Search',
      '3. Context + Query → AI Response Generation',
      '4. Response → Text-to-Speech'
    ],
    timestamp: new Date().toISOString()
  });
}