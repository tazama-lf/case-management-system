import { Test, TestingModule } from '@nestjs/testing';
import { TazamaDWHController } from '../../src/tazama-dwh/tazama-dwh.controller';
import { TazamaDwhService } from '../../src/tazama-dwh/tazama-dwh.service';

describe('TazamaDWHController', () => {
  let controller: TazamaDWHController;
  let service: TazamaDwhService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TazamaDWHController],
      providers: [
        {
          provide: TazamaDwhService,
          useValue: {
            generateProfile: jest.fn(),
            getTransactionsByCreditorId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TazamaDWHController>(TazamaDWHController);
    service = module.get<TazamaDwhService>(TazamaDwhService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call generateProfile with correct params', async () => {
    const dto = { tenantId: 'T001', filters: { creditorId: 'Retail Store LLC' } };
    const req: any = { user: { token: { clientId: 'user1' } } };
    (service.generateProfile as jest.Mock).mockResolvedValueOnce({ transactionTable: [] });
    const result = await controller.generateProfile(dto, req);
    expect(service.generateProfile).toHaveBeenCalledWith(dto, 'user1');
    expect(result.transactionTable).toBeDefined();
  });

  it('should call getTransactionsByCreditorId with correct params', async () => {
    const req: any = { user: { token: { tenantId: 'T001' } } };
    (service.getTransactionsByCreditorId as jest.Mock).mockResolvedValueOnce([{ destination: 'Retail Store LLC' }]);
    const result = await controller.getTransactionsByCreditor(req, 'Retail Store LLC');
    expect(service.getTransactionsByCreditorId).toHaveBeenCalledWith('T001', 'Retail Store LLC');
    expect(result[0].destination).toBe('Retail Store LLC');
  });
});
