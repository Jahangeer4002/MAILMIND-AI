import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { newsletterApi } from '../services/api';
import { NewsStory } from '../types';

export default function NewsDigestPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['news-digest'],
    queryFn: async () => {
      const res = await newsletterApi.digest(7);
      return res.data.digest;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Newspaper className="h-6 w-6" /> News Digest
          </h1>
          <p className="text-gray-500">Deduplicated newsletter stories from the past 7 days</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isFetching ? 'Generating...' : 'Refresh Digest'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{data?.totalNewsletters ?? 0} newsletters scanned</span>
            <span>{data?.uniqueStories ?? 0} unique stories</span>
          </div>

          <div className="space-y-4">
            {(data?.stories as NewsStory[] ?? []).map((story, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{story.story}</h3>
                <p className="mt-2 text-sm text-gray-600">{story.summary}</p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500">Sources:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {story.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {(data?.stories ?? []).length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                No newsletter stories found. Sync your Gmail and ensure newsletter emails are categorized.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
