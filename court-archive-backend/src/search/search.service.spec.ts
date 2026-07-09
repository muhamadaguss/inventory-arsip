import { Test } from '@nestjs/testing';
import { SearchService } from './search.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchService.extractKeywords', () => {
  let service: SearchService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        NumberWordsService,
        CaseTypeLookupService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('extracts case type, case number, and year from a full transcript', () => {
    const result = service.extractKeywords(
      'cari perkara pidana biasa nomor empat puluh lima tahun dua ribu dua puluh enam atas nama ahmad',
    );

    expect(result.caseType).toBe('Pid.B');
    expect(result.caseNumber).toBe(45);
    expect(result.year).toBe(2026);
    expect(result.nameTokens).toEqual(['ahmad']);
  });

  it('extracts only a name when no case type or numbers are present', () => {
    const result = service.extractKeywords('cari budi santoso');

    expect(result.caseType).toBeNull();
    expect(result.caseNumber).toBeNull();
    expect(result.year).toBeNull();
    expect(result.nameTokens).toEqual(['budi', 'santoso']);
  });

  it('drops unrecognized case type tokens rather than guessing', () => {
    const result = service.extractKeywords('cari perkara antariksa nomor lima');

    expect(result.caseType).toBeNull();
    expect(result.caseNumber).toBe(5);
  });

  it('treats a lone 4-digit-range number as year when it is the only number found', () => {
    const result = service.extractKeywords('cari perkara tahun dua ribu dua puluh enam');

    expect(result.year).toBe(2026);
    expect(result.caseNumber).toBeNull();
  });

  it('returns all-null/empty for an empty transcript', () => {
    const result = service.extractKeywords('');

    expect(result).toEqual({ year: null, caseType: null, caseNumber: null, nameTokens: [] });
  });
});
