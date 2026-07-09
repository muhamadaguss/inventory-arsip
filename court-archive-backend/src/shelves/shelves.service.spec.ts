import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShelvesService } from './shelves.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ShelvesService', () => {
  let service: ShelvesService;
  let prisma: {
    shelf: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      shelf: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ShelvesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ShelvesService);
  });

  it('creates a shelf', async () => {
    const dto = { rackName: 'Rak A', rowNumber: 1 };
    const created = { id: 1, ...dto, slotNumber: null, createdAt: new Date() };
    prisma.shelf.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(prisma.shelf.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(created);
  });

  it('lists all shelves', async () => {
    const shelves = [{ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() }];
    prisma.shelf.findMany.mockResolvedValue(shelves);

    const result = await service.findAll();

    expect(result).toEqual(shelves);
  });

  it('finds one shelf by id', async () => {
    const shelf = { id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() };
    prisma.shelf.findUnique.mockResolvedValue(shelf);

    const result = await service.findOne(1);

    expect(prisma.shelf.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(shelf);
  });

  it('throws NotFoundException when finding a missing shelf', async () => {
    prisma.shelf.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('updates a shelf', async () => {
    const dto = { rowNumber: 2 };
    const updated = { id: 1, rackName: 'Rak A', rowNumber: 2, slotNumber: null, createdAt: new Date() };
    prisma.shelf.update.mockResolvedValue(updated);

    const result = await service.update(1, dto);

    expect(prisma.shelf.update).toHaveBeenCalledWith({ where: { id: 1 }, data: dto });
    expect(result).toEqual(updated);
  });

  it('removes a shelf', async () => {
    prisma.shelf.delete.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() });

    await service.remove(1);

    expect(prisma.shelf.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
