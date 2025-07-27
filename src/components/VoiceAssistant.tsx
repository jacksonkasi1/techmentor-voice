'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Brain, Volume2, VolumeX, Loader2 } from 'lucide-react';

interface UniversalStreamingMessage {
  turn_order: number;
  turn_is_formatted: boolean;
  end_of_turn: boolean;
  transcript: string;
  end_of_turn_confidence: number;
}

interface VoiceAssistantProps {
  onConversation: (userInput: string, aiResponse: string, context?: string) => void;
  onProcessingChange: (processing: boolean) => void;
}

export default function VoiceAssistant({ onConversation, onProcessingChange }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [latencyStats, setLatencyStats] = useState({ transcription: 0, processing: 0, total: 0 });
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  // Initialize Universal-Streaming WebSocket
  const initializeUniversalStreaming = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      
      const apiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        throw new Error('AssemblyAI API key not found');
      }

      // Universal-Streaming v3 endpoint
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?api_key=${apiKey}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Universal-Streaming connected');
        setConnectionStatus('connected');
        
        // Configure Universal-Streaming for optimal voice agent performance
        const config = {
          type: 'configure',
          format_turns: true,          // Enhanced formatting
          punctuate: true,            // Automatic punctuation
          diarize: false,             // Single speaker
          end_utterance_silence_threshold: 1000  // 1 second silence detection
        };
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(config));
        }
      };

      wsRef.current.onmessage = async (event) => {
        const data: UniversalStreamingMessage = JSON.parse(event.data);
        
        if (data.transcript) {
          setCurrentTranscript(data.transcript);
          
          // Process when turn ends (intelligent endpointing)
          if (data.end_of_turn && data.transcript.trim()) {
            const transcriptionTime = Date.now() - startTimeRef.current;
            setLatencyStats(prev => ({ ...prev, transcription: transcriptionTime }));
            
            await processVoiceQuery(data.transcript, transcriptionTime);
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Universal-Streaming error:', error);
        setConnectionStatus('disconnected');
      };

      wsRef.current.onclose = () => {
        console.log('Universal-Streaming disconnected');
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('Failed to initialize Universal-Streaming:', error);
      setConnectionStatus('disconnected');
    }
  }, []);

  // Process voice query through the AI pipeline
  const processVoiceQuery = async (transcript: string, transcriptionTime: number) => {
    setIsProcessing(true);
    onProcessingChange(true);
    const processingStart = Date.now();

    try {
      // Call the main voice query API
      const response = await fetch('/api/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: transcript,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - processingStart;
      const totalTime = Date.now() - startTimeRef.current;
      
      setLatencyStats({
        transcription: transcriptionTime,
        processing: processingTime,
        total: totalTime
      });

      // Add to conversation history
      onConversation(transcript, result.response, result.context);

      // Speak the response
      await speakResponse(result.response);

    } catch (error) {
      console.error('Voice query processing failed:', error);
      const errorMessage = 'I encountered an error processing your request. Please try again.';
      onConversation(transcript, errorMessage);
      await speakResponse(errorMessage);
    } finally {
      setIsProcessing(false);
      onProcessingChange(false);
      setCurrentTranscript('');
    }
  };

  // Text-to-Speech with ElevenLabs fallback to Web Speech
  const speakResponse = async (text: string) => {
    setIsSpeaking(true);
    
    try {
      // Try ElevenLabs first
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
        return;
      }
    } catch (error) {
      console.log('ElevenLabs TTS failed, falling back to Web Speech API');
    }

    // Fallback to Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  // Start listening
  const startListening = async () => {
    try {
      if (connectionStatus !== 'connected') {
        await initializeUniversalStreaming();
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send audio to Universal-Streaming
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              const audioData = new Uint8Array(arrayBuffer);
              wsRef.current?.send(audioData);
            };
            reader.readAsArrayBuffer(event.data);
          }
        }
      };

      mediaRecorder.start(100); // Send data every 100ms for real-time processing
      setIsListening(true);
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  // Stop listening
  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsListening(false);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Initialize connection on mount
  useEffect(() => {
    initializeUniversalStreaming();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeUniversalStreaming]);

  return (
    <div className="glass-morphism rounded-2xl p-8">
      {/* Connection Status */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className={`status-dot ${
            connectionStatus === 'connected' ? 'connected' : 
            connectionStatus === 'connecting' ? 'connecting' : 'disconnected'
          }`} />
          <span className="text-sm text-gray-300">
            Universal-Streaming: {connectionStatus}
          </span>
        </div>
        
        {/* Latency Stats */}
        {latencyStats.total > 0 && (
          <div className="text-sm text-gray-400 font-mono">
            Latency: {latencyStats.total}ms (T:{latencyStats.transcription}ms + P:{latencyStats.processing}ms)
          </div>
        )}
      </div>

      {/* Current Transcript */}
      <div className="mb-6 min-h-[60px]">
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 backdrop-blur-xs">
          {currentTranscript ? (
            <p className="text-white animate-fadeIn">{currentTranscript}</p>
          ) : isListening ? (
            <p className="text-gray-400 italic animate-pulse-custom">Listening... speak now</p>
          ) : (
            <p className="text-gray-500 italic">Click the microphone to start speaking</p>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-4">
        {/* Microphone Button */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`voice-button ${
            isListening ? 'listening' : 'idle'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isListening ? (
            <MicOff className="h-8 w-8 text-white" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="voice-button processing">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {/* Speaking Control */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="voice-button speaking"
          >
            <VolumeX className="h-8 w-8 text-white" />
          </button>
        )}
      </div>

      {/* Status Text */}
      <div className="text-center mt-4">
        {isListening && (
          <p className="text-blue-400 font-medium">🎤 Listening...</p>
        )}
        {isProcessing && (
          <p className="text-purple-400 font-medium">🧠 Processing with AI...</p>
        )}
        {isSpeaking && (
          <p className="text-orange-400 font-medium">🔊 Speaking response...</p>
        )}
        {!isListening && !isProcessing && !isSpeaking && (
          <p className="text-gray-400">Ready to help with your technical questions</p>
        )}
      </div>
    </div>
  );
}