interface VoiceQueryResponse {
  success: boolean;
  response: string;
  queryCorrection?: {
    original: string;
    corrected: string;
  };
  context?: {
    libraries: string[];
    hasDocumentation: boolean;
  };
  processingTime?: number;
}

export class VoiceAPI {
  static async processQuery(query: string): Promise<VoiceQueryResponse> {
    const response = await fetch('/api/voice-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, timestamp: Date.now() }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  static async synthesizeSpeech(text: string): Promise<Blob | null> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
    
    return null;
  }

  static async speakWithFallback(text: string): Promise<void> {
    const audioBlob = await this.synthesizeSpeech(text);
    
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
          resolve();
        };
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } else {
      // Fallback to Speech Synthesis
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      });
    }
  }
}