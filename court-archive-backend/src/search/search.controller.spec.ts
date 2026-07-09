import { Test } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: {
    extractKeywords: jest.Mock;
    findMatches: jest.Mock;
    buildTtsPayload: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      extractKeywords: jest.fn(),
      findMatches: jest.fn(),
      buildTtsPayload: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: service }],
    }).compile();

    controller = moduleRef.get(SearchController);
  });

  it('returns a shaped response with match_count and per-result tts_payload', async () => {
    const keywords = {
      year: 2026,
      caseType: 'Pid.B',
      caseNumber: 45,
      nameTokens: ['ahmad'],
    };
    const matches = [
      {
        id: 1,
        caseNumberRaw: '45/Pid.B/2026/PN.Bks',
        caseType: 'Pid.B',
        year: 2026,
        partiesInvolved: 'Ahmad Subarjo',
        status: 'Available',
        rackName: 'Rak 4',
        rowNumber: 2,
        filePositionNumber: '05',
      },
    ];

    service.extractKeywords.mockReturnValue(keywords);
    service.findMatches.mockResolvedValue(matches);
    service.buildTtsPayload.mockReturnValue(
      'Arsip ditemukan. Perkara Pid.B nomor empat puluh lima tahun dua ribu dua puluh enam. Berada di Rak 4, Baris dua, nomor arsip kosong lima.',
    );

    const result = await controller.search({
      raw_transcript: 'cari perkara pidana biasa nomor 45',
    });

    expect(service.extractKeywords).toHaveBeenCalledWith(
      'cari perkara pidana biasa nomor 45',
    );
    expect(service.findMatches).toHaveBeenCalledWith(keywords);
    expect(result.status).toBe('success');
    expect(result.match_count).toBe(1);
    expect(result.data[0].case_number_raw).toBe('45/Pid.B/2026/PN.Bks');
    expect(result.data[0].location).toEqual({
      rack: 'Rak 4',
      row: 2,
      position: '05',
    });
    expect(result.tts_payload).toContain('Arsip ditemukan');
  });

  it('returns null location when a match has no shelf', async () => {
    service.extractKeywords.mockReturnValue({
      year: null,
      caseType: null,
      caseNumber: null,
      nameTokens: ['budi'],
    });
    service.findMatches.mockResolvedValue([
      {
        id: 2,
        caseNumberRaw: '99/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Budi',
        status: 'Available',
        rackName: null,
        rowNumber: null,
        filePositionNumber: null,
      },
    ]);
    service.buildTtsPayload.mockReturnValue(
      'Arsip ditemukan. Perkara Pdt.G nomor sembilan puluh sembilan tahun dua ribu dua puluh enam. Lokasi rak belum ditentukan.',
    );

    const result = await controller.search({ raw_transcript: 'cari budi' });

    expect(result.data[0].location).toBeNull();
  });

  it('returns an empty data array and zero match_count when nothing is found', async () => {
    service.extractKeywords.mockReturnValue({
      year: null,
      caseType: null,
      caseNumber: null,
      nameTokens: ['zzz'],
    });
    service.findMatches.mockResolvedValue([]);
    service.buildTtsPayload.mockReturnValue('Arsip tidak ditemukan.');

    const result = await controller.search({ raw_transcript: 'cari zzz' });

    expect(result.match_count).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.tts_payload).toBe('Arsip tidak ditemukan.');
  });
});
