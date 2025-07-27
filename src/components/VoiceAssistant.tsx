'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, VolumeX, Loader2 } from 'lucide-react';

interface UniversalStreamingMessage {
  type: 'Begin' | 'Turn' | 'Termination';
  id?: string;
  turn_order?: number;
  turn_is_formatted?: boolean;
  end_of_turn?: boolean;
  transcript?: string;
  end_of_turn_confidence?: number;
  words?: Array<{
    text: string;
    word_is_final: boolean;
    start: number;
    end: number;
    confidence: number;
  }>;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Text-to-Speech with ElevenLabs fallback to Web Speech
  const speakResponse = useCallback(async (text: string) => {
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
      console.log('ElevenLabs TTS failed, falling back to Web Speech API', error);
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
  }, []);

  // Process voice query through the AI pipeline
  const processVoiceQuery = useCallback(async (transcript: string, transcriptionTime: number) => {
    console.log('Processing voice query:', transcript);
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
        const errorText = await response.text();
        console.error(`API error: ${response.status} - ${errorText}`);
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('AI response received:', result);
      
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
  }, [onConversation, onProcessingChange, speakResponse]);

  // Convert Float32Array to PCM16 format for AssemblyAI
  const convertFloat32ToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return pcm16Array.buffer;
  };

  // Initialize Universal-Streaming WebSocket
  const initializeUniversalStreaming = useCallback(async () => {
    try {
      // Check if WebSocket is already connected or connecting
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setConnectionStatus('connecting');
      
      const apiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        throw new Error('AssemblyAI API key not found. Please add NEXT_PUBLIC_ASSEMBLYAI_API_KEY to your .env.local file.');
      }
      
      // Verify API key has reasonable length (AssemblyAI keys are typically longer)
      if (apiKey.length < 32) {
        console.warn('⚠️ AssemblyAI API key seems short. Make sure you have a valid key.');
        // Don't throw error here, let the WebSocket connection fail with proper error
      }

      console.log('Using API key:', apiKey.substring(0, 8) + '...');

      // Universal-Streaming v3 with correct parameters from documentation
      const params = new URLSearchParams({
        token: apiKey,
        sample_rate: '16000',
        encoding: 'pcm_s16le',
        format_turns: 'false' // Use unformatted for lower latency (recommended for voice agents)
      });
      
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
      console.log('Connecting to AssemblyAI Universal-Streaming v3...');
      console.log('Parameters:', { sample_rate: 16000, encoding: 'pcm_s16le', format_turns: false });
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Universal-Streaming connected successfully');
        setConnectionStatus('connected');
        console.log('WebSocket ready to receive audio data');
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          
          if (data.type === 'Begin') {
            console.log('Session started:', data.id);
          } else if (data.type === 'Turn') {
            const transcript = data.transcript || '';
            const endOfTurn = data.end_of_turn;
            const isFormatted = data.turn_is_formatted;
            
            console.log('Transcript received:', transcript, 'End of turn:', endOfTurn, 'Formatted:', isFormatted);
            
            if (transcript) {
              setCurrentTranscript(transcript);
              
              // Process when turn ends and is formatted (or unformatted if no formatting requested)
              if (endOfTurn && transcript.trim()) {
                const transcriptionTime = Date.now() - startTimeRef.current;
                setLatencyStats(prev => ({ ...prev, transcription: transcriptionTime }));
                console.log('End of turn detected, processing query...');
                
                await processVoiceQuery(transcript, transcriptionTime);
              }
            }
          } else if (data.type === 'Termination') {
            console.log('Session terminated:', data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Universal-Streaming WebSocket error:', error);
        console.error('WebSocket readyState:', wsRef.current?.readyState);
        setConnectionStatus('disconnected');
        
        // Provide user-friendly error message
        alert('WebSocket connection failed. Please check your API key and internet connection.');
      };

      wsRef.current.onclose = (event) => {
        console.log('Universal-Streaming disconnected. Code:', event.code, 'Reason:', event.reason);
        setConnectionStatus('disconnected');
        
        // Handle specific error codes
        if (event.code === 1008) {
          if (event.reason.includes('Missing Authorization header')) {
            alert('Authentication failed: Please check your AssemblyAI API key.');
          } else if (event.reason.includes('Too many concurrent sessions')) {
            alert('Too many concurrent sessions. Please wait and try again.');
          } else {
            alert(`Authentication error: ${event.reason}`);
          }
        } else if (event.code === 3005) {
          alert(`Session error: ${event.reason}`);
        }
      };

    } catch (error) {
      console.error('Failed to initialize Universal-Streaming:', error);
      setConnectionStatus('disconnected');
    }
  }, [processVoiceQuery]);

  // Start listening with proper audio processing
  const startListening = async () => {
    try {
      if (connectionStatus !== 'connected') {
        console.log('Initializing WebSocket connection...');
        await initializeUniversalStreaming();
        
        // Wait for connection with timeout
        let attempts = 0;
        const maxAttempts = 30;
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('WebSocket connected successfully!');
            break;
          }
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            console.error('WebSocket closed during connection attempt');
            break;
          }
          attempts++;
        }
        
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          throw new Error(`WebSocket connection failed. Current state: ${wsRef.current?.readyState}`);
        }
      }

      // Get user media with proper constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      audioStreamRef.current = stream;
      
      // Create AudioContext for proper audio processing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmData = convertFloat32ToPCM16(inputData);
          wsRef.current.send(pcmData);
        }
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      startTimeRef.current = Date.now();
      setIsListening(true);
      console.log('Started listening with audio processing...');
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      
      // Better error handling for microphone permissions
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone access in your browser settings and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Microphone is being used by another application. Please close other apps using the microphone.');
        } else {
          alert(`Microphone error: ${error.message}. Please check your microphone settings.`);
        }
      } else {
        alert('Failed to access microphone. Please check your browser permissions.');
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    console.log('Stopping listening...');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
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

  // Initialize connection on mount (only once)
  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      if (mounted && connectionStatus === 'disconnected') {
        console.log('Component mounted, initializing WebSocket...');
        await initializeUniversalStreaming();
      }
    };
    
    initialize();
    
    return () => {
      console.log('Component unmounting, cleaning up...');
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency to run only once

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
          {wsRef.current && (
            <span className="text-xs text-gray-500 ml-2">
              State: {wsRef.current.readyState}
            </span>
          )}
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