import { Play, Square } from 'lucide-react';

interface VoiceControlsProps {
  onRestart: () => void;
  onStop: () => void;
}

export function VoiceControls({ onRestart, onStop }: VoiceControlsProps) {
  return (
    <div className="flex justify-center gap-2">
      <button
        onClick={onRestart}
        className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-sm hover:bg-blue-500/30 transition-colors"
      >
        <Play className="h-3 w-3 inline mr-1" />
        Restart
      </button>
      <button
        onClick={onStop}
        className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-sm hover:bg-red-500/30 transition-colors"
      >
        <Square className="h-3 w-3 inline mr-1" />
        Stop
      </button>
    </div>
  );
}