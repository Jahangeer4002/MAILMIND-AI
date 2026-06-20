import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, LogOut, RefreshCw } from 'lucide-react';
import { authApi, gmailApi } from '../services/api';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await gmailApi.status();
      return res.data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => gmailApi.sync(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setUser(null);
      navigate('/login');
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-6 w-6" /> Settings
        </h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Account</h2>
        {user && (
          <div className="flex items-center gap-4">
            {user.picture && <img src={user.picture} alt="" className="h-12 w-12 rounded-full" />}
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Gmail Sync</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Status: <strong>{syncStatus?.syncStatus ?? 'Unknown'}</strong></p>
          <p>
            Last sync:{' '}
            {syncStatus?.lastSyncAt
              ? new Date(syncStatus.lastSyncAt).toLocaleString()
              : 'Never'}
          </p>
          <p>Total emails: {syncStatus?.stats?.totalEmails ?? 0}</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <button
        onClick={() => logoutMutation.mutate()}
        className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" /> Log Out
      </button>
    </div>
  );
}
