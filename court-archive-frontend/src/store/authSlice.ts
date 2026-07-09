import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  role: 'admin' | 'petugas' | null;
}

const initialState: AuthState = { token: null, role: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
});

export default authSlice.reducer;
