import { Prisma, type PartyRole } from '@prisma/client';
import { amountInWordsBn, amountInWordsEn } from './words.js';
import { convertArea, unitBn, type AreaConfig } from './areas.js';
import { PARTY_ROLES, PARTY_ROLE_BN, getDeedType } from './deedTypes.js';
import { fmtDate } from './common.js';

export interface PartySnap {
  customerId: string;
  role: PartyRole;
  name: string;
  fatherName: string | null;
  motherName: string | null;
  husbandName?: string | null;
  birthDate?: string | null;
  religion?: string | null;
  profession?: string | null;
  nationality?: string | null;
  nid: string | null;
  phone: string | null;
  address: string | null;
  permanentAddress?: string | null;
}
export interface LandSnap {
  landId: string;
  share: string | null;
  value?: string | null;
  district: string;
  upazila: string;
  mouza: string;
  jlNumber: string | null;
  union?: string | null;
  landOffice?: string | null;
  holdingNo?: string | null;
  khatianNumber: string | null;
  khatianType: string | null;
  dagNumber: string;
  area: string;
  areaUnit: string;
  classification: string | null;
  ownershipDetails: string | null;
  boundaryNorth: string | null;
  boundarySouth: string | null;
  boundaryEast: string | null;
  boundaryWest: string | null;
}
export interface Snapshot {
  parties: PartySnap[];
  lands: LandSnap[];
  takenAt: string;
}

export interface DraftInput {
  deedType: string;
  executionDate: Date | null;
  landValue: Prisma.Decimal.Value;
  totalArea: Prisma.Decimal.Value;
  areaUnit: string;
  officeName: string;
  snapshot: Snapshot;
  areaConfig: AreaConfig;
}

export const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_.]+)\s*\}\}/g;

export const PLACEHOLDERS = [
  'office.name', 'deed.type', 'deed.date', 'deed.value', 'deed.valueWordsEn', 'deed.valueWordsBn',
  'deed.area', 'deed.areaUnit', 'deed.areaConverted', 'lands.list',
  ...PARTY_ROLES.map((r) => `${r}.list`),
];

function partyLine(p: PartySnap): string {
  const bits = [p.name];
  if (p.fatherName) bits.push(`পিতা: ${p.fatherName}`);
  if (p.motherName) bits.push(`মাতা: ${p.motherName}`);
  if (p.address) bits.push(`ঠিকানা: ${p.address}`);
  if (p.nid) bits.push(`এনআইডি: ${p.nid}`);
  if (p.phone) bits.push(`ফোন: ${p.phone}`);
  return bits.join(', ');
}

function landLine(l: LandSnap, i: number, cfg: AreaConfig): string {
  const conv = cfg.factors[l.areaUnit] ? ` (${convertArea(cfg, l.area, l.areaUnit).converted.value} sqft)` : '';
  const parts = [
    `${i + 1}) জেলা: ${l.district}, উপজেলা/থানা: ${l.upazila}, মৌজা: ${l.mouza}`,
    l.jlNumber ? `জেএল নং: ${l.jlNumber}` : '',
    l.khatianNumber ? `খতিয়ান নং: ${l.khatianNumber}${l.khatianType ? ` (${l.khatianType})` : ''}` : '',
    `দাগ নং: ${l.dagNumber}`,
    `পরিমাণ: ${l.area} ${l.areaUnit}${conv}`,
    l.classification ? `শ্রেণি: ${l.classification}` : '',
  ].filter(Boolean);
  let out = parts.join(', ');
  const b = [
    l.boundaryNorth && `উত্তরে: ${l.boundaryNorth}`,
    l.boundarySouth && `দক্ষিণে: ${l.boundarySouth}`,
    l.boundaryEast && `পূর্বে: ${l.boundaryEast}`,
    l.boundaryWest && `পশ্চিমে: ${l.boundaryWest}`,
  ].filter(Boolean);
  if (b.length) out += `\n   চৌহদ্দি – ${b.join('; ')}`;
  return out;
}

export function buildValues(input: DraftInput): Record<string, string> {
  const v = new Prisma.Decimal(input.landValue);
  const area = new Prisma.Decimal(input.totalArea);
  const values: Record<string, string> = {
    'office.name': input.officeName,
    'deed.type': input.deedType,
    'deed.date': fmtDate(input.executionDate),
    'deed.value': v.toNumber().toLocaleString('en-IN', { minimumFractionDigits: v.isInteger() ? 0 : 2, maximumFractionDigits: 2 }),
    'deed.valueWordsEn': amountInWordsEn(v.toNumber()),
    'deed.valueWordsBn': amountInWordsBn(v.toNumber()),
    'deed.area': area.toString(),
    'deed.areaUnit': unitBn(input.areaUnit),
    'deed.areaConverted': input.areaConfig.factors[input.areaUnit]
      ? `${convertArea(input.areaConfig, area, input.areaUnit).converted.value} sqft`
      : '',
    'lands.list': input.snapshot.lands.map((l, i) => landLine(l, i, input.areaConfig)).join('\n'),
  };
  for (const role of PARTY_ROLES) {
    values[`${role}.list`] = input.snapshot.parties
      .filter((p) => p.role === role)
      .map((p, i, a) => `${a.length > 1 ? `${i + 1}) ` : ''}${partyLine(p)}`)
      .join('\n');
  }
  return values;
}

