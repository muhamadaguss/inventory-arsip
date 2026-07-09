import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

const mockStart = jest.fn();
const mockStop = jest.fn();
let mockIsSupported = true;
let mockTranscript = '';
let mockResultSequence = 0;

jest.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isSupported: mockIsSupported,
    isListening: false,
    transcript: mockTranscript,
    resultSequence: mockResultSequence,
    start: mockStart,
    stop: mockStop,
  }),
}));

describe('SearchBar', () => {
  beforeEach(() => {
    mockIsSupported = true;
    mockTranscript = '';
    mockResultSequence = 0;
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
    mockResultSequence = 1;
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    expect(onSearch).toHaveBeenCalledWith('cari budi');
  });

  it('calls onSearch again when the identical phrase is spoken twice in a row', () => {
    mockTranscript = 'cari budi';
    mockResultSequence = 1;
    const onSearch = jest.fn();
    const { rerender } = render(<SearchBar onSearch={onSearch} />);
    expect(onSearch).toHaveBeenCalledTimes(1);

    mockResultSequence = 2;
    rerender(<SearchBar onSearch={onSearch} />);

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith('cari budi');
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
