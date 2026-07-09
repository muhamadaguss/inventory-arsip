import { Injectable } from '@nestjs/common';

const UNITS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
};

const TEENS: Record<string, number> = {
  sepuluh: 10,
  sebelas: 11,
};

export interface ParseResult {
  value: number | null;
  consumedTokens: number;
}

@Injectable()
export class NumberWordsService {
  parse(tokens: string[]): ParseResult {
    if (tokens.length === 0) {
      return { value: null, consumedTokens: 0 };
    }

    let total = 0;
    let index = 0;
    let matchedAny = false;

    while (index < tokens.length) {
      const segment = this.parseSegment(tokens, index);
      if (segment === null) {
        break;
      }
      total += segment.value;
      index += segment.consumed;
      matchedAny = true;
    }

    if (!matchedAny) {
      return { value: null, consumedTokens: 0 };
    }

    return { value: total, consumedTokens: index };
  }

  private parseSegment(
    tokens: string[],
    start: number,
  ): { value: number; consumed: number } | null {
    const token = tokens[start];

    if (token === 'seribu') {
      return { value: 1000, consumed: 1 };
    }
    if (token === 'seratus') {
      return { value: 100, consumed: 1 };
    }
    if (TEENS[token] !== undefined) {
      return { value: TEENS[token], consumed: 1 };
    }

    if (UNITS[token] !== undefined) {
      const unitValue = UNITS[token];
      const next = tokens[start + 1];

      if (next === 'ribu') {
        return { value: unitValue * 1000, consumed: 2 };
      }
      if (next === 'ratus') {
        return { value: unitValue * 100, consumed: 2 };
      }
      if (next === 'belas') {
        return { value: 10 + unitValue, consumed: 2 };
      }
      if (next === 'puluh') {
        const afterPuluh = tokens[start + 2];
        if (afterPuluh !== undefined && UNITS[afterPuluh] !== undefined) {
          return { value: unitValue * 10 + UNITS[afterPuluh], consumed: 3 };
        }
        return { value: unitValue * 10, consumed: 2 };
      }

      return { value: unitValue, consumed: 1 };
    }

    return null;
  }
}
