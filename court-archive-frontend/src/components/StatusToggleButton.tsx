'use client';

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
  const nextStatus = currentStatus === 'Available' ? 'Borrowed' : 'Available';
  const label = nextStatus === 'Borrowed' ? 'Tandai Dipinjam' : 'Tandai Tersedia';

  async function handleClick() {
    await patch(`/archive/cases/${caseId}/status`, { status: nextStatus }, token);
    onToggled(nextStatus);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded bg-white/20 px-4 py-2 font-semibold text-white"
    >
      {label}
    </button>
  );
}
