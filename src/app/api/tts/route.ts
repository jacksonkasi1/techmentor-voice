// src/app/api/tts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { geminiMain } from '@/lib/gemini-client';

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MAX_TTS_LENGTH = 500; // Maximum characters for TTS

export async function POST(request: NextRequest) {
  try {
    const { text, voice, speed = 1.0 }: TTSRequest = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Check text length BEFORE processing
    if (text.length > MAX_TTS_LENGTH) {
      console.error(`Text too long for TTS: ${text.length} characters (max: ${MAX_TTS_LENGTH})`);
      return NextResponse.json(
        { 
          error: 'Text too long for TTS',
          message: `Text must be under ${MAX_TTS_LENGTH} characters. Received: ${text.length}`,
          textLength: text.length,
          maxLength: MAX_TTS_LENGTH
        },
        { status: 400 }
      );
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsKey) {
      console.log('ElevenLabs API key not found, client will use Web Speech API fallback');
      return NextResponse.json(
        { 
          error: 'ElevenLabs API key not configured',
          useWebSpeech: true,
          message: 'Using Web Speech API fallback'
        },
        { status: 422 }
      );
    }

    console.log(`Generating TTS for text length: ${text.length} characters`);

    // Clean text for TTS (but keep it short)
    const cleanedText = await cleanTextForTTS(text);
    
    // Double-check cleaned text length
    if (cleanedText.length > MAX_TTS_LENGTH) {
      console.error(`Cleaned text still too long: ${cleanedText.length} characters`);
      // Truncate with ellipsis
      const truncated = cleanedText.substring(0, MAX_TTS_LENGTH - 3) + '...';
      console.log(`Truncated to: ${truncated.length} characters`);
    }

    const voiceId = voice || DEFAULT_VOICE_ID;

    // Call ElevenLabs API
    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey
      },
      body: JSON.stringify({
        text: cleanedText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
          speaking_rate: speed
        },
        output_format: 'mp3_44100_128'
      })
    });

    if (!response.ok) {
      console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    console.log(`TTS generated successfully: ${audioBuffer.byteLength} bytes`);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    console.error('TTS generation error:', error);
    
    return NextResponse.json(
      {
        error: 'TTS generation failed',
        useWebSpeech: true,
        message: 'Falling back to Web Speech API'
      },
      { status: 500 }
    );
  }
}

async function cleanTextForTTS(text: string): Promise<string> {
  try {
    // First do basic cleanup
    const basicCleanup = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '. ')
      .trim();

    // Use Gemini to intelligently clean and optimize the text for voice
    const prompt = `Clean and optimize this text for text-to-speech (TTS) output. Make it natural for voice reading.

Original text:
${basicCleanup}

Rules:
1. Remove ALL markdown formatting (**, *, \`, #, etc.)
2. Replace code blocks with brief descriptions like "code example for X"
3. Convert technical symbols to spoken words (& → and, @ → at, # → hash)
4. Replace URLs with "link" or "website"
5. Convert file extensions to spoken form (.js → JavaScript file)
6. Remove or rephrase anything that doesn't make sense when spoken
7. Keep technical terms but make them pronounceable
8. Ensure natural sentence flow for voice
9. NO asterisks, NO backticks, NO formatting symbols
10. If there are installation commands or code, summarize what they do instead

Examples:
- "Install with \`npm install @100mslive/sdk\`" → "Install using npm install one hundred ms live SDK"
- "Check the **documentation** at https://..." → "Check the documentation at their website"
- "config.js file" → "config JavaScript file"

Cleaned text for TTS:`;

    const result = await geminiMain.generateContent(prompt);
    const cleanedText = result.response.text().trim();
    
    // Final safety cleanup to ensure no formatting remains
    return cleanedText
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#/g, '')
      .replace(/```math/g, '')
      .replace(/```/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
  } catch (error) {
    console.error('Gemini text cleaning failed, using fallback:', error);
    // Fallback to basic cleaning if Gemini fails
    return fallbackCleanText(text);
  }
}

function fallbackCleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/`(.*?)`/g, '$1')        // Inline code
    .replace(/#{1,6}\s*/g, '')        // Headers
    // Clean up code blocks
    .replace(/```[\s\S]*?```/g, 'code example')
    .replace(/```/g, '')
    // Replace technical symbols with spoken equivalents
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/#/g, ' hash ')
    .replace(/\$/g, ' dollar ')
    .replace(/%/g, ' percent ')
    // Handle URLs
    .replace(/https?:\/\/[^\s]+/g, 'website link')
    // Handle file extensions
    .replace(/\.(js|ts|tsx|jsx|py|css|html|json|md)($|\s)/g, ' $1 file$2')
    // Clean up
    .replace(/\n+/g, '. ')           // Convert newlines to periods
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim();
}
