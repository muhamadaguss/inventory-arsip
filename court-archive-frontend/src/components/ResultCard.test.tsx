import { render, screen } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import type { CaseResult } from '@/store/searchSlice';

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

describe('ResultCard', () => {
  it('renders the rack and position in giant text', () => {
    render(<ResultCard result={availableResult} />);
    expect(screen.getByText('Rak 4')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('applies a green background when status is Available', () => {
    render(<ResultCard result={availableResult} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-green-600');
  });

  it('applies a red background when status is Borrowed', () => {
    render(<ResultCard result={{ ...availableResult, status: 'Borrowed' }} />);
    expect(screen.getByTestId('result-card')).toHaveClass('bg-red-600');
  });

  it('shows a fallback message when location is null', () => {
    render(<ResultCard result={{ ...availableResult, location: null }} />);
    expect(screen.getByText(/lokasi rak belum ditentukan/i)).toBeInTheDocument();
  });
});
