'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  resultSequence: number;
  start: () => void;
  stop: () => void;
  _instance: SpeechRecognitionLike | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [resultSequence, setResultSequence] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setIsSupported(Boolean(RecognitionCtor));
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      return;
    }

    const instance = new RecognitionCtor();
    instance.lang = 'id-ID';
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      setResultSequence((prev) => prev + 1);
    };
    instance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = instance;
    instance.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    resultSequence,
    start,
    stop,
    _instance: recognitionRef.current,
  };
}
