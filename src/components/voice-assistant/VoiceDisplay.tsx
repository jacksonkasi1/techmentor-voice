interface VoiceDisplayProps {
  displayText: string;
  stage: 'idle' | 'listening' | 'processing' | 'speaking';
  speechLevel: number;
  isListening: boolean;
}

export function VoiceDisplay({ displayText, stage, speechLevel, isListening }: VoiceDisplayProps) {
  const getStatusMessage = () => {
    switch (stage) {
      case 'processing': return '🧠 Processing...';
      case 'speaking': return '🔊 Speaking...';
      case 'listening': return '👂 Listening...';
      default: return '🎤 Ready - speak naturally!';
    }
  };

  return (
    <div className="mb-6 min-h-[80px]">
      <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
        {displayText ? (
          <p className="text-white text-lg">{displayText}</p>
        ) : (
          <p className="text-gray-400 italic">{getStatusMessage()}</p>
        )}
        
        {isListening && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Voice:</span>
              <div className="flex-1 bg-slate-600 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-100 ${
                    speechLevel > 0.01 ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min(100, speechLevel * 1000)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {(speechLevel * 1000).toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}