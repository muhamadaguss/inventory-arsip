'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface SearchBarProps {
  onSearch: (transcript: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const { isSupported, isListening, transcript, resultSequence, start } =
    useSpeechRecognition();
  const [textValue, setTextValue] = useState('');
  const lastSubmittedSequence = useRef(0);

  useEffect(() => {
    if (transcript && resultSequence !== lastSubmittedSequence.current) {
      lastSubmittedSequence.current = resultSequence;
      onSearch(transcript);
    }
  }, [transcript, resultSequence, onSearch]);

  function handleTextSubmit(event: FormEvent) {
    event.preventDefault();
    if (textValue.trim()) {
      onSearch(textValue.trim());
    }
  }

  if (isSupported) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={isListening}
        className="rounded-full bg-blue-700 text-white w-20 h-20 flex items-center justify-center text-sm font-semibold fixed bottom-8 left-1/2 -translate-x-1/2 md:static md:translate-x-0"
      >
        {isListening ? 'Mendengarkan...' : 'Mulai Bicara'}
      </button>
    );
  }

  return (
    <form onSubmit={handleTextSubmit} className="w-full max-w-md">
      <label htmlFor="text-search" className="block text-sm font-medium mb-1">
        Cari Arsip
      </label>
      <input
        id="text-search"
        type="text"
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        className="w-full rounded border px-3 py-2"
        placeholder="cari perkara pidana nomor 45 tahun 2026 atas nama ahmad"
      />
    </form>
  );
}
