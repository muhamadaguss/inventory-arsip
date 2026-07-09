'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string) => {
    const w = window as unknown as {
      speechSynthesis?: { speak: (u: unknown) => void; cancel: () => void };
      SpeechSynthesisUtterance?: new (text: string) => { lang: string };
    };
    if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) {
      return;
    }

    const utterance = new w.SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    w.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, []);

  const stop = useCallback(() => {
    const w = window as unknown as { speechSynthesis?: { cancel: () => void } };
    w.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSupported, isSpeaking, speak, stop };
}
