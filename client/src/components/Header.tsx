import { Menu, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useUIStore } from '../store';
import { gmailApi } from '../services/api';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: () => gmailApi.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-4">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync Gmail'}
        </button>

        {user && (
          <div className="flex items-center gap-2">
            {user.picture && (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
            )}
            <span className="text-sm font-medium text-gray-700">{user.name || user.email}</span>
          </div>
        )}
      </div>
    </header>
  );
}
