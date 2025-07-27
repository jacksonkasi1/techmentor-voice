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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12 animate-fadeIn">
          {/* Title Section */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Brain className="h-10 w-10 text-purple-400 animate-pulse" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              TechMentor Voice
            </h1>
            <Zap className="h-10 w-10 text-yellow-400 animate-bounce" />
          </div>
          
          {/* Description */}
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-xl text-gray-200 leading-relaxed font-light">
              Real-time voice assistant powered by AssemblyAI Universal-Streaming, 
              Context7 MCP, and Gemini 2.0 Flash. Ask anything about documentation!
            </p>
          </div>
          
          {/* Tech Stack Badges - Better Alignment */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl mx-auto">
            <span className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-medium rounded-full backdrop-blur-sm border border-blue-500/30 transition-all duration-200">
              Universal-Streaming
            </span>
            <span className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white text-sm font-medium rounded-full backdrop-blur-sm border border-green-500/30 transition-all duration-200">
              Context7 MCP
            </span>
            <span className="px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-sm font-medium rounded-full backdrop-blur-sm border border-purple-500/30 transition-all duration-200">
              Gemini 2.0 Flash
            </span>
            <span className="px-4 py-2 bg-orange-600/80 hover:bg-orange-600 text-white text-sm font-medium rounded-full backdrop-blur-sm border border-orange-500/30 transition-all duration-200">
              ElevenLabs TTS
            </span>
          </div>
        </div>

        {/* Main Voice Interface - Centered */}
        <div className="max-w-4xl mx-auto animate-slideUp">
          <div className="mb-8">
            <VoiceAssistant 
              onConversation={handleNewConversation}
              onProcessingChange={setIsProcessing}
            />
          </div>
          
          {/* Sample Queries - Improved Grid */}
          <div className="mb-8 p-8 glass-morphism rounded-3xl border border-slate-600/30">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                <FileText className="h-6 w-6 text-blue-400" />
                Try asking:
              </h3>
              <p className="text-gray-400 text-sm">Click on any example below or speak directly</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              <div className="group p-4 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl border border-slate-600/40 hover:border-slate-500/60 backdrop-blur-sm transition-all duration-300 cursor-pointer">
                <p className="text-gray-200 group-hover:text-white transition-colors duration-200 text-center">
                  {`"How do I set up authentication in Next.js 14?"`}
                </p>
              </div>
              <div className="group p-4 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl border border-slate-600/40 hover:border-slate-500/60 backdrop-blur-sm transition-all duration-300 cursor-pointer">
                <p className="text-gray-200 group-hover:text-white transition-colors duration-200 text-center">
                  {`"Show me TypeScript interfaces for React hooks"`}
                </p>
              </div>
              <div className="group p-4 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl border border-slate-600/40 hover:border-slate-500/60 backdrop-blur-sm transition-all duration-300 cursor-pointer">
                <p className="text-gray-200 group-hover:text-white transition-colors duration-200 text-center">
                  {`"Explain Cloudflare Workers deployment"`}
                </p>
              </div>
              <div className="group p-4 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl border border-slate-600/40 hover:border-slate-500/60 backdrop-blur-sm transition-all duration-300 cursor-pointer">
                <p className="text-gray-200 group-hover:text-white transition-colors duration-200 text-center">
                  {`"What's new in Python 3.12?"`}
                </p>
              </div>
            </div>
          </div>

          {/* Conversation History */}
          {conversations.length > 0 && (
            <div className="animate-fadeIn">
              <ConversationHistory 
                conversations={conversations}
                isProcessing={isProcessing}
              />
            </div>
          )}
        </div>

        {/* Footer - Better Spacing */}
        <div className="text-center mt-16 pt-8 border-t border-slate-700/50">
          <p className="text-gray-400 text-sm">
            Built for AssemblyAI Voice Agents Challenge • Powered by Universal-Streaming
          </p>
        </div>
      </div>
    </main>
  );
}
