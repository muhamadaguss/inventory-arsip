import { Test } from '@nestjs/testing';
import { CaseImportService } from './case-import.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CaseImportService', () => {
  let service: CaseImportService;
  let prisma: {
    shelf: { findFirst: jest.Mock };
    courtCase: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      shelf: { findFirst: jest.fn() },
      courtCase: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CaseImportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CaseImportService);
  });

  const header = 'case_number_raw,case_type,year,parties_involved,rack_name,row_number,file_position_number\n';

  it('imports a valid row and resolves its shelf by rack_name + row_number', async () => {
    const csv = header + '120/Pdt.G/2026/PN.Bks,Pdt.G,2026,Ahmad Subarjo,Rak A,1,No. 05\n';
    prisma.shelf.findFirst.mockResolvedValue({ id: 7, rackName: 'Rak A', rowNumber: 1 });
    prisma.courtCase.create.mockResolvedValue({ id: 1 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.shelf.findFirst).toHaveBeenCalledWith({ where: { rackName: 'Rak A', rowNumber: 1 } });
    expect(prisma.courtCase.create).toHaveBeenCalledWith({
      data: {
        caseNumberRaw: '120/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Ahmad Subarjo',
        shelfId: 7,
        filePositionNumber: 'No. 05',
      },
    });
    expect(result).toEqual({ importedCount: 1, rejectedRows: [] });
  });

  it('imports a row with no shelf reference as shelfId null', async () => {
    const csv = header + '121/Pdt.G/2026/PN.Bks,Pdt.G,2026,Budi Santoso,,,\n';
    prisma.courtCase.create.mockResolvedValue({ id: 2 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.shelf.findFirst).not.toHaveBeenCalled();
    expect(prisma.courtCase.create).toHaveBeenCalledWith({
      data: {
        caseNumberRaw: '121/Pdt.G/2026/PN.Bks',
        caseType: 'Pdt.G',
        year: 2026,
        partiesInvolved: 'Budi Santoso',
        shelfId: null,
        filePositionNumber: null,
      },
    });
    expect(result).toEqual({ importedCount: 1, rejectedRows: [] });
  });

  it('rejects a row missing case_number_raw', async () => {
    const csv = header + ',Pdt.G,2026,Budi Santoso,,,\n';

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      importedCount: 0,
      rejectedRows: [{ row: 1, reason: 'Missing case_number_raw' }],
    });
  });

  it('rejects a row with an unresolvable shelf reference', async () => {
    const csv = header + '122/Pdt.G/2026/PN.Bks,Pdt.G,2026,Citra Dewi,Rak Z,9,\n';
    prisma.shelf.findFirst.mockResolvedValue(null);

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      importedCount: 0,
      rejectedRows: [{ row: 1, reason: "Unresolvable shelf reference 'Rak Z' row 9" }],
    });
  });

  it('continues importing remaining rows after a rejected row', async () => {
    const csv =
      header +
      ',Pdt.G,2026,Missing Number,,,\n' +
      '123/Pdt.G/2026/PN.Bks,Pdt.G,2026,Valid Row,,,\n';
    prisma.courtCase.create.mockResolvedValue({ id: 3 });

    const result = await service.importFromCsv(Buffer.from(csv));

    expect(prisma.courtCase.create).toHaveBeenCalledTimes(1);
    expect(result.importedCount).toBe(1);
    expect(result.rejectedRows).toEqual([{ row: 1, reason: 'Missing case_number_raw' }]);
  });
});
