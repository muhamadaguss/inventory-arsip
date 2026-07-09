import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { ResultCard } from './ResultCard';
import type { CaseResult } from '@/store/searchSlice';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

const availableResult: CaseResult = {
  id: 1,
  case_number_raw: '45/Pid.B/2026/PN.Bks',
  case_type: 'Pid.B',
  year: 2026,
  parties_involved: 'Ahmad Subarjo',
  status: 'Available',
  location: { rack: 'Rak 4', row: 2, position: '05' },
  tts_payload: 'Arsip ditemukan.',
};

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token: 'my-token', role: 'petugas' as const } },
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('ResultCard', () => {
  it('renders the rack and position in giant text', () => {
    renderWithStore(<ResultCard result={availableResult} />);
    expect(screen.getByText('Rak 4')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('applies a green background when status is Available', () => {
    renderWithStore(<ResultCard result={availableResult} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-green-600');
  });

  it('applies a red background when status is Borrowed', () => {
    renderWithStore(<ResultCard result={{ ...availableResult, status: 'Borrowed' }} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });

  it('shows a fallback message when location is null', () => {
    renderWithStore(<ResultCard result={{ ...availableResult, location: null }} />);
    expect(screen.getByText(/lokasi rak belum ditentukan/i)).toBeInTheDocument();
  });

  it('flips the background color after a successful status toggle', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({});
    renderWithStore(<ResultCard result={availableResult} />);

    await userEvent.click(screen.getByRole('button', { name: /tandai dipinjam/i }));

    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });
});
