import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CasesService', () => {
  let service: CasesService;
  let prisma: {
    courtCase: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const sampleCase = {
    id: 1,
    caseNumberRaw: '120/Pdt.G/2026/PN.Bks',
    caseNumberClean: '120 Pdt G 2026',
    caseType: 'Pdt.G',
    year: 2026,
    partiesInvolved: 'Ahmad Subarjo',
    shelfId: null,
    filePositionNumber: null,
    status: 'Available',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      courtCase: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CasesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CasesService);
  });

  it('creates a case', async () => {
    const dto = {
      caseNumberRaw: sampleCase.caseNumberRaw,
      caseType: sampleCase.caseType,
      year: sampleCase.year,
      partiesInvolved: sampleCase.partiesInvolved,
    };
    prisma.courtCase.create.mockResolvedValue(sampleCase);

    const result = await service.create(dto);

    expect(prisma.courtCase.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(sampleCase);
  });

  it('lists all cases', async () => {
    prisma.courtCase.findMany.mockResolvedValue([sampleCase]);

    const result = await service.findAll();

    expect(result).toEqual([sampleCase]);
  });

  it('finds one case by id', async () => {
    prisma.courtCase.findUnique.mockResolvedValue(sampleCase);

    const result = await service.findOne(1);

    expect(prisma.courtCase.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(sampleCase);
  });

  it('throws NotFoundException when finding a missing case', async () => {
    prisma.courtCase.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('updates a case', async () => {
    const dto = { partiesInvolved: 'Ahmad Subarjo bin Slamet' };
    const updated = { ...sampleCase, ...dto };
    prisma.courtCase.update.mockResolvedValue(updated);

    const result = await service.update(1, dto);

    expect(prisma.courtCase.update).toHaveBeenCalledWith({ where: { id: 1 }, data: dto });
    expect(result).toEqual(updated);
  });

  it('removes a case', async () => {
    prisma.courtCase.delete.mockResolvedValue(sampleCase);

    await service.remove(1);

    expect(prisma.courtCase.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
