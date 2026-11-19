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
    it('sends the given limit in the request body', async () => {
      await service.runSqlQuery('SELECT 1', 1);
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 1 }), expect.any(Object));
    });

    it('accepts custom limit', async () => {
      await service.runSqlQuery('SELECT 1', 100);
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 100 }), expect.any(Object));
    });

    it('substitutes every placeholder correctly when there are ten or more parameters', async () => {
      // "$1" is a prefix of "$10", "$11", ... so replacing $1 first would corrupt them
      const parameters = Array.from({ length: 12 }, (_, i) => `v${i + 1}`);
      const placeholders = parameters.map((_, i) => `$${i + 1}`).join(', ');

      await service.runSqlQuery(`SELECT ${placeholders}`, 1, parameters);

      const sent = (http.mock.calls[0][1] as { sql_query: string }).sql_query;
      expect(sent).toBe(`SELECT ${parameters.map((value) => `'${value}'`).join(', ')}`);
    });

    it('still escapes quotes, numbers and nulls, and replaces a placeholder wherever it repeats', async () => {
      await service.runSqlQuery('SELECT $1, $2, $3, $1', 1, ["O'Brien", 42, null]);

      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe("SELECT 'O''Brien', 42, NULL, 'O''Brien'");
    });

    it('does not rescan a value it has already inserted, even if the value contains a placeholder such as $1', async () => {
      await service.runSqlQuery('SELECT $1, $2', 1, ["x' OR '1'='1", 'cost $1']);

      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe("SELECT 'x'' OR ''1''=''1', 'cost $1'");
    });

    it('inserts values literally, including text that looks like a replacement pattern ($&, $$)', async () => {
      await service.runSqlQuery('SELECT $1', 1, ['a$&b$$c']);

      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe("SELECT 'a$&b$$c'");
    });

    it('substitutes correctly with 150 parameters, including repeats of $1, $10 and $100', async () => {
      const parameters = Array.from({ length: 150 }, (_, i) => `v${i + 1}`);
      const placeholders = parameters.map((_, i) => `$${i + 1}`).join(', ');

      await service.runSqlQuery(`SELECT ${placeholders}, $1, $10, $100, $150`, 1, parameters);

      const expected = [...parameters, 'v1', 'v10', 'v100', 'v150'].map((value) => `'${value}'`).join(', ');
      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe(`SELECT ${expected}`);
    });

    it('only treats $1, $2, ... as placeholders, so $0 and $01 are left as they are', async () => {
      await service.runSqlQuery('SELECT $0, $01, $1', 1, ['x']);

      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe("SELECT $0, $01, 'x'");
    });

    it('leaves a placeholder that has no matching parameter untouched', async () => {
      await service.runSqlQuery('SELECT $1, $3', 1, ['v']);

      expect((http.mock.calls[0][1] as { sql_query: string }).sql_query).toBe("SELECT 'v', $3");
    });

    it('throws when status is not success', async () => {
      http.mockReturnValue(badHttp());
      await expect(service.runSqlQuery('BAD', 1)).rejects.toThrow(HttpException);
    });

    it('re-throws HttpException', async () => {
      http.mockReturnValue(throwError(() => new HttpException('SQL error', 500)));
      await expect(service.runSqlQuery('BAD', 1)).rejects.toThrow('SQL error');
    });

    it('wraps generic errors', async () => {
      http.mockReturnValue(errHttp('conn'));
      await expect(service.runSqlQuery('BAD', 1)).rejects.toThrow('Failed to run SQL query');
    });

    it('logs the upstream response body on an Axios failure', async () => {
      const axiosError = Object.assign(new Error('Request failed with status code 500'), {
        isAxiosError: true,
        response: { data: { error: 'Spark: table not found' }, status: 500 },
      });
      http.mockReturnValue(throwError(() => axiosError));
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.runSqlQuery('BAD', 1)).rejects.toThrow(HttpException);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Spark: table not found'));
    });
  });
});
