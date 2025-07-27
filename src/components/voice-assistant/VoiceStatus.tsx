interface VoiceStatusProps {
  connection: 'connected' | 'connecting' | 'disconnected';
  stage: 'idle' | 'listening' | 'processing' | 'speaking';
  audioBytesSent: number;
}

export function VoiceStatus({ connection, stage, audioBytesSent }: VoiceStatusProps) {
  const getStatusColor = () => {
    switch (stage) {
      case 'processing': return 'text-purple-400';
      case 'speaking': return 'text-orange-400';
      case 'listening': return 'text-green-400';
      default: return 'text-blue-400';
    }
  };

  const getStatusMessage = () => {
    switch (stage) {
      case 'processing': return '🧠 Processing...';
      case 'speaking': return '🔊 Speaking...';
      case 'listening': return '👂 Listening...';
      default: return '🎤 Ready - speak naturally!';
    }
  };

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          connection === 'connected' ? 'bg-green-500' : 
          connection === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        <span className="text-sm text-gray-300">
          {connection === 'connected' ? '🟢 Live' : '🔴 Connecting...'}
        </span>
      </div>
      
      <div className="text-sm text-gray-400">
        Audio: {Math.round(audioBytesSent / 1024)}KB sent
      </div>
    </div>
  );
}