import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { securityHeaders } from '../src/config/security-headers.config';

@Controller()
class PingController {
  @Get('ping')
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

const FRONTEND_ORIGINS = ['http://localhost:5175', 'https://cms.example.com'];

const createApp = async (isProduction: boolean): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(securityHeaders(FRONTEND_ORIGINS, isProduction));
  await app.init();
  return app;
};

const getCsp = async (app: INestApplication): Promise<string> => {
  const res = await request(app.getHttpServer()).get('/ping').expect(200);
  return res.headers['content-security-policy'] as string;
};

describe('securityHeaders', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('sets the five browser hardening headers', async () => {
    app = await createApp(false);

    const res = await request(app.getHttpServer()).get('/ping').expect(200);

    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/u);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/u);
  });

  it('lets only itself and the configured frontend origins frame its responses', async () => {
    app = await createApp(false);

    const csp = await getCsp(app);

    expect(csp).toMatch(/frame-ancestors 'self' http:\/\/localhost:5175 https:\/\/cms\.example\.com(;|$)/u);
    expect(csp).not.toMatch(/frame-ancestors 'none'/u);
  });

  it('omits upgrade-insecure-requests outside production', async () => {
    app = await createApp(false);

    expect(await getCsp(app)).not.toMatch(/upgrade-insecure-requests/u);
  });

  it('includes upgrade-insecure-requests in production', async () => {
    app = await createApp(true);

    expect(await getCsp(app)).toMatch(/upgrade-insecure-requests/u);
  });
});
