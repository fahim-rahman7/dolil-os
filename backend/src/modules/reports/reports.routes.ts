import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { ok, wrap } from '../../utils/http.js';
import { audit, csvDoc, csvLine, D } from '../../utils/common.js';
import { can } from '../../utils/permissions.js';
import { dateRange, rangeWhere } from './range.js';

const r = Router();

/** Dashboard / report summary, scoped to the office and optional date range. Payment figures only for payment roles. */
r.get(
  '/summary',
  wrap(async (req: AuthRequest, res) => {
    const range = dateRange(req.query.from, req.query.to);
    const officeId = req.user.officeId;
    const deedWhere = { officeId, ...rangeWhere('createdAt', range) };
    const [deeds, customers, pending, completed, cancelled] = await Promise.all([
      prisma.deed.count({ where: deedWhere }),
      prisma.customer.count({ where: { officeId, active: true, ...rangeWhere('createdAt', range) } }),
      prisma.deed.count({ where: { ...deedWhere, status: { in: ['DRAFT', 'REVIEW', 'READY'] } } }),
      prisma.deed.count({ where: { ...deedWhere, status: { in: ['PRINTED', 'DELIVERED'] } } }),
      prisma.deed.count({ where: { ...deedWhere, status: 'CANCELLED' } }),
    ]);
    const out: Record<string, unknown> = { deeds, customers, pending, completed, cancelled };
    if (can(req.user.role, 'payment:read')) {
      const rows = await prisma.payment.groupBy({
        by: ['type'],
        where: { officeId, ...rangeWhere('paidAt', range) },
        _sum: { amount: true },
      });
      const sum = (t: string) => D(rows.find((x) => x.type === t)?._sum.amount ?? 0);
      out.totalPayments = sum('PAYMENT').sub(sum('REVERSAL')).toFixed(2);
    }
    return ok(res, out);
  }),
);

r.get(
  '/csv',
  requirePerm('report:deeds'),
  wrap(async (req: AuthRequest, res) => {
    const range = dateRange(req.query.from, req.query.to);
    const rows = await prisma.deed.findMany({
      where: { officeId: req.user.officeId, ...rangeWhere('createdAt', range) },
      orderBy: { createdAt: 'desc' },
    });
    const lines = [
      csvLine(['Deed number', 'Title', 'Type', 'Status', 'Land value (BDT)', 'Created at (UTC)', 'Parties']),
      ...rows.map((x) =>
        csvLine([
          x.deedNumber ?? '',
          x.title,
          x.deedType,
          x.status,
          D(x.landValue).toFixed(2),
          x.createdAt.toISOString(),
          ((x.snapshot as any)?.parties ?? []).map((p: any) => `${p.name} (${p.role})`).join('; '),
        ]),
      ),
    ];
    await audit(prisma, req, 'REPORT_EXPORTED', 'Report', null, { meta: { kind: 'deeds', rows: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dolil-os-deeds-report.csv"');
    res.send(csvDoc(lines));
  }),
);

r.get(
  '/payments-csv',
  requirePerm('report:payments'),
  wrap(async (req: AuthRequest, res) => {
    const range = dateRange(req.query.from, req.query.to);
    const rows = await prisma.payment.findMany({
      where: { officeId: req.user.officeId, ...rangeWhere('paidAt', range) },
      include: { deed: { select: { title: true, deedNumber: true } }, receivedBy: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
    });
    const lines = [
      csvLine(['Receipt', 'Type', 'Deed', 'Deed number', 'Amount (BDT)', 'Method', 'Reference', 'Paid at (UTC)', 'Received by', 'Note']),
      ...rows.map((x) =>
        csvLine([
          x.receiptNo,
          x.type,
          x.deed.title,
          x.deed.deedNumber ?? '',
          `${x.type === 'REVERSAL' ? '-' : ''}${D(x.amount).toFixed(2)}`,
          x.method,
          x.reference ?? '',
          x.paidAt.toISOString(),
          x.receivedBy.name,
          x.note ?? '',
        ]),
      ),
    ];
    await audit(prisma, req, 'REPORT_EXPORTED', 'Report', null, { meta: { kind: 'payments', rows: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dolil-os-payments-report.csv"');
    res.send(csvDoc(lines));
  }),
);

export default r;
