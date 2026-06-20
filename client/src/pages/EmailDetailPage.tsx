import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { emailsApi, summaryApi } from '../services/api';

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', id],
    queryFn: async () => {
      const res = await emailsApi.get(id!);
      return res.data.email;
    },
    enabled: !!id,
  });

  const { data: summary } = useQuery({
    queryKey: ['email-summary', id],
    queryFn: async () => {
      const res = await summaryApi.email(id!);
      return res.data.summary;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!email) return <p>Email not found</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/inbox" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Inbox
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">{email.subject || '(No subject)'}</h1>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>From: <strong className="text-gray-700">{email.from_name || email.from_email}</strong></span>
          <span>{email.received_at ? new Date(email.received_at).toLocaleString() : ''}</span>
        </div>

        {email.email_categories?.length > 0 && (
          <div className="mt-3 flex gap-2">
            {email.email_categories.map((c: { category: string }) => (
              <span key={c.category} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                {c.category}
              </span>
            ))}
          </div>
        )}

        {(summary?.summary || email.email_summaries?.summary) && (
          <div className="mt-4 rounded-lg bg-primary-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Sparkles className="h-4 w-4" /> AI Summary
            </div>
            <p className="mt-2 text-sm text-primary-900">
              {summary?.summary || email.email_summaries?.summary}
            </p>
            {(summary?.action_items ?? summary?.actionItems)?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-primary-600">Action Items:</p>
                <ul className="mt-1 list-inside list-disc text-sm text-primary-800">
                  {(summary?.action_items ?? summary?.actionItems).map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {email.body_text || email.snippet || 'No content available'}
        </div>

        {email.thread_id && (
          <Link
            to={`/threads/${email.thread_id}`}
            className="mt-4 inline-block text-sm text-primary-600 hover:underline"
          >
            View full thread
          </Link>
        )}
      </div>
    </div>
  );
}
