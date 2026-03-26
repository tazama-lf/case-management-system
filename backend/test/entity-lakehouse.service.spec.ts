import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { EntityLakehouseService } from '../src/modules/gold-lakehouse/entity-lakehouse.service';

describe('EntityLakehouseService', () => {
  let service: EntityLakehouseService;
  let http: jest.Mock;

  const okHttp = (rows: any[] = [{}]) =>
    of({
      data: { status: 'success', data: rows, code: 200 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  const errHttp = (msg = 'fail') => throwError(() => new Error(msg));

  beforeEach(async () => {
    http = jest.fn().mockReturnValue(okHttp());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityLakehouseService,
        { provide: HttpService, useValue: { post: http } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'http://localhost:5000'),
            get: jest.fn((key: string, def?: any) => {
              if (key === 'GOLD_LAKEHOUSE_TIMEOUT') return 30000;
              if (key === 'ALERT_HISTORY_FALLBACK_E2E_ID') return 'fallback-e2e-id';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EntityLakehouseService>(EntityLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getEntityAccounts =====================
  describe('getEntityAccounts', () => {
    it('returns entity accounts', async () => {
      http.mockReturnValue(okHttp([{ destination: 'acc1' }, { destination: 'acc2' }]));
      const result = await service.getEntityAccounts('entity1', 'DEFAULT');
      expect(result.accountCount).toBe(2);
    });

    it('returns empty on error (does not throw)', async () => {
      http.mockReturnValue(errHttp());
      const result = await service.getEntityAccounts('entity1', 'DEFAULT');
      expect(result.accountCount).toBe(0);
    });
  });

  // ===================== getAllAccountHolderData =====================
  describe('getAllAccountHolderData', () => {
    it('returns account holder data', async () => {
      const result: any = await service.getAllAccountHolderData('DEFAULT');
      expect(result.tableName).toBe('account_holder');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAllAccountHolderData('DEFAULT')).rejects.toThrow(HttpException);
    });
  });
});
