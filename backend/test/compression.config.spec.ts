import express from 'express';
import request from 'supertest';
import { responseCompression } from '../src/config/compression.config';

const BODY = 'var a = {"x": [1, 2, 3, 4, 5], "y": "some compressible text"};\n'.repeat(2000);

const createApp = (): express.Express => {
  const app = express();
  app.use(responseCompression());
  app.get('/full', (_req, res) => {
    res.type('text/javascript').send(BODY);
  });
  app.get('/partial', (_req, res) => {
    res.status(206).type('text/javascript').set('Content-Range', `bytes 0-${BODY.length - 1}/${BODY.length * 2}`).send(BODY);
  });
  return app;
};

describe('responseCompression', () => {
  it('compresses an ordinary response when the client accepts gzip', async () => {
    const res = await request(createApp()).get('/full').set('Accept-Encoding', 'gzip').expect(200);

    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('leaves a 206 Partial Content response uncompressed', async () => {
    const res = await request(createApp()).get('/partial').set('Accept-Encoding', 'gzip').expect(206);

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['content-range']).toBe(`bytes 0-${BODY.length - 1}/${BODY.length * 2}`);
    expect(res.text).toBe(BODY);
  });
});
