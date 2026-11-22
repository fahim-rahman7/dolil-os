import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInWordsBn, amountInWordsEn } from '../src/utils/words.js';
import { DEFAULT_AREA_CONFIG, convertArea } from '../src/utils/areas.js';
import { computeFees, pickEffectiveRates, ESTIMATE_LABEL, type RateRow } from '../src/utils/fees.js';
import { normalizePhone, maskNid, csvCell } from '../src/utils/common.js';
import { TRANSITIONS, needsReason, transitionAllowedForRole } from '../src/utils/transitions.js';
import { can } from '../src/utils/permissions.js';
import { renderDraft, DEFAULT_TEMPLATES, type Snapshot } from '../src/utils/draft.js';

test('amount in words (English, South Asian grouping)', () => {
  assert.equal(amountInWordsEn(0), 'zero taka');
  assert.equal(amountInWordsEn(1250000), 'twelve lakh fifty thousand taka');
  assert.equal(amountInWordsEn(10000000), 'one crore taka');
  assert.equal(amountInWordsEn(105.5), 'one hundred five taka and fifty paisa');
});

test('amount in words (Bangla)', () => {
  assert.equal(amountInWordsBn(0), 'শূন্য টাকা');
  assert.equal(amountInWordsBn(21), 'একুশ টাকা');
  assert.equal(amountInWordsBn(1250000), 'বারো লক্ষ পঞ্চাশ হাজার টাকা');
  assert.equal(amountInWordsBn(10000000), 'এক কোটি টাকা');
  assert.equal(amountInWordsBn(100), 'এক শত টাকা');
});

test('area conversion shows original, converted and factor', () => {
  const c = convertArea(DEFAULT_AREA_CONFIG, '10', 'katha');
  assert.equal(c.converted.value, '7200');
  assert.equal(c.factor, 720);
  assert.equal(c.original.unit, 'katha');
});

const rate = (o: Partial<RateRow>): RateRow => ({
  id: 'r', label: 'Registration', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 2, effectiveFrom: new Date('2025-01-01'),
  source: 'test', verified: false, active: true, ...o,
});

test('fee rates are effective-dated: latest on/before the date wins', () => {
  const rows = [rate({ id: 'a', rate: 1, effectiveFrom: new Date('2024-01-01') }), rate({ id: 'b', rate: 3, effectiveFrom: new Date('2026-01-01') })];
  assert.equal(pickEffectiveRates(rows, new Date('2025-06-01'))[0].id, 'a');
  assert.equal(pickEffectiveRates(rows, new Date('2026-06-01'))[0].id, 'b');
  assert.equal(pickEffectiveRates(rows, new Date('2023-01-01')).length, 0);
});

test('fee lines are labelled ESTIMATE until verified; override replaces estimate with reason', () => {
  const base = { landValue: 1000000, area: 10, areaUnit: 'decimal', rates: [rate({})], on: new Date('2026-01-01') };
  const a = computeFees(base);
  assert.equal(a.lines[0].amount, '20000.00');
  assert.equal(a.lines[0].estimateLabel, ESTIMATE_LABEL);
  const b = computeFees({ ...base, overrides: [{ key: a.lines[0].key, amount: 25000, reason: 'Verified at sub-registry' }], overriddenBy: { id: 'u', name: 'Owner' } });
  assert.equal(b.lines[0].finalAmount, '25000.00');
  assert.equal(b.lines[0].override?.by, 'Owner');
  assert.equal(b.total, '25000.00');
  const c = computeFees({ ...base, rates: [rate({ verified: true })] });
  assert.equal(c.lines[0].estimateLabel, null);
});

test('phone / NID / CSV helpers', () => {
  assert.equal(normalizePhone('+880 1712-345678'), '01712345678');
  assert.equal(normalizePhone('abc'), null);
  assert.equal(maskNid('1234567890'), '*******890');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});

test('status transitions follow SRS 7.1', () => {
  assert.deepEqual(TRANSITIONS.DRAFT, ['REVIEW', 'CANCELLED']);
  assert.equal(transitionAllowedForRole('DRAFT', 'READY', 'OWNER'), false);
  assert.equal(transitionAllowedForRole('REVIEW', 'READY', 'WRITER'), true);
  assert.equal(transitionAllowedForRole('READY', 'PRINTED', 'WRITER'), false);
  assert.equal(transitionAllowedForRole('DELIVERED', 'CANCELLED', 'ADMIN'), false);
  assert.equal(transitionAllowedForRole('DELIVERED', 'CANCELLED', 'OWNER'), true);
  assert.equal(transitionAllowedForRole('CANCELLED', 'DRAFT', 'ADMIN'), false);
  assert.equal(needsReason('READY', 'REVIEW'), true);
  assert.equal(needsReason('DRAFT', 'REVIEW'), false);
});

test('permission matrix', () => {
  assert.equal(can('ACCOUNTANT', 'payment:write'), true);
  assert.equal(can('WRITER', 'payment:write'), false);
  assert.equal(can('ASSISTANT', 'deed:write'), false);
  assert.equal(can('ADMIN', 'settings:write'), false);
  assert.equal(can('ADMIN', 'settings:write', { adminCanManageSettings: true, adminCanManageUsers: false }), true);
});

test('draft generator fills placeholders and flags missing data', () => {
  const snapshot: Snapshot = {
    takenAt: '',
    parties: [
      { customerId: '1', role: 'SELLER', name: 'রহিম', fatherName: 'করিম', motherName: null, nid: null, phone: null, address: 'ঢাকা' },
      { customerId: '2', role: 'BUYER', name: 'Jamal', fatherName: null, motherName: null, nid: '1234567890', phone: null, address: null },
    ],
    lands: [],
  };
  const out = renderDraft(DEFAULT_TEMPLATES.Sale + '\n{{lands.list}}\n{{SELLER.list}}', {
    deedType: 'Sale', executionDate: new Date('2026-01-05'), landValue: 500000, totalArea: 5, areaUnit: 'decimal',
    officeName: 'Office', snapshot, areaConfig: DEFAULT_AREA_CONFIG,
  });
  assert.match(out.text, /রহিম/);
  assert.match(out.text, /পাঁচ লক্ষ টাকা/);
  assert.ok(out.unresolved.includes('lands.list'));
  assert.ok(out.blocking.includes('No land record is linked'));
  assert.ok(out.warnings.some((w) => w.includes('Jamal') && w.includes('father name')));
  assert.ok(!out.unresolved.includes('WITNESS.list'), 'empty optional witness list is not an unresolved placeholder');
});
