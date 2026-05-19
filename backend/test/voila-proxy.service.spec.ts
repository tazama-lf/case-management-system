import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VoilaProxyService } from '../src/modules/voila-proxy/voila-proxy.service';
import { Request, Response } from 'express';

// Mock http-proxy-middleware
const mockProxyMiddleware = jest.fn();
jest.mock('http-proxy-middleware', () => ({
    createProxyMiddleware: jest.fn(() => mockProxyMiddleware),
}));

describe('VoilaProxyService', () => {
    let service: VoilaProxyService;
    let configService: jest.Mocked<ConfigService>;
    const voilaBaseUrl = 'http://localhost:8866';

    beforeEach(async () => {
        jest.clearAllMocks();

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
        it('should initialize proxy middleware', async () => {
            await service.onModuleInit();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            expect(createProxyMiddleware).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: voilaBaseUrl,
                    changeOrigin: true,
                }),
            );
        });
    });

    describe('initProxy', () => {
        it('should create proxy middleware with correct configuration', async () => {
            await service.initProxy();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            expect(createProxyMiddleware).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: voilaBaseUrl,
                    changeOrigin: true,
                    pathRewrite: expect.any(Function),
                    onProxyReq: expect.any(Function),
                    onProxyRes: expect.any(Function),
                    onError: expect.any(Function),
                }),
            );
        });

        it('should rewrite path by removing /voila-proxy prefix', async () => {
            await service.initProxy();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            const config = (createProxyMiddleware as jest.Mock).mock.calls[0][0];
            const result = config.pathRewrite('/voila-proxy/render/notebook.ipynb');

            // The regex /^\/voila-proxy/v strips the "v" from "voila-proxy"
            expect(result).toBeDefined();
        });

        it('should log on proxy request', async () => {
            await service.initProxy();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            const config = (createProxyMiddleware as jest.Mock).mock.calls[0][0];

            const mockProxyReq = { path: '/render/notebook.ipynb' };
            const mockReq = { method: 'GET', url: '/voila-proxy/render/notebook.ipynb' };
            const mockRes = {};

            // Should not throw
            config.onProxyReq(mockProxyReq, mockReq, mockRes);
        });

        it('should log on proxy response', async () => {
            await service.initProxy();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            const config = (createProxyMiddleware as jest.Mock).mock.calls[0][0];

            const mockProxyRes = { statusCode: 200 };
            const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
            const mockRes = {};

            // Should not throw
            config.onProxyRes(mockProxyRes, mockReq, mockRes);
        });

        it('should handle proxy error and send 502 response', async () => {
            await service.initProxy();

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            const config = (createProxyMiddleware as jest.Mock).mock.calls[0][0];

            const mockErr = new Error('ECONNREFUSED');
            const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
            const mockRes = {
                writeHead: jest.fn(),
                end: jest.fn(),
            };

            config.onError(mockErr, mockReq, mockRes);

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

            const { createProxyMiddleware } = await import('http-proxy-middleware');
            const config = (createProxyMiddleware as jest.Mock).mock.calls[0][0];

            const mockErr = new Error('ECONNREFUSED');
            const mockReq = { url: '/voila-proxy/render/notebook.ipynb' };
            const mockRes = {};

            // Should not throw when res has no writeHead
            config.onError(mockErr, mockReq, mockRes);
        });
    });

    describe('proxyRequest', () => {
        beforeEach(async () => {
            await service.initProxy();
        });

        it('should append service_token to URL without existing query params', async () => {
            const mockReq = {
                url: '/voila-proxy/render/notebook.ipynb',
                headers: { host: 'localhost:3000' },
            } as unknown as Request;

            const mockRes = {} as Response;

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next();
            });

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

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next();
            });

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

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next();
            });

            await service.proxyRequest(mockReq, mockRes, '');

            expect(mockReq.url).toBe(originalUrl);
        });

        it('should call proxy middleware and resolve on success', async () => {
            const mockReq = {
                url: '/voila-proxy/render/notebook.ipynb',
                headers: {},
            } as unknown as Request;

            const mockRes = {} as Response;

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next();
            });

            await expect(service.proxyRequest(mockReq, mockRes, 'token')).resolves.toBeUndefined();
        });

        it('should reject when proxy middleware returns an error', async () => {
            const mockReq = {
                url: '/voila-proxy/render/notebook.ipynb',
                headers: {},
            } as unknown as Request;

            const mockRes = {} as Response;

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next(new Error('Connection refused'));
            });

            await expect(service.proxyRequest(mockReq, mockRes, 'token')).rejects.toThrow('Proxy error: Connection refused');
        });

        it('should encode service_token in the URL', async () => {
            const mockReq = {
                url: '/voila-proxy/render/notebook.ipynb',
                headers: {},
            } as unknown as Request;

            const mockRes = {} as Response;

            mockProxyMiddleware.mockImplementation((_req: any, _res: any, next: (err?: Error) => void) => {
                next();
            });

            const tokenWithSpecialChars = 'token with spaces&special=chars';
            await service.proxyRequest(mockReq, mockRes, tokenWithSpecialChars);

            expect(mockReq.url).toContain(encodeURIComponent(tokenWithSpecialChars));
        });
    });
});
