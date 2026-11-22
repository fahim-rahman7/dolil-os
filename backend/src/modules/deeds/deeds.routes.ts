import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type Deed, type DeedStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest, type AuthUser } from '../../middleware/auth.js';
import { AppError, ok, pageMeta, pageParams, parse, wrap } from '../../utils/http.js';
import { audit, canSeeFullNid, D, maskNid, money, optText, reqText, type Db } from '../../utils/common.js';
import { DEED_TYPE_NAMES, PARTY_ROLES, getDeedType } from '../../utils/deedTypes.js';
import { DEFAULT_AREA_CONFIG, readAreaConfig } from '../../utils/areas.js';
import { findMissingDetailed, hasUnresolvedPlaceholders, PLACEHOLDER_RE, type Snapshot } from '../../utils/draft.js';
import {
  buildSnapshot, getDeedOr404, nextDeedNumber, paymentTotals, renderForDeed, type LandInput, type PartyInput,
} from '../../utils/deedService.js';
import {
  EDITABLE_STATUSES, FINAL_STATUSES, INVALID_TRANSITION_MESSAGE, TRANSITIONS, needsReason, transitionAllowedForRole,
} from '../../utils/transitions.js';
import { can } from '../../utils/permissions.js';
import { calcInputSchema, calculate } from '../calc/calc.service.js';
import type { FeeLine } from '../../utils/fees.js';
import { buildBnDeed } from '../../docs/bnDeed.js';
import { renderBnHtml } from '../../docs/bnHtml.js';
import { renderBnDocx } from '../../docs/bnDocx.js';
import { htmlToPdf } from '../../utils/pdf.js';

const r = Router();

// ------------------------------------------------------------------ schemas
const optDate = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date').nullable().optional(),
);

const partySchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  role: z.enum(PARTY_ROLES as [string, ...string[]], { errorMap: () => ({ message: 'Select a party role' }) }),
});
const landLinkSchema = z.object({
  landId: z.string().min(1, 'Select a land record'),
  share: z.coerce.number().positive('Transferred area must be greater than zero').nullable().optional(),
  value: z.preprocess((v) => (v === '' ? null : v), money('Land value').nullable().optional()),
});

const deedFields = {
  title: reqText('Title', 200, 2),
  deedType: z.enum(DEED_TYPE_NAMES as [string, ...string[]], { errorMap: () => ({ message: 'Select a configured deed type' }) }),
  executionDate: optDate,
  ...calcInputSchema,
  agreedFee: z.preprocess((v) => (v === '' ? null : v), money('Agreed fee').nullable().optional()),
  notes: optText(2000),
  parties: z.array(partySchema).max(30).default([]),
  lands: z.array(landLinkSchema).max(30).default([]),
  draftText: z.string().max(100000).optional(),
  details: z
    .object({
      registryOffice: optText(200),
      purpose: optText(3000),
      ownershipHistory: optText(6000),
      possessionNote: optText(3000),
      powerOfAttorney: optText(3000),
    })
    .partial()
    .optional(),
};
const createSchema = z.object(deedFields);
const updateSchema = z
  .object({
    ...Object.fromEntries(Object.entries(deedFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])),
    deedNumber: optText(50),
    regenerate: z.boolean().optional(),
    reason: optText(500),
    version: z.coerce.number().int().min(1, 'Deed version is required'),
  })
  .passthrough();

const previewSchema = z.object({
  deedType: deedFields.deedType,
  executionDate: optDate,
  valuationBasis: calcInputSchema.valuationBasis,
  perUnitRate: calcInputSchema.perUnitRate,
  landValue: calcInputSchema.landValue,
  totalArea: calcInputSchema.totalArea,
  areaUnit: calcInputSchema.areaUnit,
  parties: deedFields.parties,
  lands: deedFields.lands,
  details: deedFields.details,
  draftText: deedFields.draftText,
  deedNumber: optText(50),
});