export interface RenderResult {
  text: string;
  unresolved: string[]; // placeholders with no value
  missing: string[]; // all absent data (blocking + warnings)
  blocking: string[];
  warnings: string[];
}

/** FR-GEN-01..04: fill placeholders; report anything unresolved or missing. */
export function renderDraft(body: string, input: DraftInput): RenderResult {
  const values = buildValues(input);
  const unresolved = new Set<string>();
  const required = new Set<string>((getDeedType(input.deedType)?.requiredRoles ?? []).map((r) => `${r}.list`));
  const text = body.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const val = values[key];
    // Optional party lists (e.g. witnesses) may legitimately be empty.
    if (val === '' && key.endsWith('.list') && key !== 'lands.list' && !required.has(key)) return '';
    if (val === undefined || val === '') {
      unresolved.add(key);
      return `{{${key}}}`;
    }
    return val;
  });
  const detail = findMissingDetailed(input);
  return { text, unresolved: [...unresolved], missing: [...detail.blocking, ...detail.warnings], blocking: detail.blocking, warnings: detail.warnings };
}

/** Generic, clearly labelled structure used when a type has no approved template (FR-TPL-05). */
export function genericBody(deedType: string): string {
  return [
    `[GENERIC DRAFT – no approved template for "${deedType}". Not for final use.]`,
    '',
    `${deedType} দলিল`,
    'তারিখ: {{deed.date}}',
    '',
    ...PARTY_ROLES.filter((r) => r !== 'WITNESS').flatMap((r) => [`${PARTY_ROLE_BN[r]}:`, `{{${r}.list}}`, '']),
    'সম্পত্তির বিবরণ:',
    '{{lands.list}}',
    '',
    'মোট পরিমাণ: {{deed.area}} {{deed.areaUnit}} ({{deed.areaConverted}})',
    'মূল্য: ৳ {{deed.value}} ({{deed.valueWordsBn}})',
    '',
    `সাক্ষী:`,
    '{{WITNESS.list}}',
  ].join('\n');
}

/** Missing-field checks (FR-GEN-04): returns human-readable messages. */
export interface MissingReport {
  blocking: string[]; // must be fixed before READY
  warnings: string[]; // flagged for manual review (e.g. identity details)
}

export function findMissingDetailed(input: DraftInput): MissingReport {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const cfg = getDeedType(input.deedType);
  if (!input.executionDate) blocking.push('Execution date is not set');
  const v = new Prisma.Decimal(input.landValue);
  if (v.lte(0) && !cfg?.allowsZeroValue) blocking.push('Land value must be greater than zero');
  if (new Prisma.Decimal(input.totalArea).lte(0)) blocking.push('Total area is not set');
  if (!input.snapshot.parties.length) blocking.push('No party is linked');
  if (!input.snapshot.lands.length) blocking.push('No land record is linked');
  for (const role of cfg?.requiredRoles ?? []) {
    if (!input.snapshot.parties.some((p) => p.role === role)) blocking.push(`Required party role missing: ${role}`);
  }
  const withValue = input.snapshot.lands.filter((l) => l.value != null && l.value !== '');
  if (withValue.length && withValue.length === input.snapshot.lands.length) {
    const sum = withValue.reduce((a, l) => a.add(l.value as string), new Prisma.Decimal(0));
    if (!sum.eq(v)) warnings.push(`Sum of per-dag values (${sum.toFixed(2)}) differs from the deed land value (${v.toFixed(2)})`);
  }
  for (const p of input.snapshot.parties) {
    if (p.role === 'WITNESS') continue;
    if (!p.fatherName) warnings.push(`${p.role} ${p.name}: father name is missing`);
    if (!p.address) warnings.push(`${p.role} ${p.name}: address is missing`);
    if (!p.nid) warnings.push(`${p.role} ${p.name}: NID is missing – verify identity manually`);
  }
  return { blocking, warnings };
}

export const findMissing = (input: DraftInput): string[] => {
  const r = findMissingDetailed(input);
  return [...r.blocking, ...r.warnings];
};

export const hasUnresolvedPlaceholders = (text: string) => /\{\{\s*[A-Za-z_.]+\s*\}\}/.test(text);

// ---------- default (unapproved) templates seeded for every office ----------
// Narrative clauses only: parties, তফসিল, চৌহদ্দি and signatures are generated as structured sections
// by the Bangladesh deed document engine (src/docs/bnDeed.ts).
const NOTE = '(খসড়া – অনুমোদিত আইনজীবীর পর্যালোচনা ও অনুমোদন ব্যতীত চূড়ান্ত ব্যবহার করা যাবে না)';
const DATE = 'এই দলিল {{deed.date}} তারিখে সম্পাদিত হইল।';
const CLEAR = 'দলিল দাতা/দাতাগণ ঘোষণা করিতেছেন যে, উক্ত সম্পত্তি সম্পূর্ণ নিষ্কণ্টক ও দায়মুক্ত; অন্য কাহারও নিকট বিক্রয়, দান, বন্ধক বা অন্য কোনোভাবে হস্তান্তর করা হয় নাই। ইহার ব্যতিক্রম প্রমাণিত হইলে তাহার দায়ভার দলিল দাতা/দাতাগণের উপর বর্তাইবে।';
const ENJOY = 'দলিল গ্রহীতা/গ্রহীতাগণ ও তাঁহাদের ওয়ারিশগণ উক্ত সম্পত্তি নিজ নামে নামজারি ও জমা খারিজ করিয়া খাজনা প্রদানপূর্বক ভোগ-দখল করিতে পারিবেন।';

