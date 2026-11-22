import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const ok = (res: Response, data: unknown, status = 200, meta?: unknown) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

export const fail = (res: Response, message: string, status = 400, extra: Record<string, unknown> = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/** Express 4 does not catch rejected promises: wrap every async handler. */
export const wrap =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Validate with zod; throws a 400 AppError whose `errors` map field -> message. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  const first = Object.values(errors)[0] || 'Invalid request';
  throw new AppError(400, first, 'VALIDATION', errors);
}

export function pageParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit ?? '20'), 10) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export const pageMeta = (p: { page: number; limit: number }, total: number) => ({
  page: p.page,
  limit: p.limit,
  total,
  pages: Math.max(1, Math.ceil(total / p.limit)),
});
