import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, Volume2, Sparkles, User, HelpCircle } from 'lucide-react';
import type { Message } from '../types';

interface MessageItemProps {
  message: Message;
  ttsEnabled?: boolean;
  onSendFollowUp?: (text: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onSendFollowUp
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Clean markdown tags for speech synthesis
      const cleanText = message.content.replace(/[`*#$]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Generate dynamic follow-up context suggestions for assistant responses
  const getFollowUpSuggestions = (content: string) => {
    if (isUser) return [];
    const text = content.toLowerCase();
    if (text.includes('code') || text.includes('python') || text.includes('function')) {
      return ["Explain this line by line", "Give me a practice exercise on this", "What is the time complexity?"];
    }
    if (text.includes('math') || text.includes('formula') || text.includes('equation')) {
      return ["Show another step-by-step example", "What are the common pitfalls?", "Generate a practice quiz on this"];
    }
    return ["Can you explain this with a real-world analogy?", "Summarize into 3 key bullet points", "Create a quiz on this topic"];
  };

  const suggestions = getFollowUpSuggestions(message.content);

  return (
    <div className={`py-4 px-4 sm:px-6 flex gap-3 sm:gap-4 transition-colors ${
      isUser ? 'bg-slate-900' : 'bg-slate-950/60 border-y border-slate-800/40'
    }`}>
      {/* Avatar */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-300">
            {isUser ? 'You' : 'EduMate AI'}
          </div>

          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleSpeak}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCopy}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Content Box */}
        <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed overflow-hidden">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeHighlight]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950">
                    <div className="px-4 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[11px] text-violet-400">{match[1]}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                        className="flex items-center gap-1 text-[11px] hover:text-slate-200"
                      >
                        <Copy className="w-3 h-3" /> Copy Code
                      </button>
                    </div>
                    <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 leading-normal">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-300 font-mono text-xs" {...props}>
                    {children}
                  </code>
                );
              },
              table({ children }: any) {
                return (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full divide-y divide-slate-800 text-xs text-slate-300 border border-slate-800">
                      {children}
                    </table>
                  </div>
                );
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Follow-up Suggestion Chips for Assistant */}
        {!isUser && suggestions.length > 0 && onSendFollowUp && (
          <div className="pt-2 flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSendFollowUp(s)}
                className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-violet-900/40 text-xs text-slate-300 hover:text-violet-200 border border-slate-700 hover:border-violet-500/40 transition-colors flex items-center gap-1.5"
              >
                <HelpCircle className="w-3 h-3 text-violet-400" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
