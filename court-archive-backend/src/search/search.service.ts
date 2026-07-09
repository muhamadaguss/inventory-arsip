import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';

const STOPWORDS = new Set(['tolong', 'cari', 'arsip', 'nomor', 'perkara', 'atas', 'nama']);

// 'tahun' is not stripped up front: it marks the boundary between a case
// number and a year (e.g. "nomor empat puluh lima tahun dua ribu dua puluh
// enam"). NumberWordsService.parse() is greedily additive across an entire
// token slice, so if 'tahun' were removed before scanning, "empat puluh
// lima" and "dua ribu dua puluh enam" would be parsed as a single merged
// number. Keeping 'tahun' in the stream and skipping over it during the walk
// preserves the boundary while still excluding it from name tokens.
const BOUNDARY_WORD = 'tahun';

export interface ExtractedKeywords {
  year: number | null;
  caseType: string | null;
  caseNumber: number | null;
  nameTokens: string[];
}

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private numberWords: NumberWordsService,
    private caseTypeLookup: CaseTypeLookupService,
  ) {}

  extractKeywords(transcript: string): ExtractedKeywords {
    const tokens = transcript
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0 && !STOPWORDS.has(token));

    let caseType: string | null = null;
    const foundNumbers: number[] = [];
    const nameTokens: string[] = [];

    let index = 0;
    while (index < tokens.length) {
      if (tokens[index] === BOUNDARY_WORD) {
        index += 1;
        continue;
      }

      const twoWordPhrase = tokens.slice(index, index + 2).join(' ');
      const twoWordMatch = this.caseTypeLookup.resolve(twoWordPhrase);
      if (twoWordMatch && caseType === null) {
        caseType = twoWordMatch;
        index += 2;
        continue;
      }

      const oneWordMatch = this.caseTypeLookup.resolve(tokens[index]);
      if (oneWordMatch && caseType === null) {
        caseType = oneWordMatch;
        index += 1;
        continue;
      }

      const numberResult = this.numberWords.parse(tokens.slice(index));
      if (numberResult.value !== null) {
        foundNumbers.push(numberResult.value);
        index += numberResult.consumedTokens;
        continue;
      }

      nameTokens.push(tokens[index]);
      index += 1;
    }

    const { year, caseNumber } = this.disambiguateNumbers(foundNumbers);

    return { year, caseType, caseNumber, nameTokens };
  }

  private disambiguateNumbers(numbers: number[]): { year: number | null; caseNumber: number | null } {
    if (numbers.length === 0) {
      return { year: null, caseNumber: null };
    }

    const yearCandidates = numbers.filter((n) => n >= 1900 && n <= 2100);
    const nonYearCandidates = numbers.filter((n) => n < 1900 || n > 2100);

    if (numbers.length === 1) {
      const only = numbers[0];
      const isYear = only >= 1900 && only <= 2100;
      return { year: isYear ? only : null, caseNumber: isYear ? null : only };
    }

    return {
      year: yearCandidates[0] ?? null,
      caseNumber: nonYearCandidates[0] ?? null,
    };
  }
}
