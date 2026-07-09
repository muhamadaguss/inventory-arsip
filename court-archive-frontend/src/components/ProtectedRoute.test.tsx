import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { ProtectedRoute } from './ProtectedRoute';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function renderWithAuth(token: string | null) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token, role: token ? 'petugas' : null } },
  });
  return render(
    <Provider store={store}>
      <ProtectedRoute>
        <p>Protected content</p>
      </ProtectedRoute>
    </Provider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('renders children when a token is present', () => {
    renderWithAuth('abc123');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /login when no token is present', () => {
    renderWithAuth(null);
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
