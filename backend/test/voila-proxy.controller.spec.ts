import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as fs from 'node:fs';
import * as jwt from 'jsonwebtoken';
import { VoilaProxyController } from '../src/modules/voila-proxy/voila-proxy.controller';
import { VoilaProxyService } from '../src/modules/voila-proxy/voila-proxy.service';
import { CacheService } from '../src/modules/shared/cache.service';

jest.mock('node:fs');
jest.mock('jsonwebtoken');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

/**
 * Builds a mock Express Response with a fluent status()/setHeader() chain,
 * matching how VoilaProxyController.proxyToVoila actually calls it for the
 * HEAD short-circuit: res.status(200).setHeader(...).end().
 */
function createMockResponse(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res as jest.Mocked<Response>;
}

describe('VoilaProxyController', () => {
  let controller: VoilaProxyController;
  let voilaProxyService: jest.Mocked<VoilaProxyService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedFs.readFileSync.mockReturnValue('mock-public-key');

    const mockVoilaProxyService = {
      proxyRequest: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
      setUserToken: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('/fake/path/to/public.pem'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoilaProxyController],
      providers: [
        { provide: VoilaProxyService, useValue: mockVoilaProxyService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    controller = module.get(VoilaProxyController);
    voilaProxyService = module.get(VoilaProxyService);
    cacheService = module.get(CacheService);
  });

  function buildAuthenticatedRequest(overrides: Partial<Request> = {}): Request {
    return {
      method: 'GET',
      url: '/voila-proxy/voila/render/transaction-network.ipynb',
      cookies: { access_token_abc123: 'valid-jwt-token' },
      ...overrides,
    } as unknown as Request;
  }

  describe('HEAD pre-flight short-circuit', () => {
    beforeEach(() => {
      (mockedJwt.verify as jest.Mock).mockReturnValue({ sub: 'user-123' });
    });

    it('answers an authenticated HEAD on the render route with 200 text/html without proxying to Voila', async () => {
      const req = buildAuthenticatedRequest({ method: 'HEAD' });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.end).toHaveBeenCalled();
      expect(voilaProxyService.proxyRequest).not.toHaveBeenCalled();
    });

    it('still caches the user token on a short-circuited HEAD (auth bookkeeping is unaffected)', async () => {
      const req = buildAuthenticatedRequest({ method: 'HEAD' });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(cacheService.setUserToken).toHaveBeenCalledWith('user-123', 'valid-jwt-token');
    });

    it('does not short-circuit a HEAD to a non-render path (e.g. static assets)', async () => {
      const req = buildAuthenticatedRequest({
        method: 'HEAD',
        url: '/voila-proxy/voila/api/kernels',
      });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(voilaProxyService.proxyRequest).toHaveBeenCalledWith(req, res, 'valid-jwt-token');
      expect(res.end).not.toHaveBeenCalled();
    });

    it('does not short-circuit a GET on the render route - the real request still proxies to Voila', async () => {
      const req = buildAuthenticatedRequest({ method: 'GET' });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(voilaProxyService.proxyRequest).toHaveBeenCalledWith(req, res, 'valid-jwt-token');
      expect(res.end).not.toHaveBeenCalled();
    });

    it('rejects a HEAD pre-flight with 401 when the session cookie is missing, without ever reaching the short-circuit or Voila', async () => {
      const req = buildAuthenticatedRequest({ method: 'HEAD', cookies: {} });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, error: 'Unauthorized' }),
      );
      expect(voilaProxyService.proxyRequest).not.toHaveBeenCalled();
    });

    it('rejects a HEAD pre-flight with 401 when the JWT is invalid', async () => {
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const req = buildAuthenticatedRequest({ method: 'HEAD' });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(voilaProxyService.proxyRequest).not.toHaveBeenCalled();
    });
  });

  describe('static file requests', () => {
    it('bypasses authentication for static assets regardless of method', async () => {
      const req = buildAuthenticatedRequest({
        method: 'HEAD',
        url: '/voila/static/style.css',
        cookies: {},
      });
      const res = createMockResponse();

      await controller.proxyToVoila(req, res);

      expect(voilaProxyService.proxyRequest).toHaveBeenCalledWith(req, res, '');
      expect(res.end).not.toHaveBeenCalled();
    });
  });
});
