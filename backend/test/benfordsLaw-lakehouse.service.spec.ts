import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { BenfordsLawLakehouseService } from '../src/modules/gold-lakehouse/benfordsLaw-lakehouse.service';

describe('BenfordsLawLakehouseService', () => {
  let service: BenfordsLawLakehouseService;
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
        BenfordsLawLakehouseService,
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

    service = module.get<BenfordsLawLakehouseService>(BenfordsLawLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getBenfordAnalysisByAccount =====================
  describe('getBenfordAnalysisByAccount', () => {
    it('returns Benford analysis', async () => {
      http.mockReturnValue(okHttp([{ amount: 123 }, { amount: 456 }, { amount: 789 }]));
      const result = await service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(result).toHaveProperty('expected');
      expect(result).toHaveProperty('actual');
      expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('returns zero sampleSize on empty data', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(result.sampleSize).toBe(0);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31')).rejects.toThrow(
        'Failed to perform Benford analysis',
      );
    });
  });
});
