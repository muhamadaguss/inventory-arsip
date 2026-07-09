import { Test } from '@nestjs/testing';
import { ShelvesController } from './shelves.controller';
import { ShelvesService } from './shelves.service';

describe('ShelvesController', () => {
  let controller: ShelvesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ShelvesController],
      providers: [{ provide: ShelvesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ShelvesController);
  });

  it('creates a shelf via the service', async () => {
    const dto = { rackName: 'Rak A', rowNumber: 1 };
    service.create.mockResolvedValue({ id: 1, ...dto, slotNumber: null, createdAt: new Date() });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.rackName).toBe('Rak A');
  });

  it('lists shelves via the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it('finds one shelf via the service', async () => {
    service.findOne.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 1, slotNumber: null, createdAt: new Date() });

    const result = await controller.findOne(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('updates a shelf via the service', async () => {
    const dto = { rowNumber: 2 };
    service.update.mockResolvedValue({ id: 1, rackName: 'Rak A', rowNumber: 2, slotNumber: null, createdAt: new Date() });

    const result = await controller.update(1, dto);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(result.rowNumber).toBe(2);
  });

  it('removes a shelf via the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
