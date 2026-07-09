'use client';

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ResultCard } from '@/components/ResultCard';
import { SearchBar } from '@/components/SearchBar';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { post } from '@/lib/apiClient';
import { searchStart, searchSuccess, searchFailure } from '@/store/searchSlice';
import type { SearchResponse } from '@/store/searchSlice';
import type { RootState } from '@/store/store';

export default function SearchPage() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const results = useSelector((state: RootState) => state.search.results);
  const ttsPayload = useSelector((state: RootState) => state.search.ttsPayload);
  const { isSupported: ttsSupported, isSpeaking, speak, stop } = useSpeechSynthesis();

  useEffect(() => {
    if (ttsPayload && ttsSupported) {
      speak(ttsPayload);
    }
  }, [ttsPayload, ttsSupported, speak]);

  const handleSearch = useCallback(
    async (transcript: string) => {
      dispatch(searchStart());
      try {
        const result = await post<SearchResponse>(
          '/archive/search',
          { raw_transcript: transcript },
          token,
        );
        dispatch(searchSuccess(result));
      } catch (err) {
        dispatch(searchFailure(err instanceof Error ? err.message : 'Pencarian gagal'));
      }
    },
    [dispatch, token],
  );

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center p-6 gap-8">
        <h1 className="text-2xl font-bold">Cari Arsip</h1>
        <SearchBar onSearch={handleSearch} />
        <div className="flex flex-col items-center gap-4 w-full">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
        {isSpeaking && (
          <button
            type="button"
            onClick={stop}
            className="rounded bg-gray-700 text-white px-4 py-2 font-semibold"
          >
            Hentikan Suara
          </button>
        )}
      </main>
    </ProtectedRoute>
  );
}
