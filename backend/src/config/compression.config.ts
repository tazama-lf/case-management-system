import compression from 'compression';
import type { Request, RequestHandler, Response } from 'express';

// A 206 (Partial Content) response is left alone: its Content-Range gives byte offsets of the uncompressed body, which a gzipped range would not match
export const shouldCompress = (req: Request, res: Response): boolean => res.statusCode !== 206 && compression.filter(req, res);

export const responseCompression = (): RequestHandler => compression({ filter: shouldCompress });
