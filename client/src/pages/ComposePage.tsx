import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PenSquare, Send } from 'lucide-react';
import { composeApi } from '../services/api';

export default function ComposePage() {
  const [prompt, setPrompt] = useState('');
  const [to, setTo] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string; closing: string } | null>(null);
  const [editedBody, setEditedBody] = useState('');

  const composeMutation = useMutation({
    mutationFn: (data: { prompt: string }) => composeApi.compose(data),
    onSuccess: (res) => {
      setDraft(res.data.draft);
      setEditedBody(`${res.data.draft.body}\n\n${res.data.draft.closing}`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      composeApi.compose({
        prompt,
        to,
        send: true,
      }),
    onSuccess: () => {
      setDraft(null);
      setEditedBody('');
      setPrompt('');
      setTo('');
      alert('Email sent successfully!');
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <PenSquare className="h-6 w-6" /> AI Compose
        </h1>
        <p className="text-gray-500">Describe what you want to write and AI will draft it for you</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g., "Write a follow-up to product team about Q3 launch delay."'
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            rows={4}
          />
        </div>

        <button
          onClick={() => composeMutation.mutate({ prompt })}
          disabled={!prompt || composeMutation.isPending}
          className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {composeMutation.isPending ? 'Generating...' : 'Generate Draft'}
        </button>
      </div>

      {draft && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Generated Draft</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={draft.subject}
              readOnly
              className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Body (editable)</label>
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!to || sendMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? 'Sending...' : 'Send Email'}
            </button>
            <button
              onClick={() => { setDraft(null); setEditedBody(''); }}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
