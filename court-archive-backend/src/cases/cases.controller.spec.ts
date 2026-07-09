import { Test } from '@nestjs/testing';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

describe('CasesController', () => {
  let controller: CasesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [{ provide: CasesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(CasesController);
  });

  it('creates a case via the service', async () => {
    const dto = { caseNumberRaw: '120/Pdt.G/2026', caseType: 'Pdt.G', year: 2026, partiesInvolved: 'Ahmad' };
    service.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.id).toBe(1);
  });

  it('lists cases via the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it('finds one case via the service', async () => {
    service.findOne.mockResolvedValue({ id: 1, caseNumberRaw: '120/Pdt.G/2026' });

    const result = await controller.findOne(1);

    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
  });

  it('updates a case via the service', async () => {
    const dto = { partiesInvolved: 'Ahmad Subarjo bin Slamet' };
    service.update.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.update(1, dto);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(result.partiesInvolved).toBe('Ahmad Subarjo bin Slamet');
  });

  it('removes a case via the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(service.remove).toHaveBeenCalledWith(1);
  });

  it('updates case status via the service', async () => {
    service.updateStatus.mockResolvedValue({ id: 1, status: 'Borrowed' });

    const result = await controller.updateStatus(1, { status: 'Borrowed' });

    expect(service.updateStatus).toHaveBeenCalledWith(1, 'Borrowed');
    expect(result.status).toBe('Borrowed');
  });
});
