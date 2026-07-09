import reducer, { login, logout } from './authSlice';

describe('authSlice', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      token: null,
      role: null,
    });
  });

  it('sets token and role on login', () => {
    const state = reducer(
      { token: null, role: null },
      login({ token: 'abc123', role: 'petugas' }),
    );
    expect(state).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('clears token and role on logout', () => {
    const state = reducer(
      { token: 'abc123', role: 'admin' },
      logout(),
    );
    expect(state).toEqual({ token: null, role: null });
  });
});
