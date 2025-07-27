'use client';
import { useState } from 'react';
import { MessageCircle, User, Bot, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface Conversation {
  id: string;
  timestamp: Date;
  userInput: string;
  aiResponse: string;
  context?: string;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  isProcessing: boolean;
}

export default function ConversationHistory({ conversations, isProcessing }: ConversationHistoryProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showContext, setShowContext] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const toggleContext = (id: string) => {
    const newShowContext = new Set(showContext);
    if (newShowContext.has(id)) {
      newShowContext.delete(id);
    } else {
      newShowContext.add(id);
    }
    setShowContext(newShowContext);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-6 w-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-white">Conversation History</h2>
        <span className="px-2 py-1 bg-purple-600 text-white text-sm rounded-full">
          {conversations.length}
        </span>
      </div>

      <div className="space-y-4">
        {conversations.map((conversation) => {
          const isExpanded = expandedItems.has(conversation.id);
          const showCtx = showContext.has(conversation.id);
          
          return (
            <div key={conversation.id} className="glass-morphism rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-400 font-mono">
                      {formatTime(conversation.timestamp)}
                    </span>
                    {conversation.context && (
                      <button
                        onClick={() => toggleContext(conversation.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full hover:bg-blue-600/30 transition-colors backdrop-blur-xs"
                      >
                        <FileText className="h-3 w-3" />
                        Context
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => toggleExpanded(conversation.id)}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-600/50"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* User Input */}
              <div className="conversation-bubble user">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-600 rounded-full shadow-lg">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-blue-400 font-medium mb-1">You asked:</div>
                    <div className="text-white leading-relaxed">
                      {isExpanded ? conversation.userInput : truncateText(conversation.userInput)}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Response */}
              <div className="conversation-bubble assistant">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-600 rounded-full shadow-lg">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-purple-400 font-medium mb-1">TechMentor:</div>
                    <div className="text-gray-200 leading-relaxed">
                      {isExpanded ? (
                        <div className="whitespace-pre-wrap">{conversation.aiResponse}</div>
                      ) : (
                        truncateText(conversation.aiResponse, 200)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Context Information */}
              {conversation.context && showCtx && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-700/50">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-600 rounded-full shadow-lg">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-green-400 font-medium mb-1">Context from MCP:</div>
                      <div className="text-gray-300 text-sm leading-relaxed">
                        <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-800 p-3 rounded border border-slate-600 overflow-x-auto backdrop-blur-xs">
                          {conversation.context}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Expand prompt */}
              {!isExpanded && (conversation.userInput.length > 150 || conversation.aiResponse.length > 200) && (
                <div className="p-3 bg-slate-700/20 border-t border-slate-700/50">
                  <button
                    onClick={() => toggleExpanded(conversation.id)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Click to expand full conversation...
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="glass-morphism rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-full animate-pulse-custom shadow-lg">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-purple-400 font-medium mb-1">TechMentor:</div>
                <div className="text-gray-400 italic">Processing your request...</div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {conversations.length === 0 && !isProcessing && (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No conversations yet</p>
            <p className="text-gray-500">Start by asking a technical question!</p>
          </div>
        )}
      </div>
    </div>
  );
}