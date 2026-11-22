import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/http.js';

export function requestId(req: Request & { id?: string }, res: Response, next: NextFunction) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const started = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const user = (req as any).user?.id ?? '-';
    // Never log bodies/headers: they may contain passwords, NIDs or tokens.
    console.log(`[${req.id}] user=${user} ${req.method} ${req.path} -> ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

export function errors(err: unknown, req: Request & { id?: string }, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A record with this unique value already exists.' });
    }
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found.' });
  }
  if ((err as any)?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }
  if ((err as any)?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request is too large.' });
  }
  console.error(`[${req.id}]`, err instanceof Error ? err.message : err);
  res.status(500).json({ success: false, message: 'Something went wrong on the server. Please try again.' });
}
