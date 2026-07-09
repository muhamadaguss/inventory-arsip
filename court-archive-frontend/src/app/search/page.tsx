'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function SearchPage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center p-6">
        <h1 className="text-2xl font-bold">Cari Arsip</h1>
      </main>
    </ProtectedRoute>
  );
}
