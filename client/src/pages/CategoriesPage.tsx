import { useQuery } from '@tanstack/react-query';
import { Tags } from 'lucide-react';
import { categoriesApi, emailsApi } from '../services/api';
import EmailListItem from '../components/EmailListItem';
import { useState } from 'react';
import { Email } from '../types';

export default function CategoriesPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.list();
      return res.data.categories;
    },
  });

  const { data: emails, isLoading } = useQuery({
    queryKey: ['category-emails', selected],
    queryFn: async () => {
      const res = await emailsApi.list({ category: selected!, limit: 20 });
      return res.data.data as Email[];
    },
    enabled: !!selected,
  });
  console.log(emails);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Tags className="h-6 w-6" /> Categories
        </h1>
        <p className="text-gray-500">Emails automatically classified by AI</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(categories ?? []).map((cat: { name: string; count: number }) => (
          <button
            key={cat.name}
            onClick={() => setSelected(cat.name)}
            className={`rounded-xl border p-5 text-left transition-shadow hover:shadow-md ${
              selected === cat.name
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <p className="font-semibold text-gray-900">{cat.name}</p>
            <p className="mt-1 text-2xl font-bold text-primary-600">{cat.count}</p>
            <p className="mt-1 text-xs text-gray-400">emails</p>
          </button>
        ))}
      </div>

      {selected && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{selected} Emails</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {(emails ?? []).map((email) => (
                <EmailListItem key={email.id} email={email} />
              ))}
              {(emails ?? []).length === 0 && (
                <p className="text-center text-sm text-gray-400">No emails in this category</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
