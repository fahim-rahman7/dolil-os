import { Prisma } from '@prisma/client';
import type { LandSnap, PartySnap, Snapshot } from '../utils/draft.js';
import { amountInWordsBn, numberInWordsBn } from '../utils/words.js';

// ---------------------------------------------------------------- block model (rendered to HTML/PDF and DOCX)
export type Cell = string | { text: string; bold?: boolean; colspan?: number; align?: 'left' | 'center' | 'right' };
export type Block =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'heading'; text: string }
  | { t: 'para'; text: string; bold?: boolean }
  | { t: 'table'; widths: number[]; rows: Cell[][]; head?: boolean }
  | { t: 'card'; rows: [string, string][]; photo: string }
  | { t: 'sign'; left: string; right: string }
  | { t: 'gap' };

export interface DeedDetails {
  registryOffice?: string | null;
  purpose?: string | null;
  ownershipHistory?: string | null;
  possessionNote?: string | null;
  powerOfAttorney?: string | null;
}

export interface BnDeedInput {
  deedType: string;
  deedNumber: string | null;
  executionDate: Date | string | null;
  landValue: Prisma.Decimal.Value;
  totalArea: Prisma.Decimal.Value;
  areaUnit: string;
  details: DeedDetails | null;
  draftText: string;
  snapshot: Snapshot;
}

// ---------------------------------------------------------------- Bangla helpers
const DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const bnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => DIGITS[Number(d)]);

export { unitBn } from '../utils/areas.js';
import { unitBn } from '../utils/areas.js';

export const TYPE_BN: Record<string, { title: string; nature: string }> = {
  Sale: { title: 'সম্পত্তি হস্তান্তর দলিল', nature: 'সাফ-কবলা' },
  Gift: { title: 'সম্পত্তি হস্তান্তর দলিল', nature: 'দান/হেবা' },
  Agreement: { title: 'চুক্তিনামা (বায়নানামা)', nature: 'চুক্তিনামা' },
  Partition: { title: 'সম্পত্তি হস্তান্তর দলিল', nature: 'বণ্টননামা' },
  Exchange: { title: 'সম্পত্তি হস্তান্তর দলিল', nature: 'বিনিময়' },
  'Power of Attorney': { title: 'মোক্তারনামা (পাওয়ার অব অ্যাটর্নি)', nature: 'মোক্তারনামা' },
  Mortgage: { title: 'সম্পত্তি হস্তান্তর দলিল', nature: 'বন্ধকী' },
};

const DIGIT_WORDS = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];

/** "০.১৩৫০ একর" style words: শূন্য দশমিক এক তিন পাঁচ শূন্য */
/** Acre areas are written with 4 decimals in Bangladesh land records (e.g. ০.১৩৫০ একর). */
const fmtArea = (v: Prisma.Decimal.Value, unit?: string) => (unit === 'acre' ? new Prisma.Decimal(v).toFixed(4) : new Prisma.Decimal(v).toString());

export function areaWordsBn(value: Prisma.Decimal.Value, unit?: string): string {
  const [int, frac = ''] = fmtArea(value, unit).split('.');
  const intWords = numberInWordsBn(Number(int));
  return frac ? `${intWords} দশমিক ${[...frac].map((c) => DIGIT_WORDS[Number(c)]).join(' ')}` : intWords;
}

export const moneyBn = (v: Prisma.Decimal.Value) =>
  bnDigits(new Prisma.Decimal(v).toNumber().toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }));

