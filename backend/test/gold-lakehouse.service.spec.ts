import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';

describe('GoldLakehouseService', () => {
  let service: GoldLakehouseService;
  let http: jest.Mock;

  /** Returns a successful Axios-like observable wrapping a /query or /execute_sql body */
  const okHttp = (rows: any[] = [{}]) =>
    of({
      data: { status: 'success', data: rows, code: 200 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  /** Error observable */
  const errHttp = (msg = 'fail') => throwError(() => new Error(msg));

  /** HTTP response with status!=success */
  const badHttp = () =>
    of({
      data: { status: 'error', code: 500 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  beforeEach(async () => {
    http = jest.fn().mockReturnValue(okHttp());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldLakehouseService,
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

    service = module.get<GoldLakehouseService>(GoldLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== query =====================
  describe('query', () => {
    it('returns response on success', async () => {
      const result = await service.query({ table_name: 'alerts', filters: {} });
      expect(result.status).toBe('success');
    });

    it('throws when status is not success', async () => {
      http.mockReturnValue(badHttp());
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow(HttpException);
    });

    it('throws SERVICE_UNAVAILABLE on ECONNREFUSED', async () => {
      http.mockReturnValue(throwError(() => ({ code: 'ECONNREFUSED' })));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow(HttpException);
    });

    it('re-throws HttpException', async () => {
      http.mockReturnValue(throwError(() => new HttpException('Http error', 400)));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow('Http error');
    });

    it('wraps generic errors', async () => {
      http.mockReturnValue(errHttp('unexpected'));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow('Failed to query Gold Lakehouse');
    });
  });

  // ===================== runSqlQuery =====================
  describe('runSqlQuery', () => {
    it('uses default limit of 1', async () => {
      await service.runSqlQuery('SELECT 1');
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 1 }), expect.any(Object));
    });

    it('accepts custom limit', async () => {
      await service.runSqlQuery('SELECT 1', 100);
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 100 }), expect.any(Object));
    });

    it('throws when status is not success', async () => {
      http.mockReturnValue(badHttp());
      await expect(service.runSqlQuery('BAD')).rejects.toThrow(HttpException);
    });

    it('re-throws HttpException', async () => {
      http.mockReturnValue(throwError(() => new HttpException('SQL error', 500)));
      await expect(service.runSqlQuery('BAD')).rejects.toThrow('SQL error');
    });

    it('wraps generic errors', async () => {
      http.mockReturnValue(errHttp('conn'));
      await expect(service.runSqlQuery('BAD')).rejects.toThrow('Failed to run SQL query');
    });
  });
});
