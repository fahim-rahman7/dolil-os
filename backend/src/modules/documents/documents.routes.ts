import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, parse, wrap } from '../../utils/http.js';
import { audit, canSeeFullNid } from '../../utils/common.js';

const r = Router();

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
export const MAX_BYTES = 5 * 1024 * 1024;

/** Allowed types, verified by magic bytes rather than trusting the declared MIME type (FR-DOC-04). */
const TYPES: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: '.pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'image/png': { ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
};

/** Minimal scanning policy: reject the EICAR test signature. A real AV scanner must be integrated before production. */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
export function scanBuffer(buf: Buffer): boolean {
  return !buf.toString('latin1').includes(EICAR);
}

const ownerSchema = z.object({
  ownerType: z.enum(['CUSTOMER', 'LAND', 'DEED'], { errorMap: () => ({ message: 'Select what the file belongs to' }) }),
  ownerId: z.string().min(1, 'Owner is required'),
});

/** Customer files are typically NID scans: only roles that may see full NIDs can read them (BR-16). */
function assertReadable(req: AuthRequest, ownerType: string) {
  if (ownerType === 'CUSTOMER' && !canSeeFullNid(req.user.role)) throw new AppError(403, 'You do not have permission to view customer documents.');
}

async function assertOwner(officeId: string, ownerType: string, ownerId: string) {
  const where = { id: ownerId, officeId };
  const found =
    ownerType === 'CUSTOMER' ? await prisma.customer.findFirst({ where, select: { id: true } })
    : ownerType === 'LAND' ? await prisma.land.findFirst({ where, select: { id: true } })
    : await prisma.deed.findFirst({ where, select: { id: true } });
  if (!found) throw new AppError(404, 'The record this file belongs to was not found.');
}

r.get(
  '/',
  requirePerm('document:read'),
  wrap(async (req: AuthRequest, res) => {
    const q = parse(ownerSchema, req.query);
    assertReadable(req, q.ownerType);
    await assertOwner(req.user.officeId, q.ownerType, q.ownerId);
    const docs = await prisma.document.findMany({
      where: { officeId: req.user.officeId, ownerType: q.ownerType, ownerId: q.ownerId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, docs.map(({ storedName: _s, ...d }) => d));
  }),
);

const uploadSchema = ownerSchema.extend({
  filename: z.string().trim().min(1, 'File name is required').max(200),
  mimeType: z.string(),
  contentBase64: z.string().min(1, 'Choose a file to upload'),
});

/** The file is saved to disk before success is reported (FR-DOC-05). */
r.post(
  '/',
  requirePerm('document:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(uploadSchema, req.body);
    await assertOwner(req.user.officeId, d.ownerType, d.ownerId);
    const type = TYPES[d.mimeType];
    if (!type) throw new AppError(400, 'Unsupported file type. Upload a PDF, PNG or JPEG file.', 'VALIDATION', { file: 'Unsupported file type' });
    const buf = Buffer.from(d.contentBase64, 'base64');
    if (!buf.length) throw new AppError(400, 'The file is empty.', 'VALIDATION', { file: 'The file is empty' });
    if (buf.length > MAX_BYTES) throw new AppError(413, 'The file is larger than the 5 MB limit.', 'VALIDATION', { file: 'File is too large (max 5 MB)' });
    if (!type.magic.every((b, i) => buf[i] === b)) {
      throw new AppError(400, 'The file content does not match its type.', 'VALIDATION', { file: 'File content does not match its type' });
    }
    if (!scanBuffer(buf)) throw new AppError(422, 'The file was rejected by the security scan.', 'SCAN_REJECTED');
    const dir = path.join(UPLOAD_DIR, req.user.officeId);
    await mkdir(dir, { recursive: true });
    const storedName = `${randomUUID()}${type.ext}`;
    await writeFile(path.join(dir, storedName), buf, { flag: 'wx' });
    const doc = await prisma.document.create({
      data: {
        officeId: req.user.officeId,
        ownerType: d.ownerType,
        ownerId: d.ownerId,
        originalName: d.filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_'),
        storedName,
        mimeType: d.mimeType,
        size: buf.length,
        uploadedById: req.user.id,
      },
    });
    await audit(prisma, req, 'DOCUMENT_UPLOADED', d.ownerType === 'DEED' ? 'Deed' : 'Document', d.ownerType === 'DEED' ? d.ownerId : doc.id, {
      meta: { documentId: doc.id, ownerType: d.ownerType, ownerId: d.ownerId, size: buf.length },
    });
    const { storedName: _s, ...out } = doc;
    return ok(res, out, 201);
  }),
);

r.get(
  '/:id/download',
  requirePerm('document:read'),
  wrap(async (req: AuthRequest, res) => {
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!doc) throw new AppError(404, 'Document not found.');
    assertReadable(req, doc.ownerType);
    let buf: Buffer;
    try {
      buf = await readFile(path.join(UPLOAD_DIR, doc.officeId, doc.storedName));
    } catch {
      throw new AppError(404, 'The stored file is missing.');
    }
    await audit(prisma, req, 'DOCUMENT_DOWNLOADED', 'Document', doc.id);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
    res.send(buf);
  }),
);

export default r;