// ------------------------------------------------------------------ helpers
function dateWarnings(d: Date | null): string[] {
  if (!d) return [];
  const now = Date.now();
  const w: string[] = [];
  if (d.getTime() > now + 24 * 3600 * 1000) w.push('The execution date is in the future. Please confirm it is correct.');
  if (d.getTime() < now - 366 * 24 * 3600 * 1000) w.push('The execution date is more than a year ago. Please confirm it is correct.');
  return w;
}

function assertZeroValue(deedType: string, value: Prisma.Decimal) {
  const cfg = getDeedType(deedType);
  if (value.lte(0) && !cfg?.allowsZeroValue) {
    throw new AppError(400, `Land value must be greater than zero for a ${deedType} deed.`, 'VALIDATION', {
      landValue: 'Enter a land value greater than zero',
    });
  }
}

const readContent = (c: unknown) => (c && typeof c === 'object' ? (c as Record<string, any>) : {});
const snapOf = (d: Deed): Snapshot => (d.snapshot as unknown as Snapshot) ?? { parties: [], lands: [], takenAt: '' };

export function transitionsFor(role: UserRole, status: DeedStatus) {
  if (!can(role, 'deed:status')) return [];
  return TRANSITIONS[status]
    .filter((to) => transitionAllowedForRole(status, to, role))
    .map((to) => ({ to, needsReason: needsReason(status, to), needsChecklist: to === 'READY', needsPrint: to === 'PRINTED' }));
}

