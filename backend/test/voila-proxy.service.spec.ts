import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VoilaProxyService } from '../src/modules/voila-proxy/voila-proxy.service';
import { Request, Response } from 'express';

// Mock http-proxy
const mockProxyServer: any = jest.fn();
const eventHandlers: Record<string, (...args: any[]) => void> = {};
mockProxyServer.on = jest.fn((event: string, handler: (...args: any[]) => void) => {
  eventHandlers[event] = handler;
});

const createProxyServerMock = jest.fn((..._args: any[]) => mockProxyServer);

jest.mock('http-proxy', () => ({
  __esModule: true,
  default: {
    createProxyServer: (options: any) => createProxyServerMock(options),
  },
  createProxyServer: (options: any) => createProxyServerMock(options),
}));

describe('VoilaProxyService', () => {
  let service: VoilaProxyService;
  let configService: jest.Mocked<ConfigService>;
  const voilaBaseUrl = 'http://localhost:8866';
  let service: VoilaProxyService;
  let configService: jest.Mocked<ConfigService>;
  const voilaBaseUrl = 'http://localhost:8866';

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(eventHandlers)) {
      delete eventHandlers[key];
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoilaProxyService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(voilaBaseUrl),
          },
        },
      ],
    }).compile();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoilaProxyService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(voilaBaseUrl),
          },
        },
      ],
    }).compile();

    service = module.get<VoilaProxyService>(VoilaProxyService);
    configService = module.get(ConfigService);
  });
    service = module.get<VoilaProxyService>(VoilaProxyService);
    configService = module.get(ConfigService);
  });

  describe('constructor', () => {
    it('should read VOILA_BASE_URL from config', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('VOILA_BASE_URL');
    });
  });
  describe('constructor', () => {
    it('should read VOILA_BASE_URL from config', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('VOILA_BASE_URL');
    });
  });

  describe('onModuleInit', () => {
    it('should initialize the proxy server', async () => {
      await service.onModuleInit();

      expect(createProxyServerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target: voilaBaseUrl,
          changeOrigin: true,
        }),
      );
    });
  });

  describe('initProxy', () => {
    it('should create proxy server with correct configuration', async () => {
      await service.initProxy();

      expect(createProxyServerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target: voilaBaseUrl,
          changeOrigin: true,
        }),
      );
    });

    it('should register proxyReq, proxyRes, and error event handlers', async () => {
      await service.initProxy();

      expect(mockProxyServer.on).toHaveBeenCalledWith('proxyReq', expect.any(Function));
      expect(mockProxyServer.on).toHaveBeenCalledWith('proxyRes', expect.any(Function));
      expect(mockProxyServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should not throw when proxyReq event handler is invoked', async () => {
      await service.initProxy();

      const proxyReqHandler = eventHandlers['proxyReq'];
      expect(proxyReqHandler).toBeDefined();

      const mockProxyReq = { path: '/render/notebook.ipynb' };
      const mockReq = { method: 'GET', url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};
      const mockProxyReq = { path: '/render/notebook.ipynb' };
      const mockReq = { method: 'GET', url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};

      expect(() => proxyReqHandler(mockProxyReq, mockReq, mockRes)).not.toThrow();
    });

    it('should not throw when proxyRes event handler is invoked', async () => {
      await service.initProxy();

      const proxyResHandler = eventHandlers['proxyRes'];
      expect(proxyResHandler).toBeDefined();

      const mockProxyRes = { statusCode: 200 };
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};
      const mockProxyRes = { statusCode: 200 };
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};

      expect(() => proxyResHandler(mockProxyRes, mockReq, mockRes)).not.toThrow();
    });

    it('should handle proxy error and send 502 response', async () => {
      await service.initProxy();
    it('should handle proxy error and send 502 response', async () => {
      await service.initProxy();

      const errorHandler = eventHandlers['error'];
      expect(errorHandler).toBeDefined();

      const mockErr = new Error('ECONNREFUSED');
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const mockErr = new Error('ECONNREFUSED');
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      errorHandler(mockErr, mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({
          statusCode: 502,
          message: 'Voila server is unavailable',
          error: 'Bad Gateway',
        }),
      );
    });
      expect(mockRes.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({
          statusCode: 502,
          message: 'Voila server is unavailable',
          error: 'Bad Gateway',
        }),
      );
    });

    it('should handle proxy error when response has no writeHead', async () => {
      await service.initProxy();
    it('should handle proxy error when response has no writeHead', async () => {
      await service.initProxy();

      const errorHandler = eventHandlers['error'];
      expect(errorHandler).toBeDefined();

      const mockErr = new Error('ECONNREFUSED');
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};
      const mockErr = new Error('ECONNREFUSED');
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};

      expect(() => errorHandler(mockErr, mockReq, mockRes)).not.toThrow();
    });
  });

  describe('proxyRequest', () => {
    beforeEach(async () => {
      await service.initProxy();
      mockProxyServer.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
        next();
      });
    });

    it('should append service_token to URL without existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;
    it('should append service_token to URL without existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token-123');
      await service.proxyRequest(mockReq, mockRes, 'test-token-123');

      expect(mockReq.url).toContain('?service_token=test-token-123');
      expect(mockReq.headers['x-service-token']).toBe('test-token-123');
    });
      expect(mockReq.url).toContain('?service_token=test-token-123');
      expect(mockReq.headers['x-service-token']).toBe('test-token-123');
    });

    it('should append service_token to URL with existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb?param=value',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;
    it('should append service_token to URL with existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb?param=value',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token-123');
      await service.proxyRequest(mockReq, mockRes, 'test-token-123');

      expect(mockReq.url).toContain('&service_token=test-token-123');
    });
      expect(mockReq.url).toContain('&service_token=test-token-123');
    });

    it('should not append service_token for empty token (static files)', async () => {
      const originalUrl = '/voila/static/style.css';
      const mockReq = {
        url: originalUrl,
        headers: { host: 'localhost:3000' },
      } as unknown as Request;
    it('should not append service_token for empty token (static files)', async () => {
      const originalUrl = '/voila/static/style.css';
      const mockReq = {
        url: originalUrl,
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, '');
      await service.proxyRequest(mockReq, mockRes, '');

      expect(mockReq.url).toBe(originalUrl);
    });
      expect(mockReq.url).toBe(originalUrl);
    });

    it('should call proxy server and resolve on success', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;
      const mockRes = {} as Response;

      await expect(service.proxyRequest(mockReq, mockRes, 'token')).resolves.toBeUndefined();
      expect(mockProxyServer).toHaveBeenCalled();
    });

    it('should reject when proxy server returns an error', async () => {
      mockProxyServer.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
        next(new Error('Connection refused'));
      });

      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await expect(service.proxyRequest(mockReq, mockRes, 'token')).rejects.toThrow('Proxy error: Connection refused');
    });
      await expect(service.proxyRequest(mockReq, mockRes, 'token')).rejects.toThrow('Proxy error: Connection refused');
    });

    it('should encode service_token in the URL', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;
    it('should encode service_token in the URL', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      const tokenWithSpecialChars = 'token with spaces&special=chars';
      await service.proxyRequest(mockReq, mockRes, tokenWithSpecialChars);
      const tokenWithSpecialChars = 'token with spaces&special=chars';
      await service.proxyRequest(mockReq, mockRes, tokenWithSpecialChars);

      expect(mockReq.url).toContain(encodeURIComponent(tokenWithSpecialChars));
    });
  });
      expect(mockReq.url).toContain(encodeURIComponent(tokenWithSpecialChars));
    });
  });
});
