import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Bot, User } from 'lucide-react';
import { chatApi } from '../services/api';
import CitationCard from '../components/CitationCard';
import { ChatMessage, ChatCitation } from '../types';

const SUGGESTIONS = [
  'Summarize today\'s emails',
  'Show unread emails',
  'What was discussed about projects this week?',
  'Which companies rejected my applications?',
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: (message: string) => chatApi.send({ message, sessionId }),
    onSuccess: (res) => {
      setSessionId(res.data.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          citations: res.data.citations as ChatCitation[],
        },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    chatMutation.mutate(text);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-gray-500">Ask questions about your emails — answers include citations</p>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="h-12 w-12 text-primary-300" />
            <p className="mt-4 text-gray-500">Ask me anything about your emails</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <Bot className="h-4 w-4 text-primary-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && <CitationCard citations={msg.citations} />}
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <Bot className="h-4 w-4 text-primary-600" />
              </div>
              <div className="rounded-xl bg-gray-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your emails..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="rounded-lg bg-primary-600 px-4 py-3 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
