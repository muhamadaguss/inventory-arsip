import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  const originalSpeechSynthesis = (window as unknown as Record<string, unknown>).speechSynthesis;
  const originalUtterance = (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;

  afterEach(() => {
    (window as unknown as Record<string, unknown>).speechSynthesis = originalSpeechSynthesis;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = originalUtterance;
  });

  it('reports unsupported when speechSynthesis is absent', () => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;

    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSupported).toBe(false);
  });

  it('speaks with id-ID locale when supported', () => {
    const mockSpeak = jest.fn();
    (window as unknown as Record<string, unknown>).speechSynthesis = {
      speak: mockSpeak,
      cancel: jest.fn(),
    };
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = jest
      .fn()
      .mockImplementation((text: string) => ({ text, lang: '' }));

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Arsip ditemukan.');
    });

    expect(mockSpeak).toHaveBeenCalled();
    const utteranceArg = mockSpeak.mock.calls[0][0];
    expect(utteranceArg.lang).toBe('id-ID');
    expect(result.current.isSpeaking).toBe(true);
  });

  it('cancels speech on stop()', () => {
    const mockCancel = jest.fn();
    (window as unknown as Record<string, unknown>).speechSynthesis = {
      speak: jest.fn(),
      cancel: mockCancel,
    };
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = jest
      .fn()
      .mockImplementation((text: string) => ({ text, lang: '' }));

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Arsip ditemukan.');
    });
    act(() => {
      result.current.stop();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});