async function checksFor(db: Db, deed: Deed) {
  const snap = snapOf(deed);
  const content = readContent(deed.content);
  const detail = findMissingDetailed({
    deedType: deed.deedType,
    executionDate: deed.executionDate,
    landValue: deed.landValue,
    totalArea: deed.totalArea,
    areaUnit: deed.areaUnit,
    officeName: '',
    snapshot: snap,
    areaConfig: DEFAULT_AREA_CONFIG,
  });
  const text = String(content.draftText ?? '');
  const unresolved = [...new Set([...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
  const tpl = deed.templateId ? await db.deedTemplate.findUnique({ where: { id: deed.templateId } }) : null;
  const blocking = [...detail.blocking];
  if (content.stale) blocking.push('The draft text is out of date with the deed values (amount, area or date changed) – regenerate it or review and edit it');
  return {
    blocking,
    warnings: detail.warnings,
    unresolved,
    templateApproved: tpl?.approvalStatus === 'APPROVED',
    templateVersion: tpl?.version ?? null,
  };
}

/** BR-16: roles that may not see full NIDs also must not read them inside the generated draft text. */
export function draftTextFor(d: Deed, role: UserRole): string {
  let text = String(readContent(d.content).draftText ?? '');
  if (canSeeFullNid(role)) return text;
  for (const p of snapOf(d).parties) {
    if (p.nid) text = text.split(p.nid).join(maskNid(p.nid) as string);
  }
  return text;
}

function presentSnapshot(snap: Snapshot, role: UserRole) {
  const full = canSeeFullNid(role);
  return {
    ...snap,
    parties: snap.parties.map((p) => ({ ...p, nid: full ? p.nid : maskNid(p.nid) })),
  };
}

function baseDeed(d: Deed, user: AuthUser) {
  const content = readContent(d.content);
  return {
    id: d.id,
    deedNumber: d.deedNumber,
    title: d.title,
    deedType: d.deedType,
    status: d.status,
    executionDate: d.executionDate,
    valuationBasis: d.valuationBasis,
    perUnitRate: d.perUnitRate,
    landValue: d.landValue,
    totalArea: d.totalArea,
    areaUnit: d.areaUnit,
    agreedFee: d.agreedFee,
    calculatedFees: d.calculatedFees,
    notes: d.notes,
    cancelReason: d.cancelReason,
    printCount: d.printCount,
    version: d.version,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    draftText: draftTextFor(d, user.role),
    watermark: FINAL_STATUSES.includes(d.status) ? null : d.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
    allowedTransitions: transitionsFor(user.role, d.status),
    canEdit: can(user.role, 'deed:write') && EDITABLE_STATUSES.includes(d.status),
  };
}

async function presentDetail(db: Db, d: Deed, user: AuthUser) {
  const createdBy = await db.user.findUnique({ where: { id: d.createdById }, select: { name: true } });
  const office = await db.office.findUniqueOrThrow({ where: { id: d.officeId } });
  const cfg = readAreaConfig(office.areaConversions);
  const out: Record<string, any> = {
    ...baseDeed(d, user),
    createdBy: createdBy?.name ?? null,
    snapshot: presentSnapshot(snapOf(d), user.role),
    details: (d.details as Record<string, unknown> | null) ?? {},
    feeLines: d.feeLines ?? [],
    content: { ...readContent(d.content), draftText: undefined },
    checklist: d.checklist,
    checks: await checksFor(db, d),
    conversion: cfg.factors[d.areaUnit]
      ? {
          original: `${d.totalArea} ${d.areaUnit}`,
          converted: `${D(d.totalArea).mul(cfg.factors[d.areaUnit]).toDecimalPlaces(2)} sqft`,
          factor: cfg.factors[d.areaUnit],
        }
      : null,
  };
  if (can(user.role, 'payment:read')) {
    const payments = await db.payment.findMany({
      where: { deedId: d.id },
      include: { receivedBy: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
    });
    const received = (await paymentTotals(db, [d.id])).get(d.id) ?? D(0);
    out.payments = payments;
    out.received = received.toFixed(2);
    out.due = d.agreedFee != null ? D(d.agreedFee).sub(received).toFixed(2) : null;
  }
  return out;
}

const dateOrNull = (v?: string | null) => (v ? new Date(v) : null);

// ------------------------------------------------------------------ list / preview
r.get(
  '/',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const q = String(req.query.q ?? '').trim().normalize('NFC');
    const status = String(req.query.status ?? '');
    const p = pageParams(req.query);
    const where: Prisma.DeedWhereInput = {
      officeId: req.user.officeId,
      ...(status && status !== 'ALL' ? { status: status as DeedStatus } : {}),
      ...(req.query.forPayment ? { status: { not: 'CANCELLED' } } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { deedNumber: { contains: q } }, { deedType: { contains: q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.deed.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.deed.count({ where }),
    ]);
    const showMoney = can(req.user.role, 'payment:read');
    const totals = showMoney ? await paymentTotals(prisma, rows.map((x) => x.id)) : new Map<string, Prisma.Decimal>();
    const data = rows.map((d) => {
      const received = totals.get(d.id) ?? D(0);
      return {
        ...baseDeed(d, req.user),
        draftText: undefined,
        partyNames: snapOf(d).parties.map((x) => `${x.name} (${x.role})`),
        ...(showMoney ? { received: received.toFixed(2), due: d.agreedFee != null ? D(d.agreedFee).sub(received).toFixed(2) : null } : {}),
      };
    });
    return ok(res, data, 200, pageMeta(p, total));
  }),
);

/** Draft generation preview: nothing is saved (FR-GEN-01..04). */
r.post(
  '/preview-draft',
  requirePerm('deed:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(previewSchema, req.body);
    const snapshot = await buildSnapshot(prisma, req.user.officeId, d.parties as PartyInput[], d.lands as LandInput[]);
    const calc = await calculate(prisma, {
      officeId: req.user.officeId,
      valuationBasis: d.valuationBasis,
      perUnitRate: d.perUnitRate,
      landValue: d.landValue,
      totalArea: d.totalArea,
      areaUnit: d.areaUnit,
      date: dateOrNull(d.executionDate) ?? new Date(),
    });
    const rendered = await renderForDeed(prisma, {
      officeId: req.user.officeId,
      deedType: d.deedType,
      executionDate: dateOrNull(d.executionDate),
      landValue: calc.landValue,
      totalArea: d.totalArea,
      areaUnit: d.areaUnit,
      snapshot,
    });
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    const { blocks } = buildBnDeed({
      deedType: d.deedType,
      deedNumber: (d as any).deedNumber ?? null,
      executionDate: dateOrNull(d.executionDate),
      landValue: calc.landValue,
      totalArea: d.totalArea,
      areaUnit: d.areaUnit,
      details: (d.details as any) ?? null,
      draftText: (d.draftText && d.draftText.trim()) || rendered.text,
      snapshot,
    });
    return ok(res, {
      documentHtml: renderBnHtml(blocks, office, { watermark: 'DRAFT', title: 'Preview' }),
      draftText: rendered.text,
      unresolved: rendered.unresolved,
      blocking: rendered.blocking,
      warnings: rendered.warnings,
      templateWarning: rendered.choice.warning,
      templateVersion: rendered.choice.template?.version ?? null,
      generic: rendered.choice.generic,
      calculation: calc,
      disclaimer: 'Draft only. Not legally verified. Verify all facts and approved wording before use.',
    });
  }),
);

// ------------------------------------------------------------------ create
r.post(
  '/',
  requirePerm('deed:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(createSchema, req.body);
    const execDate = dateOrNull(d.executionDate);
    const created = await prisma.$transaction(async (tx) => {
      const snapshot = await buildSnapshot(tx, req.user.officeId, d.parties as PartyInput[], d.lands as LandInput[]);
      const calc = await calculate(tx, {
        officeId: req.user.officeId,
        valuationBasis: d.valuationBasis,
        perUnitRate: d.perUnitRate,
        landValue: d.landValue,
        totalArea: d.totalArea,
        areaUnit: d.areaUnit,
        date: execDate ?? new Date(),
        overrides: d.feeOverrides,
        overriddenBy: { id: req.user.id, name: req.user.name },
      });
      const landValue = D(calc.landValue);
      assertZeroValue(d.deedType, landValue);
      const rendered = await renderForDeed(tx, {
        officeId: req.user.officeId,
        deedType: d.deedType,
        executionDate: execDate,
        landValue,
        totalArea: d.totalArea,
        areaUnit: d.areaUnit,
        snapshot,
      });
      const text = d.draftText?.trim() ? d.draftText : rendered.text;
      const content = {
        draftText: text,
        generatedAt: new Date().toISOString(),
        generic: rendered.choice.generic,
        templateWarning: rendered.choice.warning,
      };
      const deedNumber = await nextDeedNumber(tx, req.user.officeId);
      const deed = await tx.deed.create({
        data: {
          officeId: req.user.officeId,
          deedNumber,
          title: d.title,
          deedType: d.deedType,
          executionDate: execDate,
          valuationBasis: d.valuationBasis,
          perUnitRate: d.valuationBasis === 'PER_UNIT' ? d.perUnitRate : null,
          landValue,
          totalArea: d.totalArea,
          areaUnit: d.areaUnit,
          agreedFee: d.agreedFee ?? null,
          calculatedFees: calc.totalFees,
          feeLines: calc.lines as unknown as Prisma.InputJsonValue,
          content: content as Prisma.InputJsonValue,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          details: (d.details ?? {}) as Prisma.InputJsonValue,
          templateId: rendered.choice.template?.id ?? null,
          templateVersion: rendered.choice.template?.version ?? null,
          notes: d.notes ?? null,
          createdById: req.user.id,
          parties: { create: d.parties.map((p) => ({ customerId: p.customerId, role: p.role as any })) },
          lands: { create: d.lands.map((l) => ({ landId: l.landId, share: l.share ?? null, value: l.value ?? null })) },
        },
      });
      await tx.deedRevision.create({
        data: { deedId: deed.id, version: 1, title: deed.title, content: content as Prisma.InputJsonValue, editedById: req.user.id, reason: 'Created' },
      });
      await audit(tx, req, 'DEED_CREATED', 'Deed', deed.id, { meta: { deedType: deed.deedType } });
      await audit(tx, req, 'DRAFT_GENERATED', 'Deed', deed.id, {
        meta: { templateId: deed.templateId, templateVersion: deed.templateVersion, generic: rendered.choice.generic },
      });
      return deed;
    });
    const detail = await presentDetail(prisma, created, req.user);
    return ok(res, { ...detail, warnings: dateWarnings(execDate) }, 201);
  }),
);

// ------------------------------------------------------------------ detail
r.get(
  '/:id',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const deed = await getDeedOr404(prisma, req.user.officeId, req.params.id);
    return ok(res, await presentDetail(prisma, deed, req.user));
  }),
);

