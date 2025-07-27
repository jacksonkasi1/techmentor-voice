'use client';
import { useState } from 'react';
import VoiceAssistant from '@/components/voice-assistant/VoiceAssistant';

interface Conversation {
  id: string;
  userInput: string;
  aiResponse: string;
  context?: any;
  timestamp: Date;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConversation = (userInput: string, aiResponse: string, context?: any) => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      userInput,
      aiResponse,
      context,
      timestamp: new Date()
    };
    
    setConversations(prev => [newConversation, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              TechMentor Voice Assistant
            </h1>
            <p className="text-gray-300">
              Ask me about any technology, framework, or programming concept
            </p>
          </div>

          {/* Voice Assistant */}
          <div className="mb-8">
            <VoiceAssistant
              onConversation={handleConversation}
              onProcessingChange={setIsProcessing}
            />
          </div>

          {/* Conversation History */}
          {conversations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Recent Conversations
              </h2>
              
              {conversations.map((conv) => (
                <div key={conv.id} className="glass-morphism rounded-lg p-6">
                  {/* User Question */}
                  <div className="mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        You
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{conv.userInput}</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {conv.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="border-l-2 border-purple-500 pl-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        AI
                      </div>
                      <div className="flex-1">
                        <div className="prose prose-invert max-w-none">
                          <p className="text-gray-100 whitespace-pre-wrap">
                            {conv.aiResponse}
                          </p>
                        </div>
                        
                        {/* Context Information */}
                        {conv.context?.libraries?.length > 0 && (
                          <div className="mt-3 p-3 bg-slate-700/50 rounded border border-slate-600">
                            <p className="text-sm text-gray-300">
                              📚 Sources: {conv.context.libraries.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="fixed bottom-4 right-4 glass-morphism rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Processing your question...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}