export const dateBn = (d?: Date | string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = dt.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${dd} খ্রি.`;
};

const dash = (v?: string | null) => (v && v.trim() ? v : '—');
const dots = '………………………………';
const areaStr = (v: Prisma.Decimal.Value, unit: string) => `${fmtArea(v, unit)} ${unitBn(unit)}`;

const RECEIVER_ROLES = ['BUYER', 'RECIPIENT'];
const GIVER_ROLES = ['SELLER', 'DONOR'];

function partyBlocks(parties: PartySnap[], heading: string, empty = 'প্রযোজ্য নহে'): Block[] {
  const out: Block[] = [{ t: 'heading', text: heading }];
  if (!parties.length) return [...out, { t: 'para', text: empty }];
  for (const p of parties) {
    out.push({
      t: 'card',
      photo: 'সম্প্রতি তোলা পাসপোর্ট আকারের ছবি সংযুক্ত করতে হবে।',
      rows: [
        ['নাম', p.name],
        ['পিতার নাম', dash(p.fatherName)],
        ['স্বামীর নাম', p.husbandName?.trim() ? p.husbandName : 'প্রযোজ্য নহে'],
        ['মাতার নাম', dash(p.motherName)],
        ['জন্ম তারিখ', p.birthDate ? dateBn(p.birthDate) : '—'],
        ['ধর্ম', dash(p.religion)],
        ['পেশা', dash(p.profession)],
        ['জাতীয়তা', p.nationality?.trim() ? p.nationality : 'বাংলাদেশী'],
        ['জাতীয় পরিচয়পত্র নম্বর', dash(p.nid)],
        ...(p.phone ? ([['মোবাইল নম্বর', p.phone]] as [string, string][]) : []),
      ],
    });
    out.push({
      t: 'table',
      widths: [50, 50],
      head: true,
      rows: [
        ['স্থায়ী ঠিকানা', 'বর্তমান ঠিকানা'],
        [dash(p.permanentAddress ?? p.address), dash(p.address ?? p.permanentAddress)],
      ],
    });
    out.push({ t: 'gap' });
  }
  return out;
}

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))];

/** Groups dags that share the same mouza/khatian header (one তফসিল block per group). */
function groupLands(lands: LandSnap[]): LandSnap[][] {
  const map = new Map<string, LandSnap[]>();
  for (const l of lands) {
    const k = [l.district, l.upazila, l.mouza, l.jlNumber, l.union, l.landOffice, l.khatianNumber, l.khatianType, l.holdingNo].join('|');
    map.set(k, [...(map.get(k) ?? []), l]);
  }
  return [...map.values()];
}

const SUFFIX = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'];

/** Builds a Bangladesh-style (Registration Rules, 1973 – Form 40 style) transfer-deed document. */
export function buildBnDeed(input: BnDeedInput): { blocks: Block[]; draftLabel: boolean } {
  const { snapshot: snap, details } = input;
  const type = TYPE_BN[input.deedType] ?? { title: `${input.deedType} দলিল`, nature: input.deedType };
  const lands = snap.lands;
  const receivers = snap.parties.filter((p) => RECEIVER_ROLES.includes(p.role));
  const givers = snap.parties.filter((p) => GIVER_ROLES.includes(p.role));
  const reps = snap.parties.filter((p) => p.role === 'REPRESENTATIVE');
  const witnesses = snap.parties.filter((p) => p.role === 'WITNESS');
  const value = new Prisma.Decimal(input.landValue);
  const b: Block[] = [];

  b.push({ t: 'title', text: type.title });
  b.push({
    t: 'table',
    widths: [34, 33, 33],
    rows: [['ক্রমিক নং', 'বই নং -', `দলিল নং - ${input.deedNumber ?? ''}`.trim()]],
  });
  b.push({ t: 'gap' });

  b.push({ t: 'heading', text: '১। নিবন্ধন কার্যালয়ের নাম:' });
  b.push({ t: 'para', text: details?.registryOffice?.trim() || dots });

  b.push({ t: 'heading', text: '২। দলিলের সার সংক্ষেপ:' });
  b.push({
    t: 'table',
    widths: [20, 20, 20, 20, 20],
    head: true,
    rows: [
      ['দলিলের প্রকৃতি', 'মৌজার নাম', 'পৌরসভা/ইউনিয়ন', 'থানা/উপজেলা', 'জেলা'],
      [
        type.nature,
        dash(uniq(lands.map((l) => l.mouza)).join(', ')),
        dash(uniq(lands.map((l) => l.union)).join(', ')),
        dash(uniq(lands.map((l) => l.upazila)).join(', ')),
        dash(uniq(lands.map((l) => l.district)).join(', ')),
      ],
    ],
  });
  b.push({ t: 'gap' });
  const classes = uniq(lands.map((l) => l.classification));
  b.push({
    t: 'table',
    widths: [40, 20, 40],
    head: true,
    rows: [
      ['হস্তান্তরিত সম্পত্তির পরিমাণ', 'শ্রেণি', 'মূল্য (অংক ও কথায়)'],
      [
        `${areaStr(input.totalArea, input.areaUnit)} (${areaWordsBn(input.totalArea, input.areaUnit)} ${unitBn(input.areaUnit)})`,
        dash(classes.join(', ')),
        value.gt(0) ? `${moneyBn(value)}/- (${amountInWordsBn(value.toNumber()).replace(/ টাকা$/, '')}) টাকা মাত্র।` : 'প্রযোজ্য নহে',
      ],
    ],
  });

  b.push(...partyBlocks(receivers, '৩। দলিল গ্রহিতা/গ্রহিতাগণের নাম ও ঠিকানা:', 'প্রযোজ্য নহে'));
  b.push(...partyBlocks(givers, '৪। দলিল দাতা/দাতাগণের নাম ও ঠিকানা:', 'প্রযোজ্য নহে'));

  b.push({ t: 'heading', text: '৫। ক্ষমতাপ্রাপ্ত অ্যাটর্নি/প্রতিনিধি/অভিভাবক-এর নাম, ঠিকানা ও বিবরণ (প্রযোজ্য ক্ষেত্রে):' });
  if (reps.length) {
    for (const r of reps) {
      b.push({ t: 'para', text: `${r.name}${r.fatherName ? `, পিতা: ${r.fatherName}` : ''}${r.address ? `, ঠিকানা: ${r.address}` : ''}${r.nid ? `, জাতীয় পরিচয়পত্র নং: ${r.nid}` : ''}` });
    }
  } else b.push({ t: 'para', text: 'প্রযোজ্য নহে।' });

  b.push({ t: 'heading', text: '৬। পাওয়ার অব অ্যাটর্নির বিবরণ (প্রযোজ্য ক্ষেত্রে):' });
  b.push({ t: 'para', text: details?.powerOfAttorney?.trim() || 'প্রযোজ্য নহে।' });

  b.push({ t: 'heading', text: '৭। হস্তান্তরাধীন সম্পত্তির ন্যূনপক্ষে ২৫ বছরের মালিকানার ধারাবাহিক বিবরণ (যথাযথ ক্ষেত্রে ওয়ারিশ ও বায়া দলিলসমূহের বিস্তারিত বিবরণ এবং হস্তান্তরের উদ্দেশ্য, সম্পত্তির দখল, ইজমেন্ট স্বত্ব ও হস্তান্তর সম্পর্কিত উল্লেখযোগ্য মন্তব্য, যদি থাকে ইত্যাদির বিবরণ):' });
  b.push({ t: 'para', text: details?.ownershipHistory?.trim() || dots });

  b.push({ t: 'heading', text: '৮। সম্পত্তি হস্তান্তরের উদ্দেশ্য:' });
  b.push({ t: 'para', text: details?.purpose?.trim() || dots });

  b.push({ t: 'heading', text: '৯। সম্পত্তির দখল, ইজমেন্ট স্বত্ব ও হস্তান্তর সম্পর্কে উল্লেখযোগ্য মন্তব্য:' });
  b.push({ t: 'para', text: details?.possessionNote?.trim() || dots });

  const clauses = input.draftText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  b.push({ t: 'heading', text: '১০। দলিলের শর্ত ও ঘোষণা:' });
  if (clauses.length) clauses.forEach((c) => b.push({ t: 'para', text: c }));
  else b.push({ t: 'para', text: dots });

  // ---------------- তফসিল
  const groups = groupLands(lands);
  groups.forEach((g, i) => {
    const l = g[0];
    const head = groups.length > 1 ? `১১(${SUFFIX[i] ?? i + 1}) তফসিলে বর্ণিত সম্পত্তি:` : '১১। তফসিলে বর্ণিত সম্পত্তি:';
    b.push({ t: 'heading', text: head });
    b.push({
      t: 'table',
      widths: [18, 32, 18, 32],
      rows: [
        ['জেলা', dash(l.district), 'থানা/উপজেলা', dash(l.upazila)],
        ['মৌজা', dash(l.mouza), 'জে. এল. নং', dash(l.jlNumber)],
        ['ইউনিয়ন', dash(l.union), 'ভূমি অফিস', dash(l.landOffice)],
        [
          'খতিয়ান',
          { text: `${l.khatianType ? `${l.khatianType} - ` : ''}${dash(l.khatianNumber)}${l.holdingNo ? `। হোল্ডিং নং - ${l.holdingNo}` : ''}`, colspan: 3 },
        ],
      ],
    });
    b.push({ t: 'gap' });
    b.push({ t: 'para', text: 'দাগ নম্বর অঙ্কে ও কথায়ঃ' });
    const units = uniq(g.map((x) => x.areaUnit));
    const rows: Cell[][] = [['দাগ নং', 'শ্রেণি', 'দাগে জমির পরিমাণ', 'হস্তান্তরিত জমি']];
    let total = new Prisma.Decimal(0);
    for (const d of g) {
      const moved = d.share != null && d.share !== '' ? new Prisma.Decimal(d.share) : new Prisma.Decimal(d.area);
      total = total.add(moved);
      const dagWords = /^[1-9]d{0,8}$/.test(d.dagNumber.trim()) ? ` (${numberInWordsBn(Number(d.dagNumber)).replace(/ শত/g, 'শত')})` : '';
      rows.push([`${d.dagNumber}${dagWords}`, dash(d.classification), areaStr(d.area, d.areaUnit), areaStr(moved, d.areaUnit)]);
    }
    if (units.length === 1) {
      rows.push([{ text: `জমির পরিমাণ (কথায়): ${areaWordsBn(total, units[0])} ${unitBn(units[0])}।`, colspan: 3 }, { text: `মোট: ${areaStr(total, units[0])}`, bold: true }]);
    }
    b.push({ t: 'table', widths: [20, 20, 30, 30], head: true, rows });
    b.push({ t: 'gap' });
  });

  if (lands.length) {
    const byClass = new Map<string, Prisma.Decimal>();
    const classValue = new Map<string, Prisma.Decimal | null>();
    const u = uniq(lands.map((l) => l.areaUnit));
    for (const l of lands) {
      const k = l.classification?.trim() || '—';
      const moved = l.share ? new Prisma.Decimal(l.share) : new Prisma.Decimal(l.area);
      byClass.set(k, (byClass.get(k) ?? new Prisma.Decimal(0)).add(moved));
      const prev: Prisma.Decimal | null = classValue.has(k) ? (classValue.get(k) ?? null) : new Prisma.Decimal(0);
      classValue.set(k, prev === null || l.value == null || l.value === '' ? null : prev.add(l.value));
    }
    b.push({ t: 'heading', text: 'শ্রেণি অনুযায়ী জমির পরিমাণ ও মূল্য:' });
    const rows: Cell[][] = [['শ্রেণি', 'জমির পরিমাণ', 'মূল্য']];
    for (const [k, v] of byClass) {
      const cv = classValue.get(k);
      rows.push([k, u.length === 1 ? areaStr(v, u[0]) : v.toString(), cv ? `${moneyBn(cv)}/-` : '']);
    }
    rows.push([{ text: 'সর্বমোট', bold: true }, areaStr(input.totalArea, input.areaUnit), value.gt(0) ? `${moneyBn(value)}/-` : '—']);
    b.push({ t: 'table', widths: [34, 33, 33], head: true, rows });
    b.push({ t: 'gap' });
  }

  // ---------------- চৌহদ্দি
  b.push({ t: 'heading', text: '১২। সম্পত্তির চৌহদ্দির বিবরণ:' });
  for (const l of lands) {
    if (lands.length > 1) b.push({ t: 'para', text: `দাগ নং ${l.dagNumber}:`, bold: true });
    b.push({
      t: 'table',
      widths: [15, 35, 15, 35],
      rows: [
        ['উত্তর', dash(l.boundaryNorth), 'দক্ষিণ', dash(l.boundarySouth)],
        ['পূর্ব', dash(l.boundaryEast), 'পশ্চিম', dash(l.boundaryWest)],
      ],
    });
    b.push({ t: 'gap' });
  }
  if (!lands.length) b.push({ t: 'para', text: dots });

  // ---------------- date + signatures
  b.push({ t: 'para', text: `সম্পাদনের তারিখ: ${input.executionDate ? dateBn(input.executionDate) : dots}` });
  b.push({ t: 'gap' });
  b.push({ t: 'sign', left: `দলিল দাতার স্বাক্ষর${givers.length ? `\n(${givers.map((g) => g.name).join(', ')})` : ''}`, right: `দলিল গ্রহীতার স্বাক্ষর${receivers.length ? `\n(${receivers.map((g) => g.name).join(', ')})` : ''}` });
  b.push({ t: 'gap' });
  b.push({ t: 'heading', text: 'সাক্ষীগণের নাম, ঠিকানা ও স্বাক্ষর:' });
  const wrows: Cell[][] = [['সাক্ষীর নাম ও ঠিকানা', 'জাতীয় পরিচয়পত্র নম্বর', 'স্বাক্ষর']];
  if (witnesses.length) {
    for (const w of witnesses) wrows.push([`${w.name}${w.fatherName ? `\nপিতা: ${w.fatherName}` : ''}${w.address ? `\n${w.address}` : ''}`, dash(w.nid), '']);
  } else {
    wrows.push(['\n\n', '', ''], ['\n\n', '', '']);
  }
  b.push({ t: 'table', widths: [45, 25, 30], head: true, rows: wrows });

  return { blocks: b, draftLabel: true };
}
