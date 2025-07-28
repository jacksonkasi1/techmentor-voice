import { NextRequest, NextResponse } from "next/server";
import {
  VoiceQueryRequest,
  VoiceQueryResponse,
} from "@/lib/voice-assistant/types";
import { QueryCorrector } from "@/lib/voice-assistant/query-corrector";
import { MCPClient } from "@/lib/voice-assistant/mcp-client";
import { ResponseGenerator } from "@/lib/voice-assistant/response-generator";

const MAX_VOICE_RESPONSE_LENGTH = 400; // Keep responses short for voice

export async function POST(
  request: NextRequest
): Promise<NextResponse<VoiceQueryResponse>> {
  const startTime = Date.now();
  console.log("🎤 Voice query processing started");

  try {
    const { query, timestamp }: VoiceQueryRequest = await request.json();
    
    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        response: "I didn't catch that. Could you please repeat your question?",
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    const trimmedQuery = query.trim();
    console.log(`📝 Original query: "${trimmedQuery}"`);

    // Check if it's a conversational query
    const isConversational = QueryCorrector.isConversational(trimmedQuery);

    if (isConversational) {
      console.log("🗣️ Handling conversational query directly");

      const response = await ResponseGenerator.generate({
        query: trimmedQuery,
        correctedQuery: trimmedQuery,
        documentation: "",
        libraries: [],
        isConversational: true,
      });

      // Ensure response is voice-friendly length
      const voiceResponse = ensureVoiceLength(response);

      return NextResponse.json({
        success: true,
        response: voiceResponse,
        queryCorrection: { original: trimmedQuery, corrected: trimmedQuery },
        context: { libraries: [], hasDocumentation: false },
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // For technical queries, use the full pipeline
    console.log("🔧 Technical query - using full pipeline");

    // Step 1: Correct the query with timeout
    const correctedQuery = await Promise.race([
      QueryCorrector.correct(trimmedQuery),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Query correction timeout')), 3000)
      )
    ]).catch(error => {
      console.warn("⚠️ Query correction failed, using original:", error.message);
      return trimmedQuery;
    });

    // Step 2: Search MCP for documentation with timeout
    const searchResult = await Promise.race([
      MCPClient.search(correctedQuery),
      new Promise<{ documentation: string; libraries: string[] }>((_, reject) => 
        setTimeout(() => reject(new Error('MCP search timeout')), 5000)
      )
    ]).catch(error => {
      console.warn("⚠️ MCP search failed:", error.message);
      return { documentation: "", libraries: [] };
    });

    const { documentation, libraries } = searchResult;

    // Step 3: Generate final response
    const finalResponse = await ResponseGenerator.generate({
      query: trimmedQuery,
      correctedQuery,
      documentation,
      libraries,
      isConversational: false,
    });

    // Ensure response is voice-friendly
    const voiceResponse = ensureVoiceLength(finalResponse);

    // Log if we had to truncate
    if (voiceResponse !== finalResponse) {
      console.log(`📏 Response truncated from ${finalResponse.length} to ${voiceResponse.length} chars`);
    }

    console.log("✅ Response generated successfully");

    return NextResponse.json({
      success: true,
      response: voiceResponse,
      queryCorrection: {
        original: trimmedQuery,
        corrected: correctedQuery,
      },
      context: {
        libraries: libraries || [],
        hasDocumentation: !!documentation,
      },
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ Voice query error:", error);
    
    // Determine appropriate error response
    const errorMessage = getErrorResponse(error);

    return NextResponse.json({
      success: true, // Keep true to ensure voice continues
      response: errorMessage,
      fallback: true,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Ensures response is appropriate length for voice output
 */
function ensureVoiceLength(text: string): string {
  if (!text || text.length <= MAX_VOICE_RESPONSE_LENGTH) {
    return text;
  }

  // Try to cut at a sentence boundary
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let result = "";
  
  for (const sentence of sentences) {
    if ((result + sentence).length > MAX_VOICE_RESPONSE_LENGTH - 20) {
      break;
    }
    result += sentence;
  }

  // If we couldn't get any complete sentences, just truncate
  if (!result) {
    result = text.substring(0, MAX_VOICE_RESPONSE_LENGTH - 3) + "...";
  }

  return result.trim();
}

/**
 * Get appropriate error response based on error type
 */
function getErrorResponse(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      return "The response is taking longer than expected. Please try asking your question again.";
    }
    if (error.message.includes('network')) {
      return "I'm having trouble connecting to the documentation. Please check your connection and try again.";
    }
  }
  
  return "I encountered an issue processing your question. Could you please rephrase it and try again?";
}