export class AudioManager {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  async initialize(onAudioData: (data: ArrayBuffer) => void, onVoiceLevel: (level: number) => void): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.stream = stream;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    const source = this.context.createMediaStreamSource(stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const audioData = event.inputBuffer.getChannelData(0);
      const speechLevel = this.detectVoiceActivity(audioData);
      
      onVoiceLevel(speechLevel);
      
      const pcmData = this.convertToPCM16(audioData);
      onAudioData(pcmData);
    };

    source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  private detectVoiceActivity(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return sum / audioData.length;
  }

  private convertToPCM16(float32Array: Float32Array): ArrayBuffer {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return pcm16Array.buffer;
  }

  async playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.play().catch(() => {
        this.currentAudio = null;
        resolve();
      });
    });
  }

  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    speechSynthesis.cancel();
  }

  cleanup(): void {
    this.stopAudio();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}