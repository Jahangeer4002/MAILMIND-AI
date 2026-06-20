import { Link } from 'react-router-dom';
import { Email } from '../types';

interface EmailListItemProps {
  email: Email;
}

const categoryColors: Record<string, string> = {
  Newsletter: 'bg-purple-100 text-purple-700',
  'Job / Recruitment': 'bg-blue-100 text-blue-700',
  Finance: 'bg-green-100 text-green-700',
  Notifications: 'bg-yellow-100 text-yellow-700',
  Personal: 'bg-pink-100 text-pink-700',
  'Work / Professional': 'bg-indigo-100 text-indigo-700',
};

export default function EmailListItem({ email }: EmailListItemProps) {
  const category = email.email_categories?.[0]?.category;

  return (
    <Link
      to={`/emails/${email.id}`}
      className={`block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md ${
        email.is_unread ? 'border-l-4 border-l-primary-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${email.is_unread ? 'text-gray-900' : 'text-gray-700'}`}>
              {email.from_name || email.from_email || 'Unknown'}
            </span>
            {category && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[category] ?? 'bg-gray-100 text-gray-600'}`}>
                {category}
              </span>
            )}
          </div>
          <p className={`mt-0.5 truncate text-sm ${email.is_unread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
            {email.subject || '(No subject)'}
          </p>
          <p className="mt-1 truncate text-xs text-gray-400">
            {email.email_summaries?.summary || email.snippet}
          </p>
        </div>
        <span className="shrink-0 text-xs text-gray-400">
          {email.received_at
            ? new Date(email.received_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : ''}
        </span>
      </div>
    </Link>
  );
}
