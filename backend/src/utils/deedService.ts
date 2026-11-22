import { Prisma, type Deed, type DeedStatus, type PartyRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from './http.js';
import { type Db } from './common.js';
import { readAreaConfig, type AreaConfig } from './areas.js';
import { DEFAULT_TEMPLATES, genericBody, renderDraft, type DraftInput, type Snapshot } from './draft.js';

export interface PartyInput {
  customerId: string;
  role: PartyRole;
}
export interface LandInput {
  landId: string;
  share?: number | null;
  value?: number | null;
}

/** Validates that every referenced record exists, is active and belongs to the office; builds the snapshot (BR-06). */
export async function buildSnapshot(
  db: Db,
  officeId: string,
  parties: PartyInput[],
  lands: LandInput[],
  /** Records already linked to the deed may be inactive (deactivated later); only NEW links must be active. */
  keep: { customerIds?: string[]; landIds?: string[] } = {},
): Promise<Snapshot> {
  const seen = new Set<string>();
  for (const p of parties) {
    const k = `${p.customerId}:${p.role}`;
    if (seen.has(k)) throw new AppError(400, 'Duplicate party-role link: the same customer is already added with this role.', 'VALIDATION', { parties: 'Duplicate party-role link' });
    seen.add(k);
  }
  if (new Set(lands.map((l) => l.landId)).size !== lands.length) {
    throw new AppError(400, 'The same land record is added more than once.', 'VALIDATION', { lands: 'Duplicate land record' });
  }
  const customerIds = [...new Set(parties.map((p) => p.customerId))];
  const customers = customerIds.length
    ? await db.customer.findMany({ where: { id: { in: customerIds }, officeId, OR: [{ active: true }, { id: { in: keep.customerIds ?? [] } }] } })
    : [];
  if (customers.length !== customerIds.length) {
    throw new AppError(400, 'One or more selected customers were not found or are inactive.', 'VALIDATION', { parties: 'Customer not found' });
  }
  const landIds = lands.map((l) => l.landId);
  const landRows = landIds.length ? await db.land.findMany({ where: { id: { in: landIds }, officeId, OR: [{ active: true }, { id: { in: keep.landIds ?? [] } }] } }) : [];
  if (landRows.length !== landIds.length) {
    throw new AppError(400, 'One or more selected land records were not found or are inactive.', 'VALIDATION', { lands: 'Land record not found' });
  }
  return {
    takenAt: new Date().toISOString(),
    parties: parties.map((p) => {
      const c = customers.find((x) => x.id === p.customerId)!;
      return {
        customerId: c.id,
        role: p.role,
        name: c.name,
        fatherName: c.fatherName,
        motherName: c.motherName,
        husbandName: c.husbandName,
        birthDate: c.birthDate ? c.birthDate.toISOString().slice(0, 10) : null,
        religion: c.religion,
        profession: c.profession,
        nationality: c.nationality,
        nid: c.nid,
        phone: c.phone,
        address: c.address,
        permanentAddress: c.permanentAddress,
      };
    }),
    lands: lands.map((l) => {
      const r = landRows.find((x) => x.id === l.landId)!;
      return {
        landId: r.id,
        share: l.share != null ? String(l.share) : null,
        value: l.value != null ? String(l.value) : null,
        district: r.district,
        upazila: r.upazila,
        mouza: r.mouza,
        jlNumber: r.jlNumber,
        union: r.union,
        landOffice: r.landOffice,
        holdingNo: r.holdingNo,
        khatianNumber: r.khatianNumber,
        khatianType: r.khatianType,
        dagNumber: r.dagNumber,
        area: r.area.toString(),
        areaUnit: r.areaUnit,
        classification: r.classification,
        ownershipDetails: r.ownershipDetails,
        boundaryNorth: r.boundaryNorth,
        boundarySouth: r.boundarySouth,
        boundaryEast: r.boundaryEast,
        boundaryWest: r.boundaryWest,
      };
    }),
  };
}

export interface TemplateChoice {
  template: { id: string; version: number; body: string; approvalStatus: string } | null;
  generic: boolean;
  warning: string | null;
}

/** Latest approved template, else latest of any status (warn), else generic if policy permits (FR-TPL-02/04/05). */
export async function chooseTemplate(db: Db, officeId: string, deedType: string): Promise<TemplateChoice> {
  const approved = await db.deedTemplate.findFirst({
    where: { officeId, deedType, approvalStatus: 'APPROVED' },
    orderBy: { version: 'desc' },
  });
  if (approved) return { template: approved, generic: false, warning: null };
  const office = await db.office.findUniqueOrThrow({ where: { id: officeId } });
  if (!office.allowGenericDraft) {
    throw new AppError(409, `No approved template exists for "${deedType}" and office policy does not allow a generic draft.`, 'NO_TEMPLATE');
  }
  const latest = await db.deedTemplate.findFirst({ where: { officeId, deedType }, orderBy: { version: 'desc' } });
  return {
    template: latest,
    generic: !latest,
    warning: `No approved template for "${deedType}". The draft uses ${latest ? 'an UNAPPROVED template' : 'a generic structure'} and cannot be marked READY until a template is approved.`,
  };
}

export async function renderForDeed(
  db: Db,
  args: {
    officeId: string;
    deedType: string;
    executionDate: Date | null;
    landValue: Prisma.Decimal.Value;
    totalArea: Prisma.Decimal.Value;
    areaUnit: string;
    snapshot: Snapshot;
  },
) {
  const office = await db.office.findUniqueOrThrow({ where: { id: args.officeId } });
  const areaConfig = readAreaConfig(office.areaConversions);
  const choice = await chooseTemplate(db, args.officeId, args.deedType);
  const body = choice.template?.body ?? (choice.generic ? genericBody(args.deedType) : DEFAULT_TEMPLATES[args.deedType] ?? genericBody(args.deedType));
  const input: DraftInput = {
    deedType: args.deedType,
    executionDate: args.executionDate,
    landValue: args.landValue,
    totalArea: args.totalArea,
    areaUnit: args.areaUnit,
    officeName: office.name,
    snapshot: args.snapshot,
    areaConfig,
  };
  const rendered = renderDraft(body, input);
  return { ...rendered, choice, areaConfig: areaConfig as AreaConfig };
}

/** Optional office-scoped deed number (BR-15). Never fabricates an official registration number. */
export async function nextDeedNumber(db: Db, officeId: string): Promise<string | null> {
  const office = await db.office.findUniqueOrThrow({ where: { id: officeId } });
  if (!office.autoNumbering) return null;
  const updated = await db.office.update({ where: { id: officeId }, data: { nextNumber: { increment: 1 } } });
  const n = updated.nextNumber - 1;
  return `${office.numberPrefix}-${new Date().getUTCFullYear()}-${String(n).padStart(4, '0')}`;
}

export async function getDeedOr404(db: Db, officeId: string, id: string) {
  const deed = await db.deed.findFirst({ where: { id, officeId } });
  if (!deed) throw new AppError(404, 'Deed not found.');
  return deed;
}

export type DeedRow = Deed;
export type { DeedStatus };

/** Net received = payments minus reversals (BR-09/10). */
export async function paymentTotals(db: Db, deedIds: string[]): Promise<Map<string, Prisma.Decimal>> {
  const out = new Map<string, Prisma.Decimal>();
  if (!deedIds.length) return out;
  const rows = await db.payment.findMany({ where: { deedId: { in: deedIds } }, select: { deedId: true, type: true, amount: true } });
  for (const r of rows) {
    const cur = out.get(r.deedId) ?? new Prisma.Decimal(0);
    out.set(r.deedId, r.type === 'REVERSAL' ? cur.sub(r.amount) : cur.add(r.amount));
  }
  return out;
}

export { prisma };
