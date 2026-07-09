import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

const mockStart = jest.fn();
const mockStop = jest.fn();
let mockIsSupported = true;
let mockTranscript = '';

jest.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isSupported: mockIsSupported,
    isListening: false,
    transcript: mockTranscript,
    start: mockStart,
    stop: mockStop,
  }),
}));

describe('SearchBar', () => {
  beforeEach(() => {
    mockIsSupported = true;
    mockTranscript = '';
    mockStart.mockClear();
  });

  it('renders a mic button when SpeechRecognition is supported', () => {
    render(<SearchBar onSearch={jest.fn()} />);
    expect(screen.getByRole('button', { name: /mulai bicara/i })).toBeInTheDocument();
  });

  it('calls start() when the mic button is clicked', async () => {
    render(<SearchBar onSearch={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /mulai bicara/i }));
    expect(mockStart).toHaveBeenCalled();
  });

  it('calls onSearch with the transcript once captured', () => {
    mockTranscript = 'cari budi';
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    expect(onSearch).toHaveBeenCalledWith('cari budi');
  });

  it('renders a text input instead of a mic button when unsupported', () => {
    mockIsSupported = false;
    render(<SearchBar onSearch={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /mulai bicara/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/cari arsip/i)).toBeInTheDocument();
  });

  it('calls onSearch with the typed value on text form submit', async () => {
    mockIsSupported = false;
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText(/cari arsip/i), 'cari budi{enter}');
    expect(onSearch).toHaveBeenCalledWith('cari budi');
  });
});