export const DEFAULT_TEMPLATES: Record<string, string> = {
  Sale: [DATE, 'দলিল দাতা/দাতাগণ উপরে বর্ণিত তফসিলভুক্ত সম্পত্তির মোট {{deed.area}} {{deed.areaUnit}} জমি বাবদ বিক্রয়মূল্য {{deed.value}} টাকা ({{deed.valueWordsBn}}) দলিল গ্রহীতা/গ্রহীতাগণের নিকট হইতে বুঝিয়া পাইয়া উক্ত সম্পত্তিতে নিজের/নিজেদের সকল স্বত্ব, স্বামিত্ব ও দখল দলিল গ্রহীতা/গ্রহীতাগণের অনুকূলে চিরস্থায়ীভাবে হস্তান্তর করিলাম/করিলেন।', CLEAR, ENJOY, NOTE].join('\n'),
  Gift: [DATE, 'দলিল দাতা/দাতাগণ স্নেহ/ভালোবাসা/সদিচ্ছাবশত উপরে বর্ণিত তফসিলভুক্ত সম্পত্তির মোট {{deed.area}} {{deed.areaUnit}} জমি দলিল গ্রহীতা/গ্রহীতাগণের অনুকূলে বিনিময়মূল্য ব্যতীত দান করিলাম/করিলেন।', CLEAR, ENJOY, NOTE].join('\n'),
  Agreement: [DATE, 'দলিল দাতা/দাতাগণ উপরে বর্ণিত তফসিলভুক্ত সম্পত্তির মোট {{deed.area}} {{deed.areaUnit}} জমি {{deed.value}} টাকা ({{deed.valueWordsBn}}) মূল্যে দলিল গ্রহীতা/গ্রহীতাগণের নিকট বিক্রয় করিতে সম্মত হইয়াছেন। বায়না ও অবশিষ্ট মূল্য পরিশোধের সময় ও শর্ত পক্ষগণের সম্মতি অনুযায়ী নির্ধারিত হইবে।', 'নির্ধারিত সময়ে চুক্তি সম্পাদনে ব্যর্থ হইলে পক্ষগণ আইনানুগ প্রতিকার গ্রহণ করিতে পারিবেন।', NOTE].join('\n'),
  Partition: [DATE, 'পক্ষগণ নিজেদের মধ্যে সম্মতিক্রমে উপরে বর্ণিত তফসিলভুক্ত সম্পত্তির মোট {{deed.area}} {{deed.areaUnit}} জমি নিজ নিজ অংশ অনুযায়ী বণ্টন করিয়া লইলেন। প্রত্যেক পক্ষ নিজ নিজ বণ্টিত অংশে একচ্ছত্র দখল ও ভোগের অধিকারী হইবেন।', NOTE].join('\n'),
  Exchange: [DATE, 'পক্ষগণ নিজেদের মধ্যে সম্মতিক্রমে উপরে বর্ণিত তফসিলভুক্ত সম্পত্তি পরস্পর বিনিময় করিলেন। বিনিময়কৃত সম্পত্তির মূল্যমান {{deed.value}} টাকা ({{deed.valueWordsBn}})।', CLEAR, NOTE].join('\n'),
  'Power of Attorney': [DATE, 'ক্ষমতা প্রদানকারী/প্রদানকারীগণ উপরে বর্ণিত প্রতিনিধিকে উক্ত তফসিলভুক্ত সম্পত্তি সংক্রান্ত নির্দিষ্ট কার্যাদি সম্পাদন, দলিল রেজিস্ট্রিকরণ ও আনুষঙ্গিক যাবতীয় কাজের জন্য ক্ষমতা অর্পণ করিলেন। প্রতিনিধি এই ক্ষমতার আওতায় যাহা করিবেন তাহা ক্ষমতা প্রদানকারীর কৃত বলিয়া গণ্য হইবে।', NOTE].join('\n'),
  Mortgage: [DATE, 'দলিল দাতা/দাতাগণ উপরে বর্ণিত তফসিলভুক্ত সম্পত্তির মোট {{deed.area}} {{deed.areaUnit}} জমি {{deed.value}} টাকা ({{deed.valueWordsBn}}) ঋণ/অগ্রিমের বিপরীতে দলিল গ্রহীতা/গ্রহীতাগণের নিকট বন্ধক রাখিলেন। ঋণ পরিশোধ সাপেক্ষে সম্পত্তি দায়মুক্ত করা হইবে।', CLEAR, NOTE].join('\n'),
};
