'use client';
import { useState } from 'react';
import VoiceAssistant from '@/components/VoiceAssistant';
import ConversationHistory from '@/components/ConversationHistory';
import { Brain, FileText, Zap } from 'lucide-react'; 

interface Conversation {
  id: string;
  timestamp: Date;
  userInput: string;
  aiResponse: string;
  context?: string;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNewConversation = (userInput: string, aiResponse: string, context?: string) => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      timestamp: new Date(),
      userInput,
      aiResponse,
      context
    };
    setConversations(prev => [newConversation, ...prev]);
  };

  return (
    <main className="min-h-screen bg-gradient-voice">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-fadeIn">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">TechMentor Voice</h1>
            <Zap className="h-8 w-8 text-yellow-400" />
          </div>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Real-time voice assistant powered by AssemblyAI Universal-Streaming, 
            Context7 MCP, and Gemini 2.0 Flash. Ask anything about documentation!
          </p>
          
          {/* Tech Stack Badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full backdrop-blur-sm">Universal-Streaming</span>
            <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full backdrop-blur-sm">Context7 MCP</span>
            <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full backdrop-blur-sm">Gemini 2.0 Flash</span>
            <span className="px-3 py-1 bg-orange-600 text-white text-sm rounded-full backdrop-blur-sm">ElevenLabs TTS</span>
          </div>
        </div>

        {/* Main Voice Interface */}
        <div className="max-w-4xl mx-auto animate-slideUp">
          <VoiceAssistant 
            onConversation={handleNewConversation}
            onProcessingChange={setIsProcessing}
          />
          
          {/* Sample Queries */}
          <div className="mt-8 p-6 glass-morphism rounded-2xl">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" />
              Try asking:
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 backdrop-blur-xs">
                <p className="text-gray-300">{`"How do I set up authentication in Next.js 14?"`}</p>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 backdrop-blur-xs">
                <p className="text-gray-300">{`"Show me TypeScript interfaces for React hooks"`}</p>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 backdrop-blur-xs">
                <p className="text-gray-300">{`"Explain Cloudflare Workers deployment"`}</p>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 backdrop-blur-xs">
                <p className="text-gray-300">{`"What's new in Python 3.12?"`}</p>
              </div>
            </div>
          </div>

          {/* Conversation History */}
          {conversations.length > 0 && (
            <ConversationHistory 
              conversations={conversations}
              isProcessing={isProcessing}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p>Built for AssemblyAI Voice Agents Challenge • Powered by Universal-Streaming</p>
        </div>
      </div>
    </main>
  );
}