r.get(
  '/:id/history',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const deed = await getDeedOr404(prisma, req.user.officeId, req.params.id);
    const [revisions, events] = await Promise.all([
      prisma.deedRevision.findMany({ where: { deedId: deed.id }, orderBy: { version: 'desc' } }),
      prisma.auditLog.findMany({ where: { officeId: req.user.officeId, entity: 'Deed', entityId: deed.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    const ids = [...new Set([...revisions.map((x) => x.editedById), ...events.map((e) => e.userId).filter(Boolean)] as string[])];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameOf = (id?: string | null) => users.find((u) => u.id === id)?.name ?? null;
    return ok(res, {
      revisions: revisions.map((x) => ({ id: x.id, version: x.version, title: x.title, reason: x.reason, editedBy: nameOf(x.editedById), createdAt: x.createdAt })),
      events: events.map((e) => ({ id: e.id, action: e.action, reason: e.reason, meta: e.meta, by: nameOf(e.userId), createdAt: e.createdAt })),
    });
  }),
);

// ------------------------------------------------------------------ update (PUT / PATCH)
const updateHandler = wrap(async (req: AuthRequest, res) => {
  const d = parse(updateSchema, req.body) as Record<string, any>;
  const existing = await getDeedOr404(prisma, req.user.officeId, req.params.id);
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new AppError(409, 'This deed is finalized. Move it back to review through a controlled correction before editing.', 'NOT_EDITABLE');
  }
  if (d.version !== existing.version) {
    throw new AppError(409, 'This deed was changed by someone else. Reload the deed and apply your changes again.', 'CONFLICT');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const officeId = req.user.officeId;
    const old = snapOf(existing);
    const execDate = d.executionDate !== undefined ? dateOrNull(d.executionDate) : existing.executionDate;
    const deedType: string = d.deedType ?? existing.deedType;
    const valuationBasis = d.valuationBasis ?? existing.valuationBasis;
    const perUnitRate = d.perUnitRate !== undefined ? d.perUnitRate : existing.perUnitRate != null ? Number(existing.perUnitRate) : null;
    const totalArea = d.totalArea !== undefined ? Number(d.totalArea) : Number(existing.totalArea);
    const areaUnit: string = d.areaUnit ?? existing.areaUnit;
    const landValueIn = d.landValue !== undefined ? Number(d.landValue) : Number(existing.landValue);

    const partyChange = d.parties !== undefined || d.lands !== undefined || d.regenerate;
    let snapshot = old;
    let partyInputs: PartyInput[] = d.parties ?? old.parties.map((p) => ({ customerId: p.customerId, role: p.role }));
    let landInputs: LandInput[] = d.lands ?? old.lands.map((l) => ({ landId: l.landId, share: l.share != null ? Number(l.share) : null, value: l.value != null ? Number(l.value) : null }));
    if (partyChange) {
      snapshot = await buildSnapshot(tx, officeId, partyInputs, landInputs, {
        customerIds: old.parties.map((p) => p.customerId),
        landIds: old.lands.map((l) => l.landId),
      });
      // BR-06: parts the user did not touch keep their saved copy (unless the draft is explicitly regenerated).
      if (!d.regenerate) {
        if (d.parties === undefined) snapshot = { ...snapshot, parties: old.parties };
        if (d.lands === undefined) snapshot = { ...snapshot, lands: old.lands };
      }
    }

    const calc = await calculate(tx, {
      officeId,
      valuationBasis,
      perUnitRate,
      landValue: landValueIn,
      totalArea,
      areaUnit,
      date: execDate ?? new Date(),
      overrides: d.feeOverrides,
      overriddenBy: { id: req.user.id, name: req.user.name },
      previous: (existing.feeLines as unknown as FeeLine[]) ?? [],
    });
    const landValue = D(calc.landValue);
    assertZeroValue(deedType, landValue);

    const content = { ...readContent(existing.content) };
    let templateId = existing.templateId;
    let templateVersion = existing.templateVersion;
    if (d.draftText !== undefined && !d.regenerate) {
      content.draftText = d.draftText;
      delete content.stale; // the user has reviewed the text
    }
    // Values quoted inside the draft text (amount, area, date) may no longer match: flag it so it cannot reach READY unnoticed.
    const valuesChanged =
      !landValue.eq(existing.landValue) || !D(totalArea).eq(existing.totalArea) || areaUnit !== existing.areaUnit ||
      (execDate?.getTime() ?? null) !== (existing.executionDate?.getTime() ?? null);
    if (valuesChanged && d.draftText === undefined && !d.regenerate) content.stale = true;
    if (d.regenerate || d.deedType !== undefined && d.deedType !== existing.deedType) {
      const rendered = await renderForDeed(tx, { officeId, deedType, executionDate: execDate, landValue, totalArea, areaUnit, snapshot });
      content.draftText = d.draftText !== undefined && !d.regenerate ? d.draftText : rendered.text;
      content.generatedAt = new Date().toISOString();
      if (d.draftText === undefined || d.regenerate) delete content.stale;
      content.generic = rendered.choice.generic;
      content.templateWarning = rendered.choice.warning;
      templateId = rendered.choice.template?.id ?? null;
      templateVersion = rendered.choice.template?.version ?? null;
    }

    const version = existing.version + 1;
    let deed: Deed;
    try {
      deed = await tx.deed.update({
        where: { id: existing.id, version: existing.version },
        data: {
          title: d.title ?? existing.title,
          deedType,
          deedNumber: d.deedNumber !== undefined ? d.deedNumber : existing.deedNumber,
          executionDate: execDate,
          valuationBasis,
          perUnitRate: valuationBasis === 'PER_UNIT' ? perUnitRate : null,
          landValue,
          totalArea,
          areaUnit,
          agreedFee: d.agreedFee !== undefined ? d.agreedFee : existing.agreedFee,
          calculatedFees: calc.totalFees,
          feeLines: calc.lines as unknown as Prisma.InputJsonValue,
          content: content as Prisma.InputJsonValue,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          details: (d.details !== undefined ? d.details : existing.details ?? {}) as Prisma.InputJsonValue,
          templateId,
          templateVersion,
          notes: d.notes !== undefined ? d.notes : existing.notes,
          version,
          checklist: Prisma.DbNull, // any edit invalidates a completed review checklist
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new AppError(409, 'This deed was changed by someone else. Reload the deed and apply your changes again.', 'CONFLICT');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(409, 'This deed number is already used in your office.', 'DUPLICATE', { deedNumber: 'Deed number already used' });
      }
      throw e;
    }
    if (partyChange) {
      await tx.deedParty.deleteMany({ where: { deedId: deed.id } });
      await tx.deedLand.deleteMany({ where: { deedId: deed.id } });
      await tx.deedParty.createMany({ data: partyInputs.map((p) => ({ deedId: deed.id, customerId: p.customerId, role: p.role })) });
      await tx.deedLand.createMany({ data: landInputs.map((l) => ({ deedId: deed.id, landId: l.landId, share: l.share ?? null, value: l.value ?? null })) });
    }
    await tx.deedRevision.create({
      data: { deedId: deed.id, version, title: deed.title, content: content as Prisma.InputJsonValue, editedById: req.user.id, reason: d.reason ?? null },
    });
    await audit(tx, req, 'DEED_UPDATED', 'Deed', deed.id, { reason: d.reason ?? null, meta: { version, regenerated: !!d.regenerate } });
    return deed;
  });
  const detail = await presentDetail(prisma, updated, req.user);
  return ok(res, { ...detail, warnings: dateWarnings(updated.executionDate) });
});
r.put('/:id', requirePerm('deed:write'), updateHandler);
r.patch('/:id', requirePerm('deed:write'), updateHandler);

// ------------------------------------------------------------------ status
const statusSchema = z.object({
  status: z.enum(['DRAFT', 'REVIEW', 'READY', 'PRINTED', 'DELIVERED', 'CANCELLED'], { errorMap: () => ({ message: 'Select a valid status' }) }),
  reason: optText(500),
  checklist: z
    .object({
      partiesVerified: z.boolean(),
      landVerified: z.boolean(),
      amountVerified: z.boolean(),
      templateChecked: z.boolean(),
    })
    .optional(),
});

r.patch(
  '/:id/status',
  requirePerm('deed:status'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(statusSchema, req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const deed = await getDeedOr404(tx, req.user.officeId, req.params.id);
      const from = deed.status;
      const to = d.status as DeedStatus;
      if (!TRANSITIONS[from].includes(to)) throw new AppError(409, INVALID_TRANSITION_MESSAGE, 'INVALID_TRANSITION');
      if (!transitionAllowedForRole(from, to, req.user.role)) {
        throw new AppError(403, 'Your role is not allowed to make this status change.');
      }
      if (needsReason(from, to) && (d.reason?.length ?? 0) < 3) {
        throw new AppError(400, 'A reason is required for this status change.', 'VALIDATION', { reason: 'Enter a reason' });
      }
      const checks = await checksFor(tx, deed);
      const missingParts: string[] = [];
      if (to === 'REVIEW' && from === 'DRAFT') {
        const snap = snapOf(deed);
        if (!snap.parties.length) missingParts.push('at least one party');
        if (!snap.lands.length) missingParts.push('at least one land record');
        assertZeroValue(deed.deedType, D(deed.landValue));
        if (missingParts.length) throw new AppError(409, `Before review, link ${missingParts.join(' and ')}.`, 'INCOMPLETE');
      }
      if (to === 'READY') {
        const c = d.checklist;
        if (!c || !c.partiesVerified || !c.landVerified || !c.amountVerified || !c.templateChecked) {
          throw new AppError(409, 'Complete every item of the review checklist before marking the deed READY.', 'CHECKLIST');
        }
        if (!checks.templateApproved) {
          throw new AppError(409, 'This deed does not use an approved template. Approve a template and regenerate the draft before marking READY.', 'TEMPLATE_NOT_APPROVED');
        }
        if (checks.blocking.length) throw new AppError(409, `Missing required data: ${checks.blocking.join('; ')}.`, 'INCOMPLETE');
        if (checks.unresolved.length || hasUnresolvedPlaceholders(String(readContent(deed.content).draftText ?? ''))) {
          throw new AppError(409, `The draft still has unresolved placeholders: ${checks.unresolved.join(', ')}.`, 'UNRESOLVED_PLACEHOLDERS');
        }
      }
      if (to === 'PRINTED' && deed.printCount < 1) {
        throw new AppError(409, 'Print the final copy first so a print event is recorded, then mark the deed PRINTED.', 'NOT_PRINTED');
      }
      const result = await tx.deed.updateMany({
        where: { id: deed.id, status: from },
        data: {
          status: to,
          ...(to === 'CANCELLED' ? { cancelReason: d.reason ?? null } : {}),
          ...(from === 'CANCELLED' ? { cancelReason: null } : {}),
        },
      });
      if (result.count !== 1) throw new AppError(409, 'The deed status was changed by someone else. Reload and try again.', 'CONFLICT');
      if (to === 'READY') await tx.deed.update({ where: { id: deed.id }, data: { checklist: d.checklist as Prisma.InputJsonValue } });
      if (from === 'READY' && to !== 'PRINTED') await tx.deed.update({ where: { id: deed.id }, data: { checklist: Prisma.DbNull } });
      await audit(tx, req, to === 'CANCELLED' ? 'DEED_CANCELLED' : from === 'CANCELLED' ? 'DEED_REOPENED' : 'DEED_STATUS_CHANGED', 'Deed', deed.id, {
        reason: d.reason ?? null,
        meta: { from, to },
      });
      return tx.deed.findUniqueOrThrow({ where: { id: deed.id } });
    });
    return ok(res, await presentDetail(prisma, updated, req.user));
  }),
);

// ------------------------------------------------------------------ print / pdf
async function recordPrint(req: AuthRequest, deedId: string, kind: 'print' | 'pdf' | 'docx') {
  return prisma.$transaction(async (tx) => {
    const deed = await getDeedOr404(tx, req.user.officeId, deedId);
    const final = FINAL_STATUSES.includes(deed.status);
    const watermark = final ? null : deed.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT';
    let printCount = deed.printCount;
    if (final) {
      printCount = (await tx.deed.update({ where: { id: deed.id }, data: { printCount: { increment: 1 } } })).printCount;
    }
    const tag = kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'DOCX' : 'PRINT';
    await audit(tx, req, `DEED_${tag}_${final ? 'FINAL' : 'DRAFT'}`, 'Deed', deed.id, { meta: { status: deed.status, watermark, kind } });
    return { deed, final, watermark, printCount };
  });
}

/** Bangladesh-style deed document model for a deed, with role-based NID masking (BR-16). */
async function documentFor(req: AuthRequest, deedId: string) {
  const deed = await getDeedOr404(prisma, req.user.officeId, deedId);
  const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
  const watermark = FINAL_STATUSES.includes(deed.status) ? null : deed.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT';
  const { blocks } = buildBnDeed({
    deedType: deed.deedType,
    deedNumber: deed.deedNumber,
    executionDate: deed.executionDate,
    landValue: deed.landValue,
    totalArea: deed.totalArea,
    areaUnit: deed.areaUnit,
    details: (deed.details as any) ?? null,
    draftText: draftTextFor(deed, req.user.role),
    snapshot: presentSnapshot(snapOf(deed), req.user.role),
  });
  return { deed, office, blocks, watermark };
}

r.get(
  '/:id/document',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const { deed, office, blocks, watermark } = await documentFor(req, req.params.id);
    return ok(res, { html: renderBnHtml(blocks, office, { watermark, title: deed.title }), watermark });
  }),
);

