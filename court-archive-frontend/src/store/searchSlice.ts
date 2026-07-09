import { createSlice } from '@reduxjs/toolkit';

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
}

const initialState: SearchState = { status: 'idle' };

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {},
});

export default searchSlice.reducer;
