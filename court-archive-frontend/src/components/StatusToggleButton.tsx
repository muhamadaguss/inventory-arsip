'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { patch } from '@/lib/apiClient';
import type { RootState } from '@/store/store';

interface StatusToggleButtonProps {
  caseId: number;
  currentStatus: 'Available' | 'Borrowed';
  onToggled: (newStatus: 'Available' | 'Borrowed') => void;
}

export function StatusToggleButton({
  caseId,
  currentStatus,
  onToggled,
}: StatusToggleButtonProps) {
  const token = useSelector((state: RootState) => state.auth.token);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = currentStatus === 'Available' ? 'Borrowed' : 'Available';
  const label = nextStatus === 'Borrowed' ? 'Tandai Dipinjam' : 'Tandai Tersedia';

  async function handleClick() {
    setError(null);
    try {
      await patch(`/archive/cases/${caseId}/status`, { status: nextStatus }, token);
      onToggled(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="rounded bg-white/20 px-4 py-2 font-semibold text-white"
      >
        {label}
      </button>
      {error && <p className="text-sm text-red-200">{error}</p>}
    </div>
  );
}
