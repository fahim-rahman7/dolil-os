import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, pageMeta, pageParams, parse, wrap } from '../../utils/http.js';
import { audit, D, optText } from '../../utils/common.js';
import { paymentTotals } from '../../utils/deedService.js';
import { dateRange } from '../reports/range.js';

const r = Router();
r.use(requirePerm('payment:read'));

const receiptNo = () => {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `RC-${d}-${randomBytes(4).toString('hex').toUpperCase()}`;
};

const include = {
  deed: { select: { id: true, title: true, deedNumber: true, deedType: true, status: true } },
  receivedBy: { select: { name: true } },
  reversedBy: { select: { id: true, receiptNo: true } },
} as const;

r.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const p = pageParams(req.query);
    const { gte, lte } = dateRange(req.query.from, req.query.to);
    const method = String(req.query.method ?? '');
    const where: Prisma.PaymentWhereInput = {
      officeId: req.user.officeId,
      ...(req.query.deedId ? { deedId: String(req.query.deedId) } : {}),
      ...(['CASH', 'BANK', 'MOBILE'].includes(method) ? { method: method as any } : {}),
      ...(gte || lte ? { paidAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, include, orderBy: { paidAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.payment.count({ where }),
    ]);
    return ok(res, rows.map((x) => ({ ...x, reversed: !!x.reversedBy })), 200, pageMeta(p, total));
  }),
);

const createSchema = z.object({
  deedId: z.string({ required_error: 'Select a deed' }).min(1, 'Select a deed'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount greater than zero' })
    .gt(0, 'Enter an amount greater than zero')
    .max(99999999999999, 'Amount is too large')
    .refine((n) => Math.round(n * 100) / 100 === n, 'Amount can have at most 2 decimal places'),
  method: z.enum(['CASH', 'BANK', 'MOBILE'], { errorMap: () => ({ message: 'Select a payment method' }) }),
  reference: optText(100),
  note: optText(1000),
  paidAt: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z
      .string()
      .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid payment date')
      .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60 * 1000, 'Payment date cannot be in the future')
      .optional(),
  ),
  confirmOverpayment: z.boolean().optional(),
});

const PAYMENT_ERROR = 'Enter an amount greater than zero and select a valid deed.';

r.post(
  '/',
  requirePerm('payment:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = (() => {
      try {
        return parse(createSchema, req.body);
      } catch (e) {
        if (e instanceof AppError && (e.errors?.amount || e.errors?.deedId)) {
          throw new AppError(400, PAYMENT_ERROR, 'VALIDATION', e.errors);
        }
        throw e;
      }
    })();
    const deed = await prisma.deed.findFirst({ where: { id: d.deedId, officeId: req.user.officeId } });
    if (!deed) throw new AppError(400, PAYMENT_ERROR, 'VALIDATION', { deedId: 'Select a valid deed' });
    if (deed.status === 'CANCELLED') {
      throw new AppError(409, 'This deed is cancelled and cannot receive new payments.', 'DEED_CANCELLED', { deedId: 'Deed is cancelled' });
    }
    const received = (await paymentTotals(prisma, [deed.id])).get(deed.id) ?? D(0);
    if (deed.agreedFee != null && received.add(d.amount).gt(deed.agreedFee) && !d.confirmOverpayment) {
      const due = D(deed.agreedFee).sub(received);
      throw new AppError(
        409,
        `This payment exceeds the outstanding due (৳ ${due.lt(0) ? '0.00' : due.toFixed(2)}). Confirm to record it anyway.`,
        'OVERPAYMENT',
      );
    }
    let payment;
    for (let attempt = 0; ; attempt++) {
      try {
        payment = await prisma.$transaction(async (tx) => {
          const p = await tx.payment.create({
            data: {
              officeId: req.user.officeId,
              deedId: deed.id,
              amount: d.amount,
              method: d.method,
              reference: d.reference ?? null,
              note: d.note ?? null,
              paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
              receiptNo: receiptNo(),
              receivedById: req.user.id,
            },
            include,
          });
          await audit(tx, req, 'PAYMENT_CREATED', 'Payment', p.id, { meta: { deedId: deed.id, amount: d.amount, method: d.method, receiptNo: p.receiptNo } });
          return p;
        });
        break;
      } catch (e) {
        if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    const total = (await paymentTotals(prisma, [deed.id])).get(deed.id) ?? D(0);
    return ok(res, { ...payment, totalReceived: total.toFixed(2), due: deed.agreedFee != null ? D(deed.agreedFee).sub(total).toFixed(2) : null }, 201);
  }),
);

/** Receipt data (FR-PAY-05). Registered before '/:id' is irrelevant here: no conflicting literal routes. */
r.get(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const p = await prisma.payment.findFirst({ where: { id: req.params.id, officeId: req.user.officeId }, include });
    if (!p) throw new AppError(404, 'Receipt not found.');
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    const deed = await prisma.deed.findUniqueOrThrow({ where: { id: p.deedId }, select: { agreedFee: true } });
    const total = (await paymentTotals(prisma, [p.deedId])).get(p.deedId) ?? D(0);
    return ok(res, {
      ...p,
      reversed: !!p.reversedBy,
      office: { name: office.name, phone: office.phone, email: office.email, address: office.address },
      totalReceived: total.toFixed(2),
      due: deed.agreedFee != null ? D(deed.agreedFee).sub(total).toFixed(2) : null,
    });
  }),
);

/** BR-09: payments are append-only; a correction is a linked reversal entry. */
r.post(
  '/:id/reverse',
  requirePerm('payment:write'),
  wrap(async (req: AuthRequest, res) => {
    const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'A reason is required').max(500) }), req.body);
    const rev = await prisma.$transaction(async (tx) => {
      const orig = await tx.payment.findFirst({ where: { id: req.params.id, officeId: req.user.officeId }, include: { reversedBy: true } });
      if (!orig) throw new AppError(404, 'Payment not found.');
      if (orig.type !== 'PAYMENT') throw new AppError(409, 'A reversal entry cannot itself be reversed.', 'NOT_REVERSIBLE');
      if (orig.reversedBy) throw new AppError(409, 'This payment has already been reversed.', 'ALREADY_REVERSED');
      const p = await tx.payment.create({
        data: {
          officeId: req.user.officeId,
          deedId: orig.deedId,
          type: 'REVERSAL',
          amount: orig.amount,
          method: orig.method,
          reference: orig.receiptNo,
          note: `Reversal of ${orig.receiptNo}: ${reason}`,
          receiptNo: receiptNo(),
          reversesId: orig.id,
          receivedById: req.user.id,
        },
        include,
      });
      await audit(tx, req, 'PAYMENT_REVERSED', 'Payment', orig.id, { reason, meta: { reversalId: p.id, amount: orig.amount.toString() } });
      return p;
    });
    return ok(res, rev, 201);
  }),
);

export default r;
