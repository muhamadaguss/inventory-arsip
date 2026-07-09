'use client';

import { useState } from 'react';
import type { CaseResult } from '@/store/searchSlice';
import { StatusToggleButton } from './StatusToggleButton';

interface ResultCardProps {
  result: CaseResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [status, setStatus] = useState(result.status);
  const bgClass = status === 'Available' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div
      data-testid="result-card"
      className={`${bgClass} text-white rounded-lg p-6 w-full max-w-xl flex flex-col gap-2`}
    >
      <p className="text-lg">
        Perkara {result.case_type} Nomor {result.case_number_raw} Tahun {result.year}
      </p>
      <p className="text-lg">{result.parties_involved}</p>
      {result.location ? (
        <>
          <p className="text-5xl md:text-6xl font-extrabold">{result.location.rack}</p>
          <p className="text-5xl md:text-6xl font-extrabold">
            {result.location.position ?? '-'}
          </p>
        </>
      ) : (
        <p className="text-2xl font-semibold">Lokasi rak belum ditentukan</p>
      )}
      <StatusToggleButton caseId={result.id} currentStatus={status} onToggled={setStatus} />
    </div>
  );
}
