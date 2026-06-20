import { ChatCitation } from '../types';
import { Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CitationCardProps {
  citations: ChatCitation[];
}

export default function CitationCard({ citations }: CitationCardProps) {
  if (!citations.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-gray-500">Sources:</p>
      {citations.map((c, i) => (
        <Link
          key={i}
          to={`/emails/${c.emailId}`}
          className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs hover:bg-gray-100"
        >
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-800">{c.subject}</p>
            <p className="text-gray-500">
              {c.sender} &middot;{' '}
              {c.date ? new Date(c.date).toLocaleDateString() : 'Unknown date'}
            </p>
            <p className="mt-0.5 truncate text-gray-400">{c.snippet}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
