import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Reply, Sparkles } from 'lucide-react';
import { emailsApi, summaryApi, composeApi } from '../services/api';
import { useState } from 'react';
import { Email } from '../types';

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [replyInstruction, setReplyInstruction] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread', id],
    queryFn: async () => {
      const res = await emailsApi.getThread(id!);
      return res.data.thread;
    },
    enabled: !!id,
  });

  const { data: summary } = useQuery({
    queryKey: ['thread-summary', id],
    queryFn: async () => {
      const res = await summaryApi.thread(id!);
      return res.data.summary;
    },
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: (instruction: string) =>
      composeApi.reply({ threadId: id, instruction }),
    onSuccess: (res) => setDraft(res.data.draft),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!thread) return <p>Thread not found</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/inbox" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Inbox
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">{thread.subject || '(No subject)'}</h1>
        <p className="mt-1 text-sm text-gray-500">{thread.message_count} messages</p>

        {summary && (
          <div className="mt-4 rounded-lg bg-primary-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Sparkles className="h-4 w-4" /> Thread Summary
            </div>
            <p className="mt-2 text-sm text-primary-900">
  {typeof summary === "string"
    ? summary
    : summary?.summary ?? ""}
</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {(thread.emails as Email[] ?? []).map((email) => (
          <div key={email.id} className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{email.from_name || email.from_email}</p>
                <p className="text-xs text-gray-400">
                  {email.received_at ? new Date(email.received_at).toLocaleString() : ''}
                </p>
              </div>
              <Link to={`/emails/${email.id}`} className="text-xs text-primary-600 hover:underline">
                View details
              </Link>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
              {email.body_text || email.snippet || 'No content'}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Reply className="h-4 w-4" /> AI Reply
        </h3>
        <textarea
          value={replyInstruction}
          onChange={(e) => setReplyInstruction(e.target.value)}
          placeholder="e.g., Politely decline the meeting and suggest next week"
          className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          rows={3}
        />
        <button
          onClick={() => replyMutation.mutate(replyInstruction)}
          disabled={!replyInstruction || replyMutation.isPending}
          className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {replyMutation.isPending ? 'Generating...' : 'Generate Reply'}
        </button>

        {draft && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Subject: {draft.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{draft.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
