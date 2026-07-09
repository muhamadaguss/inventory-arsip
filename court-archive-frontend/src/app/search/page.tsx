'use client';

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SearchBar } from '@/components/SearchBar';
import { post } from '@/lib/apiClient';
import { searchStart, searchSuccess, searchFailure } from '@/store/searchSlice';
import type { SearchResponse } from '@/store/searchSlice';
import type { RootState } from '@/store/store';

export default function SearchPage() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);

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
      </main>
    </ProtectedRoute>
  );
}
