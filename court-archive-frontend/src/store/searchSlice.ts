import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CaseResult {
  id: number;
  case_number_raw: string;
  case_type: string;
  year: number;
  parties_involved: string;
  status: 'Available' | 'Borrowed';
  location: { rack: string; row: number; position: string | null } | null;
  tts_payload: string;
}

export interface SearchResponse {
  status: 'success';
  match_count: number;
  tts_payload: string;
  data: CaseResult[];
}

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  results: CaseResult[];
  matchCount: number;
  ttsPayload: string | null;
  error: string | null;
}

const initialState: SearchState = {
  status: 'idle',
  results: [],
  matchCount: 0,
  ttsPayload: null,
  error: null,
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    searchStart: (state) => {
      state.status = 'loading';
      state.error = null;
    },
    searchSuccess: (state, action: PayloadAction<SearchResponse>) => {
      state.status = 'success';
      state.results = action.payload.data;
      state.matchCount = action.payload.match_count;
      state.ttsPayload = action.payload.tts_payload;
    },
    searchFailure: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
  },
});

export const { searchStart, searchSuccess, searchFailure } = searchSlice.actions;
export default searchSlice.reducer;
