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
    const result = service.extractKeywords(
      'cari perkara tahun dua ribu dua puluh enam',
    );

    expect(result.year).toBe(2026);
    expect(result.caseNumber).toBeNull();
  });

  it('returns all-null/empty for an empty transcript', () => {
    const result = service.extractKeywords('');

    expect(result).toEqual({
      year: null,
      caseType: null,
      caseNumber: null,
      nameTokens: [],
    });
  });
});

describe('SearchService.findMatches', () => {
  let service: SearchService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        NumberWordsService,
        CaseTypeLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('queries with the party name and returns mapped rows', async () => {
    const dbRow = {
      id: 1,
      caseNumberRaw: '45/Pid.B/2026/PN.Bks',
      caseType: 'Pid.B',
      year: 2026,
      partiesInvolved: 'Ahmad Subarjo',
      status: 'Available',
      rackName: 'Rak 4',
      rowNumber: 2,
      filePositionNumber: '05',
    };
    prisma.$queryRaw.mockResolvedValue([dbRow]);

    const result = await service.findMatches({
      year: 2026,
      caseType: 'Pid.B',
      caseNumber: 45,
      nameTokens: ['ahmad'],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([dbRow]);
  });

  it('returns an empty array when no keywords were extracted at all', async () => {
    const result = await service.findMatches({
      year: null,
      caseType: null,
      caseNumber: null,
      nameTokens: [],
    });

    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns an empty array when the query finds no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await service.findMatches({
      year: null,
      caseType: null,
      caseNumber: null,
      nameTokens: ['zzzznotfound'],
    });

    expect(result).toEqual([]);
  });
});

describe('SearchService.buildTtsPayload', () => {
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

  const singleMatch = {
    id: 1,
    caseNumberRaw: '45/Pid.B/2026/PN.Bks',
    caseType: 'Pid.B',
    year: 2026,
    partiesInvolved: 'Ahmad Subarjo',
    status: 'Available' as const,
    rackName: 'Rak 4',
    rowNumber: 2,
    filePositionNumber: '05',
  };

  it('states not found when there are zero matches', () => {
    const payload = service.buildTtsPayload([]);
    expect(payload).toBe('Arsip tidak ditemukan.');
  });

  it('states the full location when there is exactly one match', () => {
    const payload = service.buildTtsPayload([singleMatch]);
    expect(payload).toBe(
      'Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Berada di Rak 4, Baris dua, nomor arsip kosong lima.',
    );
  });

  it('states the count and asks for more detail when there are multiple matches', () => {
    const payload = service.buildTtsPayload([
      singleMatch,
      { ...singleMatch, id: 2 },
    ]);
    expect(payload).toBe(
      'Ditemukan dua arsip. Mohon sebutkan detail yang lebih spesifik.',
    );
  });

  it('handles a match with no shelf assigned', () => {
    const payload = service.buildTtsPayload([
      {
        ...singleMatch,
        rackName: null,
        rowNumber: null,
        filePositionNumber: null,
      },
    ]);
    expect(payload).toBe(
      'Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Lokasi rak belum ditentukan.',
    );
  });
});
