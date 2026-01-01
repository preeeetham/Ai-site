import { useState, useEffect } from 'react';
import { ChevronLeft, Edit, MessageSquare, Copy } from 'lucide-react';
import PromptInput from '../Homepage/PromptInput';

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  messages?: Message[];
  onSendPrompt?: (prompt: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ChatPanel({
  messages = [],
  onSendPrompt,
  isLoading = false,
  disabled = false,
}: ChatPanelProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (prompt.trim() && onSendPrompt && !disabled && !isLoading) {
      onSendPrompt(prompt.trim());
      setPrompt('');
    }
  };

  // Debug: Log messages prop changes
  useEffect(() => {
    console.log('ChatPanel render - messages prop:', messages.length, messages);
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-2 ${
              message.type === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>
                {message.timestamp.toLocaleDateString()} at{' '}
                {message.timestamp.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              {message.type === 'user' && (
                <button
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copy message"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200" />

      {/* Chat Input Area */}
      <div className="p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <button
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            title="Visual edits"
          >
            <Edit className="w-4 h-4" />
            <span>Visual edits</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Toggle chat mode"
            >
              <MessageSquare className="w-4 h-4 text-gray-600" />
            </button>
            <button
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Chat mode"
            >
              <span className="text-sm font-medium text-gray-700">Chat</span>
            </button>
          </div>
        </div>

        <PromptInput
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onSubmit={handleSubmit}
          placeholder="Ask Lovable..."
          disabled={disabled || isLoading}
        />
      </div>
    </div>
  );
}

