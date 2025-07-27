interface UniversalStreamingMessage {
  type: 'Begin' | 'Turn' | 'Termination';
  id?: string;
  transcript?: string;
  end_of_turn?: boolean;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private onTranscript?: (transcript: string, isComplete: boolean) => void;
  private onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void;

  async connect(
    onTranscript: (transcript: string, isComplete: boolean) => void,
    onStatusChange: (status: 'connected' | 'connecting' | 'disconnected') => void
  ): Promise<void> {
    this.onTranscript = onTranscript;
    this.onStatusChange = onStatusChange;

    if (this.ws?.readyState === WebSocket.OPEN) return;

    onStatusChange('connecting');

    const apiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
    if (!apiKey) throw new Error('AssemblyAI API key not found');

    const params = new URLSearchParams({
      token: apiKey,
      sample_rate: '16000',
      encoding: 'pcm_s16le',
      format_turns: 'false',
      word_boost: JSON.stringify([
        'better auth', 'betterauth', 'authentication', 'nextjs', 'next.js',
        'react', 'typescript', 'drizzle', 'drizzle orm', 'prisma', 'tailwind'
      ]),
      boost_param: 'high'
    });

    this.ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params.toString()}`);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      onStatusChange('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data: UniversalStreamingMessage = JSON.parse(event.data);
        
        if (data.type === 'Turn' && data.transcript) {
          onTranscript(data.transcript, !!data.end_of_turn);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onerror = () => {
      console.error('WebSocket error');
      onStatusChange('disconnected');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      onStatusChange('disconnected');
    };
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}