import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { emailsApi, categoriesApi } from '../services/api';
import { useUIStore } from '../store';
import EmailListItem from '../components/EmailListItem';
import { Email } from '../types';

export default function InboxPage() {
  const [page, setPage] = useState(1);
  const selectedCategory = useUIStore((s) => s.selectedCategory);
  const setCategory = useUIStore((s) => s.setCategory);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearch = useUIStore((s) => s.setSearch);
  const [localSearch, setLocalSearch] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.list();
      return res.data.categories;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['emails', page, selectedCategory, searchQuery],
    queryFn: async () => {
      const res = await emailsApi.list({
        page,
        limit: 20,
        category: selectedCategory ?? undefined,
        search: searchQuery || undefined,
      });
      return res.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(localSearch);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-gray-500">Browse and search your synced emails</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setCategory(null); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !selectedCategory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {(categories ?? []).map((cat: { name: string; count: number }) => (
            <button
              key={cat.name}
              onClick={() => { setCategory(cat.name); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedCategory === cat.name
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {(data?.data as Email[] ?? []).map((email) => (
              <EmailListItem key={email.id} email={email} />
            ))}
          </div>

          {data?.hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
