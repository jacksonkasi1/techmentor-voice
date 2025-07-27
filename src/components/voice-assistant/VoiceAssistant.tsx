'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioManager } from '@/lib/voice-assistant/audio-manager';
import { WebSocketManager } from '@/lib/voice-assistant/websocket-manager';
import { VoiceAPI } from '@/lib/voice-assistant/voice-api';
import { VoiceStatus } from './VoiceStatus';
import { VoiceDisplay } from './VoiceDisplay';
import { VoiceControls } from './VoiceControls';

interface ProcessingContext {
  queryCorrection?: { original: string; corrected: string; };
  libraries?: string[];
  hasDocumentation?: boolean;
  processingTime?: number;
}

interface VoiceAssistantProps {
  onConversation: (userInput: string, aiResponse: string, context?: ProcessingContext) => void;
  onProcessingChange: (processing: boolean) => void;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
type ProcessingStage = 'idle' | 'listening' | 'processing' | 'speaking';

export default function VoiceAssistant({ onConversation, onProcessingChange }: VoiceAssistantProps) {
  // Core State
  const [status, setStatus] = useState({
    listening: false,
    processing: false,
    speaking: false,
    connection: 'disconnected' as ConnectionStatus
  });
  
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [displayText, setDisplayText] = useState('');
  
  // Voice state
  const voiceState = useRef({
    speechLevel: 0,
    audioBytesSent: 0,
    lastTranscript: '',
    isProcessing: false
  });

  // Managers
  const audioManager = useRef<AudioManager>(new AudioManager());
  const wsManager = useRef<WebSocketManager>(new WebSocketManager());
  const speechTimer = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const CONFIG = {
    SPEECH_END_DELAY: 2000,
    AUDIO_THRESHOLD: 0.01,
    INTERRUPT_THRESHOLD: 0.02
  };

  // Clear speech timer
  const clearSpeechTimer = () => {
    if (speechTimer.current) {
      clearTimeout(speechTimer.current);
      speechTimer.current = null;
    }
  };

  // Process speech after delay
  const processSpeechWithDelay = (transcript: string) => {
    if (!transcript.trim() || voiceState.current.isProcessing) {
      console.log('Skipping processing: empty or already processing');
      return;
    }

    console.log(`Setting ${CONFIG.SPEECH_END_DELAY}ms timer for: "${transcript}"`);
    
    clearSpeechTimer();
    speechTimer.current = setTimeout(() => {
      console.log(`Timer fired! Processing: "${transcript}"`);
      processVoiceQuery(transcript);
    }, CONFIG.SPEECH_END_DELAY);
  };

  // Handle WebSocket transcript
  const handleTranscript = useCallback((transcript: string, isComplete: boolean) => {
    setDisplayText(transcript);
    voiceState.current.lastTranscript = transcript;
    
    console.log(`Transcript: "${transcript}" (complete: ${isComplete})`);
    
    if (isComplete && transcript.trim()) {
      console.log('End of turn detected - scheduling processing');
      processSpeechWithDelay(transcript.trim());
    }
  }, []);

  // Handle connection status
  const handleConnectionStatus = useCallback((connectionStatus: ConnectionStatus) => {
    setStatus(s => ({ ...s, connection: connectionStatus }));
    
    if (connectionStatus === 'connected') {
      startAudioProcessing();
    }
  }, []);

  // Handle audio data
  const handleAudioData = useCallback((audioData: ArrayBuffer) => {
    if (!status.speaking) {
      wsManager.current.sendAudio(audioData);
      voiceState.current.audioBytesSent += audioData.byteLength;
    }
  }, [status.speaking]);

  // Handle voice level
  const handleVoiceLevel = useCallback((level: number) => {
    voiceState.current.speechLevel = level;
    
    // Handle interruption during AI speech
    if (status.speaking && level > CONFIG.INTERRUPT_THRESHOLD) {
      console.log('User interruption detected!');
      handleInterruption();
    }
  }, [status.speaking]);

  // Handle user interruption
  const handleInterruption = () => {
    if (!status.speaking) return;

    audioManager.current.stopAudio();
    setStatus(s => ({ ...s, speaking: false }));
    setProcessingStage('listening');
    setDisplayText('');
    
    console.log('Interruption handled - ready for new input');
  };

  // Start audio processing
  const startAudioProcessing = async () => {
    try {
      console.log('Starting audio processing...');
      
      await audioManager.current.initialize(handleAudioData, handleVoiceLevel);
      
      setStatus(s => ({ ...s, listening: true }));
      setProcessingStage('listening');
      console.log('Audio pipeline active');
      
    } catch (error) {
      console.error('Audio setup failed:', error);
      alert(`Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Process voice query
  const processVoiceQuery = useCallback(async (text: string) => {
    if (voiceState.current.isProcessing) {
      console.log('Already processing, skipping');
      return;
    }

    console.log(`Starting to process: "${text}"`);
    
    voiceState.current.isProcessing = true;
    setStatus(s => ({ ...s, processing: true }));
    setProcessingStage('processing');
    onProcessingChange(true);
    
    clearSpeechTimer();
    setDisplayText('🧠 Processing...');

    try {
      console.log('Calling voice API...');
      
      const result = await VoiceAPI.processQuery(text);
      console.log('API response received successfully');
      
      const contextInfo: ProcessingContext = {
        queryCorrection: result.queryCorrection,
        libraries: result.context?.libraries || [],
        hasDocumentation: result.context?.hasDocumentation || false,
        processingTime: result.processingTime
      };
      
      console.log('Adding to conversation history');
      onConversation(text, result.response, contextInfo);
      
      console.log('Starting speech synthesis');
      await speakResponse(result.response);
      
    } catch (error) {
      console.error('Processing error:', error);
      
      let errorMessage = 'I encountered an error. Please try again.';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'That took too long to process. Please try a shorter question.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      await speakResponse(errorMessage);
      
    } finally {
      voiceState.current.isProcessing = false;
      setStatus(s => ({ ...s, processing: false }));
      onProcessingChange(false);
      setProcessingStage('listening');
      setDisplayText('');
      console.log('Processing complete');
    }
  }, [onConversation, onProcessingChange]);

  // Speak response
  const speakResponse = async (text: string) => {
    if (!text) return;

    console.log(`Speaking: "${text.slice(0, 50)}..."`);
    setStatus(s => ({ ...s, speaking: true }));
    setProcessingStage('speaking');
    setDisplayText('🔊 ' + text);

    try {
      await VoiceAPI.speakWithFallback(text);
      console.log('Speech completed');
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      if (status.speaking) {
        setStatus(s => ({ ...s, speaking: false }));
        setProcessingStage('listening');
        setDisplayText('');
        console.log('Speech completed - ready for input');
      }
    }
  };

  // Initialize WebSocket
  const initializeWebSocket = useCallback(async () => {
    try {
      console.log('Initializing WebSocket...');
      await wsManager.current.connect(handleTranscript, handleConnectionStatus);
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
    }
  }, [handleTranscript, handleConnectionStatus]);

  // Clean up everything
  const cleanup = useCallback(() => {
    console.log('Cleaning up...');
    
    clearSpeechTimer();
    audioManager.current.cleanup();
    wsManager.current.disconnect();
    
    setStatus({
      listening: false,
      processing: false,
      speaking: false,
      connection: 'disconnected'
    });
    setProcessingStage('idle');
    setDisplayText('');
    
    voiceState.current = {
      speechLevel: 0,
      audioBytesSent: 0,
      lastTranscript: '',
      isProcessing: false
    };
  }, []);

  // Restart connection
  const restart = useCallback(async () => {
    cleanup();
    await initializeWebSocket();
  }, [cleanup, initializeWebSocket]);

  // Initialize on mount
  useEffect(() => {
    console.log('Component mounted - initializing...');
    initializeWebSocket();
    
    return () => {
      console.log('Component unmounting...');
      clearSpeechTimer();
      cleanup();
    };
  }, [initializeWebSocket, cleanup]);

  // Get status display info
  const getStatusDisplay = () => {
    if (processingStage === 'processing') {
      return { message: '🧠 Processing...', color: 'text-purple-400' };
    }
    if (processingStage === 'speaking') {
      return { message: '🔊 Speaking... (interrupt anytime)', color: 'text-orange-400' };
    }
    if (displayText && !displayText.startsWith('🔊') && !displayText.startsWith('🧠')) {
      return { message: '👂 Listening...', color: 'text-green-400' };
    }
    return { message: '🎤 Ready - speak naturally!', color: 'text-blue-400' };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="glass-morphism rounded-2xl p-8">
      {/* Connection Status */}
      <VoiceStatus
        connection={status.connection}
        stage={processingStage}
        audioBytesSent={voiceState.current.audioBytesSent}
      />

      {/* Real-time Transcript Display */}
      <VoiceDisplay
        displayText={displayText}
        stage={processingStage}
        speechLevel={voiceState.current.speechLevel}
        isListening={status.listening}
      />

      {/* Status Message */}
      <div className="text-center mb-4">
        <p className={`font-medium ${statusDisplay.color}`}>
          {statusDisplay.message}
        </p>
      </div>

      {/* Manual Controls */}
      <VoiceControls
        onRestart={restart}
        onStop={cleanup}
      />

      {/* Auto-processing countdown */}
      {voiceState.current.lastTranscript && !status.processing && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 text-sm">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Processing soon...
          </div>
        </div>
      )}
    </div>
  );
}