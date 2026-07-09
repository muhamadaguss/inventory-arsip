import { NumberWordsService } from './number-words.service';

describe('NumberWordsService.parse', () => {
  let service: NumberWordsService;

  beforeEach(() => {
    service = new NumberWordsService();
  });

  it('parses a single-digit number word', () => {
    const result = service.parse(['lima']);
    expect(result).toEqual({ value: 5, consumedTokens: 1 });
  });

  it('parses "sepuluh" as 10', () => {
    const result = service.parse(['sepuluh']);
    expect(result).toEqual({ value: 10, consumedTokens: 1 });
  });

  it('parses "X belas" as 10+X', () => {
    const result = service.parse(['tiga', 'belas']);
    expect(result).toEqual({ value: 13, consumedTokens: 2 });
  });

  it('parses "X puluh Y" as X*10+Y', () => {
    const result = service.parse(['empat', 'puluh', 'lima']);
    expect(result).toEqual({ value: 45, consumedTokens: 3 });
  });

  it('parses "seratus" as 100', () => {
    const result = service.parse(['seratus']);
    expect(result).toEqual({ value: 100, consumedTokens: 1 });
  });

  it('parses "dua ribu dua puluh enam" as 2026 (additive combination)', () => {
    const result = service.parse(['dua', 'ribu', 'dua', 'puluh', 'enam']);
    expect(result).toEqual({ value: 2026, consumedTokens: 5 });
  });

  it('stops consuming at a non-number token', () => {
    const result = service.parse(['empat', 'puluh', 'lima', 'pidana']);
    expect(result).toEqual({ value: 45, consumedTokens: 3 });
  });

  it('returns null value and 0 consumed for a non-number first token', () => {
    const result = service.parse(['pidana']);
    expect(result).toEqual({ value: null, consumedTokens: 0 });
  });

  it('returns null value and 0 consumed for an empty token array', () => {
    const result = service.parse([]);
    expect(result).toEqual({ value: null, consumedTokens: 0 });
  });
});

describe('NumberWordsService.toWords', () => {
  let service: NumberWordsService;

  beforeEach(() => {
    service = new NumberWordsService();
  });

  it('converts single digits', () => {
    expect(service.toWords(5)).toBe('lima');
  });

  it('converts 10 as "sepuluh"', () => {
    expect(service.toWords(10)).toBe('sepuluh');
  });

  it('converts 11 as "sebelas"', () => {
    expect(service.toWords(11)).toBe('sebelas');
  });

  it('converts teens as "X belas"', () => {
    expect(service.toWords(13)).toBe('tiga belas');
  });

  it('converts round tens as "X puluh"', () => {
    expect(service.toWords(40)).toBe('empat puluh');
  });

  it('converts tens with a unit as "X puluh Y"', () => {
    expect(service.toWords(45)).toBe('empat puluh lima');
  });

  it('converts exactly 100 as "seratus"', () => {
    expect(service.toWords(100)).toBe('seratus');
  });

  it('converts hundreds with remainder', () => {
    expect(service.toWords(120)).toBe('seratus dua puluh');
  });

  it('converts 2026 as "dua ribu dua puluh enam"', () => {
    expect(service.toWords(2026)).toBe('dua ribu dua puluh enam');
  });

  it('converts 0 as "kosong"', () => {
    expect(service.toWords(0)).toBe('kosong');
  });
});
