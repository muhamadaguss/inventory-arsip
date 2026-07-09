import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { StatusToggleButton } from './StatusToggleButton';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token: 'my-token', role: 'petugas' as const } },
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('StatusToggleButton', () => {
  it('shows "Tandai Dipinjam" when status is Available', () => {
    renderWithStore(
      <StatusToggleButton caseId={1} currentStatus="Available" onToggled={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /tandai dipinjam/i })).toBeInTheDocument();
  });

  it('shows "Tandai Tersedia" when status is Borrowed', () => {
    renderWithStore(
      <StatusToggleButton caseId={1} currentStatus="Borrowed" onToggled={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /tandai tersedia/i })).toBeInTheDocument();
  });

  it('calls patch with the opposite status and onToggled on success', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({});
    const onToggled = jest.fn();
    renderWithStore(
      <StatusToggleButton caseId={42} currentStatus="Available" onToggled={onToggled} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /tandai dipinjam/i }));

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/archive/cases/42/status',
      { status: 'Borrowed' },
      'my-token',
    );
    expect(onToggled).toHaveBeenCalledWith('Borrowed');
  });
});