r.post(
  '/:id/print',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const { final, watermark, printCount } = await recordPrint(req, req.params.id, 'print');
    return ok(res, { final, watermark, printCount });
  }),
);

r.get(
  '/:id/pdf',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const { deed, office, blocks, watermark } = await documentFor(req, req.params.id);
    const html = renderBnHtml(blocks, office, { watermark, title: deed.title });
    const pdf = await htmlToPdf(html, office.printPageSize, office.printMarginMm); // fail before recording an event
    await recordPrint(req, deed.id, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="deed-${deed.id.slice(-8)}.pdf"`);
    res.send(pdf);
  }),
);

r.get(
  '/:id/docx',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const { deed, office, blocks, watermark } = await documentFor(req, req.params.id);
    const buf = await renderBnDocx(blocks, office, { watermark, title: deed.title });
    await recordPrint(req, deed.id, 'docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="deed-${deed.id.slice(-8)}.docx"`);
    res.send(buf);
  }),
);

// ------------------------------------------------------------------ delete (BR-13)
r.delete(
  '/:id',
  requirePerm('deed:delete'),
  wrap(async (req: AuthRequest, res) => {
    const deed = await getDeedOr404(prisma, req.user.officeId, req.params.id);
    const payments = await prisma.payment.count({ where: { deedId: deed.id } });
    if (payments > 0 || deed.status !== 'DRAFT' || deed.printCount > 0) {
      throw new AppError(
        409,
        'This deed has payments, has been printed, or is past the draft stage and cannot be deleted. Cancel it with a reason instead.',
        'NOT_DELETABLE',
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.deed.delete({ where: { id: deed.id } });
      await audit(tx, req, 'DEED_DELETED', 'Deed', deed.id, { meta: { title: deed.title } });
    });
    return ok(res, { deleted: true });
  }),
);

export default r;
