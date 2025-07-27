import { NextRequest, NextResponse } from 'next/server';

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - Natural, professional voice
const ALTERNATIVE_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam - Clear, friendly voice

export async function POST(request: NextRequest) {
  try {
    const { text, voice, speed = 1.0 }: TTSRequest = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    
    // If no ElevenLabs API key, return instruction to use Web Speech API
    if (!elevenLabsKey) {
      console.log('ElevenLabs API key not found, client will use Web Speech API fallback');
      return NextResponse.json(
        { 
          error: 'ElevenLabs API key not configured',
          useWebSpeech: true,
          message: 'Using Web Speech API fallback'
        },
        { status: 422 } // Unprocessable Entity - signals client to use fallback
      );
    }

    console.log(`Generating TTS for text length: ${text.length} characters`);

    // Clean and prepare text for TTS
    const cleanedText = cleanTextForTTS(text);
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
        model_id: 'eleven_monolingual_v1', // Fast, high-quality model
        voice_settings: {
          stability: 0.5,      // Balanced stability
          similarity_boost: 0.75,  // Good voice consistency
          style: 0.3,          // Slightly expressive
          use_speaker_boost: true,
          speaking_rate: speed
        },
        output_format: 'mp3_44100_128' // Good quality, reasonable size
      })
    });

    if (!response.ok) {
      console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      
      // Try with alternative voice
      if (voiceId === DEFAULT_VOICE_ID) {
        console.log('Retrying with alternative voice...');
        return await retryWithAlternativeVoice(cleanedText, speed, elevenLabsKey);
      }
      
      throw new Error(`ElevenLabs API failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    console.log(`TTS generated successfully: ${audioBuffer.byteLength} bytes`);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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

async function retryWithAlternativeVoice(text: string, speed: number, apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/${ALTERNATIVE_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
          speaking_rate: speed
        },
        output_format: 'mp3_44100_128'
      })
    });

    if (!response.ok) {
      throw new Error(`Alternative voice also failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    console.error('Alternative voice TTS failed:', error);
    throw error;
  }
}

function cleanTextForTTS(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/`(.*?)`/g, '$1')        // Inline code
    .replace(/#{1,6}\s*/g, '')        // Headers
    // Clean up code blocks
    .replace(/```[\s\S]*?```/g, '[code example]')
    .replace(/```/g, '')
    // Replace technical symbols with spoken equivalents
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/#/g, ' hash ')
    .replace(/\$/g, ' dollar ')
    .replace(/%/g, ' percent ')
    // Handle URLs
    .replace(/https?:\/\/[^\s]+/g, '[link]')
    // Handle file extensions
    .replace(/\.(js|ts|tsx|jsx|py|css|html|json|md)($|\s)/g, ' $1 file$2')
    // Clean up
    .replace(/\n+/g, '. ')           // Convert newlines to periods
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim();
}

export async function GET() {
  const hasApiKey = !!process.env.ELEVENLABS_API_KEY;
  
  return NextResponse.json({
    service: 'Text-to-Speech API',
    status: 'running',
    provider: hasApiKey ? 'ElevenLabs' : 'Web Speech API (fallback)',
    elevenlabsConfigured: hasApiKey,
    defaultVoice: hasApiKey ? DEFAULT_VOICE_ID : 'browser-default',
    supportedFormats: hasApiKey ? ['mp3'] : ['browser-native'],
    features: hasApiKey ? [
      'High-quality neural TTS',
      'Multiple voice options',
      'Speed control',
      'Professional voice cloning'
    ] : [
      'Browser-native TTS',
      'No API required',
      'Local processing'
    ],
    timestamp: new Date().toISOString()
  });
}