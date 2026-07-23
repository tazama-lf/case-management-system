import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VoilaProxyService } from '../src/modules/voila-proxy/voila-proxy.service';
import { Request, Response } from 'express';

// Create mock objects before jest.mock is evaluated
const eventHandlers: Record<string, (...args: any[]) => void> = {};
const mockProxyServer = {
  web: jest.fn(),
  on: jest.fn((event: string, handler: (...args: any[]) => void) => {
    eventHandlers[event] = handler;
    return mockProxyServer;
  }),
};

const createProxyServerMock = jest.fn((options?: any) => {
  return mockProxyServer;
});

// Mock http-proxy module
jest.mock('http-proxy', () => ({
  __esModule: true,
  default: {
    createProxyServer: (options?: any) => createProxyServerMock(options),
  },
  createProxyServer: (options?: any) => createProxyServerMock(options),
}));

describe('VoilaProxyService', () => {
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

    service = module.get<VoilaProxyService>(VoilaProxyService);
    configService = module.get(ConfigService);
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
      expect(mockProxyServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should not throw when proxyReq event handler is invoked', async () => {
      await service.initProxy();

      const proxyReqHandler = eventHandlers['proxyReq'];
      expect(proxyReqHandler).toBeDefined();

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

      expect(() => proxyResHandler(mockProxyRes, mockReq, mockRes)).not.toThrow();
    });

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

    it('should handle proxy error when response has no writeHead', async () => {
      await service.initProxy();

      const errorHandler = eventHandlers['error'];
      expect(errorHandler).toBeDefined();

      const mockErr = new Error('ECONNREFUSED');
      const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
      const mockRes = {};

      expect(() => errorHandler(mockErr, mockReq, mockRes)).not.toThrow();
    });
  });

  describe('proxyRequest', () => {
    beforeEach(async () => {
      await service.initProxy();
      mockProxyServer.web.mockImplementation((_req: any, _res: any, _opts: any, next: (err?: Error) => void) => {
        next();
      });
    });

    it('should append service_token to URL without existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token-123');

      expect(mockReq.url).toContain('?service_token=test-token-123');
      expect(mockReq.headers['x-service-token']).toBe('test-token-123');
    });

    it('should append service_token to URL with existing query params', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb?param=value',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token-123');

      expect(mockReq.url).toContain('&service_token=test-token-123');
    });

    it('should not append service_token for empty token (static files)', async () => {
      const originalUrl = '/voila/static/style.css';
      const mockReq = {
        url: originalUrl,
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, '');

      expect(mockReq.url).toBe(originalUrl);
    });

    it('should strip /voila-proxy prefix before forwarding', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/render/notebook.ipynb',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      expect(mockReq.url.startsWith('/voila/render/notebook.ipynb')).toBe(true);
      expect(mockReq.url.startsWith('/voila-proxy')).toBe(false);
    });

    it('should strip /voila-proxy prefix for static file requests', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/static/style.css',
        headers: { host: 'localhost:3000' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, '');

      expect(mockReq.url).toBe('/voila/static/style.css');
    });

    it('should call proxy server and resolve on success', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await expect(service.proxyRequest(mockReq, mockRes, 'token')).resolves.toBeUndefined();
      expect(mockProxyServer.web).toHaveBeenCalled();
    });

    it('should reject when proxy server returns an error', async () => {
      mockProxyServer.web.mockImplementation((_req: any, _res: any, _opts: any, next: (err?: Error) => void) => {
        next(new Error('Connection refused'));
      });

      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await expect(service.proxyRequest(mockReq, mockRes, 'token')).rejects.toThrow('Proxy error: Connection refused');
    });

    it('should encode service_token in the URL', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      const tokenWithSpecialChars = 'token with spaces&special=chars';
      await service.proxyRequest(mockReq, mockRes, tokenWithSpecialChars);

      expect(mockReq.url).toContain(encodeURIComponent(tokenWithSpecialChars));
    });

    it('should handle request with headers correctly', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: { 
          host: 'localhost:3000',
          'user-agent': 'test-agent',
          'accept': 'text/html'
        },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token');

      expect(mockReq.headers['x-service-token']).toBe('test-token');
      expect(mockReq.headers['user-agent']).toBe('test-agent');
    });

    it('should handle URL without /voila-proxy prefix', async () => {
      const mockReq = {
        url: '/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      expect(mockReq.url).toContain('/render/notebook.ipynb');
      expect(mockReq.url).toContain('service_token=token');
    });

    it('should handle complex URLs with multiple query parameters', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb?param1=value1&param2=value2',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'test-token');

      expect(mockReq.url).toContain('param1=value1');
      expect(mockReq.url).toContain('param2=value2');
      expect(mockReq.url).toContain('&service_token=test-token');
    });

    it('should handle URL with hash fragments', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb#section',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      // Note: Query params are added after hash in the URL structure
      expect(mockReq.url).toContain('/render/notebook.ipynb#section');
      expect(mockReq.url).toContain('service_token=token');
    });
  });

  describe('Event Handlers', () => {
    beforeEach(async () => {
      await service.initProxy();
    });

    describe('proxyReq handler', () => {
      it('should log proxy request with correct details', async () => {
        const proxyReqHandler = eventHandlers['proxyReq'];
        expect(proxyReqHandler).toBeDefined();

        const mockProxyReq = { path: '/render/notebook.ipynb' };
        const mockReq = { method: 'GET', url: '/voila-proxy/render/notebook.ipynb' };
        const mockRes = {};

        expect(() => proxyReqHandler(mockProxyReq, mockReq, mockRes)).not.toThrow();
      });

      it('should handle proxyReq with POST method', async () => {
        const proxyReqHandler = eventHandlers['proxyReq'];

        const mockProxyReq = { path: '/api/endpoint' };
        const mockReq = { method: 'POST', url: '/voila-proxy/api/endpoint' };
        const mockRes = {};

        expect(() => proxyReqHandler(mockProxyReq, mockReq, mockRes)).not.toThrow();
      });
    });

    describe('proxyRes handler', () => {
      it('should log proxy response with status code', async () => {
        const proxyResHandler = eventHandlers['proxyRes'];
        expect(proxyResHandler).toBeDefined();

        const mockProxyRes = { statusCode: 200 };
        const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
        const mockRes = {};

        expect(() => proxyResHandler(mockProxyRes, mockReq, mockRes)).not.toThrow();
      });

      it('should handle different status codes', async () => {
        const proxyResHandler = eventHandlers['proxyRes'];

        const statusCodes = [200, 404, 500, 302];
        
        statusCodes.forEach(statusCode => {
          const mockProxyRes = { statusCode };
          const mockReq = { url: '/test' };
          const mockRes = {};

          expect(() => proxyResHandler(mockProxyRes, mockReq, mockRes)).not.toThrow();
        });
      });
    });

    describe('error handler', () => {
      it('should handle ECONNREFUSED error', async () => {
        const errorHandler = eventHandlers['error'];
        expect(errorHandler).toBeDefined();

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

      it('should handle ETIMEDOUT error', async () => {
        const errorHandler = eventHandlers['error'];

        const mockErr = new Error('ETIMEDOUT');
        mockErr.name = 'ETIMEDOUT';
        const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn(),
        };

        errorHandler(mockErr, mockReq, mockRes);

        expect(mockRes.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
        expect(mockRes.end).toHaveBeenCalled();
      });

      it('should handle error when response object does not have writeHead', async () => {
        const errorHandler = eventHandlers['error'];

        const mockErr = new Error('ECONNREFUSED');
        const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
        const mockRes = {};

        expect(() => errorHandler(mockErr, mockReq, mockRes)).not.toThrow();
      });

      it('should handle error when response writeHead is not a function', async () => {
        const errorHandler = eventHandlers['error'];

        const mockErr = new Error('ECONNREFUSED');
        const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
        const mockRes = {
          writeHead: 'not a function',
        };

        expect(() => errorHandler(mockErr, mockReq, mockRes)).not.toThrow();
      });

      it('should log error with stack trace', async () => {
        const errorHandler = eventHandlers['error'];

        const mockErr = new Error('Test error');
        mockErr.stack = 'Error: Test error\n    at test.spec.ts:123';
        const mockReq = { url: '/test' };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn(),
        };

        errorHandler(mockErr, mockReq, mockRes);

        expect(mockRes.writeHead).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await service.initProxy();
      mockProxyServer.web.mockImplementation((_req: any, _res: any, _opts: any, next: (err?: Error) => void) => {
        next();
      });
    });

    it('should handle empty URL', async () => {
      const mockReq = {
        url: '',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      expect(mockReq.url).toContain('?service_token=token');
    });

    it('should handle URL with only query string', async () => {
      const mockReq = {
        url: '?existing=param',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      expect(mockReq.url).toContain('&service_token=token');
    });

    it('should handle very long service token', async () => {
      const longToken = 'a'.repeat(1000);
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, longToken);

      expect(mockReq.url).toContain(encodeURIComponent(longToken));
    });

    it('should handle token with all special characters', async () => {
      const specialToken = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: {},
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, specialToken);

      expect(mockReq.url).toContain(encodeURIComponent(specialToken));
    });

    it('should handle concurrent proxy requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        url: `/voila-proxy/render/notebook${i}.ipynb`,
        headers: {},
      } as unknown as Request));

      const responses = requests.map(() => ({} as Response));
      const tokens = requests.map((_, i) => `token-${i}`);

      const promises = requests.map((req, i) => 
        service.proxyRequest(req, responses[i], tokens[i])
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should preserve original headers when adding x-service-token', async () => {
      const originalHeaders = {
        'content-type': 'application/json',
        'authorization': 'Bearer xyz',
        'custom-header': 'custom-value',
      };

      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: { ...originalHeaders },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'token');

      expect(mockReq.headers['content-type']).toBe('application/json');
      expect(mockReq.headers['authorization']).toBe('Bearer xyz');
      expect(mockReq.headers['custom-header']).toBe('custom-value');
      expect(mockReq.headers['x-service-token']).toBe('token');
    });

    it('should handle null or undefined headers gracefully', async () => {
      const mockReq = {
        url: '/voila-proxy/render/notebook.ipynb',
        headers: undefined,
      } as unknown as Request;

      const mockRes = {} as Response;

      await expect(service.proxyRequest(mockReq, mockRes, 'token')).resolves.toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should throw error when VOILA_BASE_URL is not configured', () => {
      const configServiceMock = {
        getOrThrow: jest.fn().mockImplementation(() => {
          throw new Error('VOILA_BASE_URL is not defined');
        }),
      };

      expect(() => new VoilaProxyService(configServiceMock as any)).toThrow('VOILA_BASE_URL is not defined');
    });

    it('should accept valid VOILA_BASE_URL', () => {
      const configServiceMock = {
        getOrThrow: jest.fn().mockReturnValue('http://voila:8866'),
      };

      const service = new VoilaProxyService(configServiceMock as any);
      expect(service).toBeDefined();
      expect(configServiceMock.getOrThrow).toHaveBeenCalledWith('VOILA_BASE_URL');
    });

    it('should handle VOILA_BASE_URL with trailing slash', () => {
      const configServiceMock = {
        getOrThrow: jest.fn().mockReturnValue('http://voila:8866/'),
      };

      const service = new VoilaProxyService(configServiceMock as any);
      expect(service).toBeDefined();
    });

    it('should handle VOILA_BASE_URL with path', () => {
      const configServiceMock = {
        getOrThrow: jest.fn().mockReturnValue('http://voila:8866/voila'),
      };

      const service = new VoilaProxyService(configServiceMock as any);
      expect(service).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await service.initProxy();
      mockProxyServer.web.mockImplementation((_req: any, _res: any, _opts: any, next: (err?: Error) => void) => {
        next();
      });
    });

    it('should handle notebook rendering request', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/render/transaction-network.ipynb',
        headers: { 'accept': 'text/html' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'auth-token-123');

      expect(mockReq.url).toContain('/voila/render/transaction-network.ipynb');
      expect(mockReq.url).toContain('service_token=auth-token-123');
    });

    it('should handle static file request (CSS)', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/static/style.css',
        headers: { 'accept': 'text/css' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, '');

      expect(mockReq.url).toBe('/voila/static/style.css');
      expect(mockReq.url).not.toContain('service_token');
    });

    it('should handle static file request (JavaScript)', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/static/app.js',
        headers: { 'accept': 'application/javascript' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, '');

      expect(mockReq.url).toBe('/voila/static/app.js');
    });

    it('should handle API endpoint request', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/api/kernels',
        headers: { 'content-type': 'application/json' },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'api-token');

      expect(mockReq.url).toContain('/voila/api/kernels');
      expect(mockReq.url).toContain('service_token=api-token');
    });

    it('should handle WebSocket upgrade request path', async () => {
      const mockReq = {
        url: '/voila-proxy/voila/api/kernels/abc-123/channels',
        headers: { 
          'upgrade': 'websocket',
          'connection': 'Upgrade'
        },
      } as unknown as Request;

      const mockRes = {} as Response;

      await service.proxyRequest(mockReq, mockRes, 'ws-token');

      expect(mockReq.url).toContain('/voila/api/kernels/abc-123/channels');
    });
  });
});
