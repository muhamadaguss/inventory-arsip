import reducer, { searchStart, searchSuccess, searchFailure } from './searchSlice';

const samplePayload = {
  status: 'success' as const,
  match_count: 1,
  tts_payload: 'Arsip ditemukan.',
  data: [
    {
      id: 1,
      case_number_raw: '45/Pid.B/2026/PN.Bks',
      case_type: 'Pid.B',
      year: 2026,
      parties_involved: 'Ahmad Subarjo',
      status: 'Available' as const,
      location: { rack: 'Rak 4', row: 2, position: '05' },
      tts_payload: 'Arsip ditemukan. Berada di Rak 4.',
    },
  ],
};

describe('searchSlice', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      status: 'idle',
      results: [],
      matchCount: 0,
      ttsPayload: null,
      error: null,
    });
  });

  it('sets status to loading on searchStart', () => {
    const state = reducer(
      { status: 'idle', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchStart(),
    );
    expect(state.status).toBe('loading');
  });

  it('stores results on searchSuccess', () => {
    const state = reducer(
      { status: 'loading', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchSuccess(samplePayload),
    );
    expect(state.status).toBe('success');
    expect(state.results).toEqual(samplePayload.data);
    expect(state.matchCount).toBe(1);
    expect(state.ttsPayload).toBe('Arsip ditemukan.');
  });

  it('stores the error message on searchFailure', () => {
    const state = reducer(
      { status: 'loading', results: [], matchCount: 0, ttsPayload: null, error: null },
      searchFailure('Network error'),
    );
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
  });
});
