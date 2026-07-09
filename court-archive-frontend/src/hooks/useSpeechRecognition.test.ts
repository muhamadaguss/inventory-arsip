import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
}

describe('useSpeechRecognition', () => {
  const originalSpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition;

  afterEach(() => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = originalSpeechRecognition;
  });

  it('reports unsupported when SpeechRecognition is absent', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(false);
  });

  it('sets lang to id-ID and starts listening on start()', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('captures the transcript from a recognition result event', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    const instance = (result.current as unknown as { _instance: MockSpeechRecognition })._instance;
    act(() => {
      instance.onresult?.({
        results: [[{ transcript: 'cari perkara pidana nomor lima' }]],
      });
    });

    expect(result.current.transcript).toBe('cari perkara pidana nomor lima');
  });

  it('stops listening on stop()', () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.isListening).toBe(false);
  });
});
