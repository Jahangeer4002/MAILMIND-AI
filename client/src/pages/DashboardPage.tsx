import { useQuery } from '@tanstack/react-query';
import { Mail, Inbox, MessageSquare, RefreshCw } from 'lucide-react';
import { gmailApi, emailsApi, categoriesApi } from '../services/api';
import StatCard from '../components/StatCard';
import EmailListItem from '../components/EmailListItem';
import { Email } from '../types';

export default function DashboardPage() {
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await gmailApi.status();
      return res.data;
    },
  });

  const { data: recentEmails } = useQuery({
    queryKey: ['dashboard', 'recent-emails'],
    queryFn: async () => {
      const res = await emailsApi.list({ limit: 5 });
      return res.data.data as Email[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.list();
      return res.data.categories;
    },
  });

  const stats = syncStatus?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your Gmail intelligence</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Emails"
          value={stats?.totalEmails ?? 0}
          icon={<Mail className="h-6 w-6" />}
        />
        <StatCard
          title="Unread"
          value={stats?.unreadEmails ?? 0}
          icon={<Inbox className="h-6 w-6" />}
        />
        <StatCard
          title="Threads"
          value={stats?.totalThreads ?? 0}
          icon={<MessageSquare className="h-6 w-6" />}
        />
        <StatCard
          title="Sync Status"
          value={syncStatus?.syncStatus ?? 'Unknown'}
          subtitle={
            syncStatus?.lastSyncAt
              ? `Last sync: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
              : 'Not synced yet'
          }
          icon={<RefreshCw className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Categories</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(categories ?? []).map((cat: { name: string; count: number }) => (
              <div
                key={cat.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Emails</h2>
          <div className="space-y-2">
            {(recentEmails ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                No emails yet. Click &quot;Sync Gmail&quot; to import your emails.
              </p>
            ) : (
              recentEmails?.map((email) => <EmailListItem key={email.id} email={email} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
