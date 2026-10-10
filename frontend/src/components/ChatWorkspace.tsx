import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Paperclip, Mic, MicOff, Globe, Sparkles, 
  BookOpen, Code, Calculator, FileText, X 
} from 'lucide-react';
import type { Message, DocumentItem } from '../types';
import { MessageItem } from './MessageItem';

interface ChatWorkspaceProps {
  messages: Message[];
  isLoading: boolean;
  mode: string;
  activeDocument: DocumentItem | null;
  chatError?: string | null;
  onSendMessage: (content: string, options?: { documentId?: string; webSearch?: boolean }) => void;
  onClearActiveDocument: () => void;
  onOpenDocumentModal: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  isLoading,
  mode,
  activeDocument,
  chatError,
  onSendMessage,
  onClearActiveDocument,
  onOpenDocumentModal,
}) => {
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Web Speech API initialization
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim(), {
      documentId: activeDocument?.id,
      webSearch
    });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePresetClick = (presetText: string) => {
    setInput(presetText);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-900 relative overflow-hidden">
      {chatError && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          {chatError}
        </div>
      )}

      {/* Messages Stream / Hero Empty State */}
      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-violet-600/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-100">
                What would you like to learn today?
              </h2>
              <p className="text-sm text-slate-400">
                EduMate AI remembers your context across turns and adapts to your academic level.
              </p>
            </div>

            {/* Quick Start Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-2">
              <button
                onClick={() => handlePresetClick("Explain how neural networks process data with an intuitive analogy.")}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-xs space-y-1 group"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-2 group-hover:text-violet-300">
                  <BookOpen className="w-4 h-4 text-violet-400" />
                  <span>Learn a Concept</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  "Explain how neural networks process data with an intuitive analogy."
                </p>
              </button>

              <button
                onClick={() => handlePresetClick("Debug this Python code and analyze its time & space complexity:")}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-xs space-y-1 group"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-2 group-hover:text-violet-300">
                  <Code className="w-4 h-4 text-violet-400" />
                  <span>Coding Tutor</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  "Debug this Python code and analyze its time & space complexity..."
                </p>
              </button>

              <button
                onClick={() => handlePresetClick("Solve this derivative step by step with LaTeX formatting: d/dx (x^3 * sin(x))")}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-xs space-y-1 group"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-2 group-hover:text-violet-300">
                  <Calculator className="w-4 h-4 text-violet-400" />
                  <span>Math Solver</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  "Solve this derivative step by step: d/dx (x^3 * sin(x))"
                </p>
              </button>

              <button
                onClick={() => handlePresetClick("Give me 5 practice exam questions on Data Structures & Algorithms.")}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-xs space-y-1 group"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-2 group-hover:text-violet-300">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span>Exam Practice</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  "Give me 5 practice exam questions on Data Structures & Algorithms."
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                ttsEnabled={false}
                onSendFollowUp={(text) => onSendMessage(text)}
              />
            ))}

            {/* Loading Pulse State */}
            {isLoading && (
              <div className="p-4 bg-slate-950/60 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="font-medium text-violet-300">EduMate AI is thinking...</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Section */}
      <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto space-y-2">
          
          {/* Active Document / Search Attachment Badge */}
          {activeDocument && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-violet-950/60 border border-violet-500/40 text-xs text-violet-300">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="truncate">Active Context: <strong>{activeDocument.filename}</strong></span>
              </div>
              <button onClick={onClearActiveDocument} className="p-0.5 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Input Box */}
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-violet-500/60 shadow-lg transition-colors p-2 flex flex-col gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask EduMate AI anything in ${mode} mode...`}
              rows={2}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none px-2"
            />

            {/* Bottom Toolbar Controls */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenDocumentModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs flex items-center gap-1"
                  title="Attach document/notes for Q&A"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="hidden sm:inline">Attach Doc</span>
                </button>

                <button
                  onClick={toggleListening}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                    isListening ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Voice input speech to text"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice Input'}</span>
                </button>

                <button
                  onClick={() => setWebSearch(!webSearch)}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                    webSearch ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Toggle Web Search context"
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">Search Web</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="py-1.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-violet-600/30 transition-all active:scale-95"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
