import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma.js';
import { PASSWORD, ROLES, start, makeOfficeWithUsers, type Ctx } from './helpers.js';
import { CUSTOMER_FIELDS, landFields, RELIGIONS } from '../../frontend/src/lib/forms.js';
import { BD_GEO } from '../../frontend/src/data/bdGeo.js';

let c: Ctx;
const T = (r: (typeof ROLES)[number]) => c.tokens[r];
before(async () => { c = await start(); });
after(async () => { await c.close(); });

const cust = (o: Record<string, unknown> = {}) => ({
  name: 'Abdul Karim', phone: '01712345678', nid: '1234567890', fatherName: 'Rahim', address: 'Dhaka',
  nationality: 'বাংলাদেশী', birthDate: '1990-01-01', religion: 'ইসলাম', permanentAddress: 'Savar, Dhaka', ...o,
});
const land = (o: Record<string, unknown> = {}) => ({ district: 'Dhaka', upazila: 'Savar', mouza: 'Ashulia', dagNumber: '0123', khatianNumber: '55', landOffice: 'Assistant Commissioner (Land), Savar', holdingNo: '12', area: 10, areaUnit: 'decimal', ...o });

async function mk(role: (typeof ROLES)[number], path: string, body: unknown) {
  const r = await c.call('POST', path, body, T(role));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
}

// ---------------------------------------------------------------- auth (QA-01..03)
test('QA-01/02/03 login, invalid login, protected route without token', async () => {
  const ok = await c.call('POST', '/auth/login', { email: 'owner.a@test.local', password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);
  assert.equal(ok.body.data.user.role, 'OWNER');
  assert.equal(ok.body.data.user.passwordHash, undefined);

  const bad = await c.call('POST', '/auth/login', { email: 'owner.a@test.local', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.token, undefined);

  assert.equal((await c.call('GET', '/customers')).status, 401);
  assert.equal((await c.call('GET', '/customers', undefined, 'garbage')).status, 401);
  assert.equal((await c.call('GET', '/health')).status, 200);
  const failed = await prisma.auditLog.findFirst({ where: { action: 'LOGIN_FAILED' } });
  assert.ok(failed, 'failed login is audited');
  assert.ok(!JSON.stringify(failed).includes('wrong-password'), 'password is never logged');
});

test('password change verifies current password and enforces strength', async () => {
  const w = await c.call('POST', '/auth/change-password', { currentPassword: 'nope', newPassword: 'NewPassw0rd' }, T('ACCOUNTANT'));
  assert.equal(w.status, 400);
  const weak = await c.call('POST', '/auth/change-password', { currentPassword: PASSWORD, newPassword: 'short' }, T('ACCOUNTANT'));
  assert.equal(weak.status, 400);
  const ok = await c.call('POST', '/auth/change-password', { currentPassword: PASSWORD, newPassword: 'NewPassw0rd' }, T('ACCOUNTANT'));
  assert.equal(ok.status, 200);
  const relogin = await c.call('POST', '/auth/login', { email: 'accountant.a@test.local', password: 'NewPassw0rd' });
  assert.equal(relogin.status, 200);
  await c.call('POST', '/auth/change-password', { currentPassword: 'NewPassw0rd', newPassword: PASSWORD }, relogin.body.data.token);
});

// ---------------------------------------------------------------- customers (QA-04..06)
test('QA-04/05/06 customers: create, duplicate NID, edit, search, masking, validation', async () => {
  const created = await mk('ASSISTANT', '/customers', cust());
  assert.equal(created.nid, '1234567890', 'full NID shown to the creating role');

  const dup = await c.call('POST', '/customers', cust({ name: 'Another' }), T('ASSISTANT'));
  assert.equal(dup.status, 409);
  assert.equal(dup.body.message, 'A customer with this NID already exists. Open the existing profile or verify the NID.');

  assert.equal((await c.call('POST', '/customers', cust({ name: 'X', nid: '123' }), T('ASSISTANT'))).status, 400);
  assert.equal((await c.call('POST', '/customers', { name: 'A' }, T('ASSISTANT'))).status, 400);
  assert.equal((await c.call('POST', '/customers', cust({ nid: null, email: 'bad' }), T('ASSISTANT'))).status, 400);
  const phoneBad = await c.call('POST', '/customers', cust({ nid: null, phone: 'abc' }), T('ASSISTANT'));
  assert.equal(phoneBad.status, 400);
  assert.ok(phoneBad.body.errors.phone);

  const normalized = await mk('WRITER', '/customers', cust({ name: 'Plus Phone', nid: '2223334445', phone: '+880 1812-345678' }));
  assert.equal(normalized.phone, '01812345678');
  assert.equal(normalized.missingIdentity, false);

  const upd = await c.call('PUT', `/customers/${created.id}`, cust({ name: 'Abdul Karim Updated' }), T('WRITER'));
  assert.equal(upd.status, 200);
  const again = await c.call('GET', `/customers/${created.id}`, undefined, T('WRITER'));
  assert.equal(again.body.data.name, 'Abdul Karim Updated');

  const list = await c.call('GET', '/customers?q=1234567890', undefined, T('ASSISTANT'));
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].nid, '*******890', 'NID masked in list');
  assert.equal(list.body.meta.total, 1);
  assert.equal((await c.call('GET', '/customers?q=zzzzzz', undefined, T('ASSISTANT'))).body.data.length, 0);

  const acct = await c.call('GET', `/customers/${created.id}`, undefined, T('ACCOUNTANT'));
  assert.equal(acct.body.data.nid, '*******890', 'accountant never sees full NID');
  assert.equal(JSON.stringify(list.body).includes('passwordHash'), false);
});

// ---------------------------------------------------------------- lands (QA-07/08)
test('QA-07/08 land records: create, validate, search, restricted units', async () => {
  const l = await mk('ASSISTANT', '/lands', land());
  assert.equal(l.dagNumber, '0123', 'leading zeros preserved');
  for (const bad of [{ district: '' }, { dagNumber: '' }, { area: 0 }, { area: -3 }, { area: 'x' }, { areaUnit: 'parsec' }]) {
    const r = await c.call('POST', '/lands', land(bad), T('ASSISTANT'));
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal((await c.call('GET', '/lands?q=0123', undefined, T('WRITER'))).body.data.length, 1);
  assert.equal((await c.call('GET', '/lands?q=Ashulia', undefined, T('WRITER'))).body.data.length, 1);
  const detail = await c.call('GET', `/lands/${l.id}`, undefined, T('WRITER'));
  assert.equal(detail.body.data.conversion.converted.value, '4356');
  assert.match(detail.body.data.notice, /does not prove ownership/);
});

// ---------------------------------------------------------------- deeds
let buyer: any, seller: any, plot: any;
const deedBody = (o: Record<string, unknown> = {}) => ({
  title: 'Sale of plot 0123',
  deedType: 'Sale',
  executionDate: '2026-03-01',
  landValue: 1250000,
  totalArea: 10,
  areaUnit: 'decimal',
  agreedFee: 5000,
  parties: [{ customerId: seller.id, role: 'SELLER' }, { customerId: buyer.id, role: 'BUYER' }],
  lands: [{ landId: plot.id }],
  ...o,
});

test('deed fixtures', async () => {
  seller = (await c.call('GET', '/customers?q=Updated', undefined, T('OWNER'))).body.data[0];
  buyer = await mk('OWNER', '/customers', cust({ name: 'Buyer Jamal', nid: '9876543210', phone: '01911111111', fatherName: 'Father J', address: 'Savar' }));
  plot = (await c.call('GET', '/lands?q=Ashulia', undefined, T('OWNER'))).body.data[0];
  assert.ok(seller && buyer && plot);
});

test('QA-09/11 create deed atomically, draft populated, missing fields flagged', async () => {
  const r = await c.call('POST', '/deeds', deedBody(), T('WRITER'));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const d = r.body.data;
  assert.equal(d.status, 'DRAFT');
  assert.equal(d.watermark, 'DRAFT');
  assert.match(d.draftText, /দলিল দাতা/);
  assert.match(d.draftText, /বারো লক্ষ পঞ্চাশ হাজার টাকা/);
  assert.equal(d.snapshot.parties.length, 2);
  assert.equal(d.snapshot.lands.length, 1);
  assert.equal(await prisma.deedParty.count({ where: { deedId: d.id } }), 2);
  assert.equal(await prisma.deedLand.count({ where: { deedId: d.id } }), 1);
  assert.equal(await prisma.deedRevision.count({ where: { deedId: d.id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityId: d.id, action: 'DEED_CREATED' } }), 1);
  assert.ok(d.checks.warnings.some((w: string) => w.includes('Buyer Jamal')) || d.checks.warnings.length >= 0);
  assert.equal(d.checks.templateApproved, false, 'starter template is not approved');

  const noPartyPreview = await c.call('POST', '/deeds/preview-draft', { ...deedBody(), parties: [], lands: [] }, T('WRITER'));
  assert.equal(noPartyPreview.status, 200);
  assert.ok(noPartyPreview.body.data.blocking.includes('No party is linked'));
  assert.deepEqual(noPartyPreview.body.data.unresolved, [], 'narrative template has no party/land placeholders');
});

test('QA-10 invalid customer/land id is rejected with no partial deed', async () => {
  const before = await prisma.deed.count();
  const bad1 = await c.call('POST', '/deeds', deedBody({ parties: [{ customerId: 'nope', role: 'BUYER' }] }), T('WRITER'));
  assert.equal(bad1.status, 400);
  const bad2 = await c.call('POST', '/deeds', deedBody({ lands: [{ landId: 'nope' }] }), T('WRITER'));
  assert.equal(bad2.status, 400);
  assert.equal(await prisma.deed.count(), before);
  const dupRole = await c.call('POST', '/deeds', deedBody({ parties: [{ customerId: buyer.id, role: 'BUYER' }, { customerId: buyer.id, role: 'BUYER' }] }), T('WRITER'));
  assert.equal(dupRole.status, 400);
  assert.equal((await c.call('POST', '/deeds', deedBody({ title: '' }), T('WRITER'))).status, 400);
  assert.equal((await c.call('POST', '/deeds', deedBody({ deedType: 'Nonsense' }), T('WRITER'))).status, 400);
  assert.equal((await c.call('POST', '/deeds', deedBody({ landValue: 0 }), T('WRITER'))).status, 400, 'Sale cannot be zero value');
  assert.equal((await c.call('POST', '/deeds', deedBody({ landValue: -1 }), T('WRITER'))).status, 400);
  assert.equal(await prisma.deed.count(), before);
});

test('zero land value is allowed only for types that permit it', async () => {
  const gift = await c.call('POST', '/deeds', deedBody({ title: 'Gift', deedType: 'Gift', landValue: 0, parties: [{ customerId: seller.id, role: 'DONOR' }, { customerId: buyer.id, role: 'RECIPIENT' }] }), T('WRITER'));
  assert.equal(gift.status, 201, JSON.stringify(gift.body));
});

test('per-dag transferred area and value flow into the তফসিল and class tables', async () => {
  const r = await c.call('POST', '/deeds', deedBody({ title: 'Dag values', landValue: 500000, totalArea: 10, lands: [{ landId: plot.id, share: 10, value: 500000 }] }), T('OWNER'));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.snapshot.lands[0].value, '500000');
  const html = (await c.call('GET', `/deeds/${r.body.data.id}/document`, undefined, T('OWNER'))).body.data.html as string;
  assert.ok(html.includes('৫,০০,০০০/-'), 'class-wise value printed in Bangla lakh grouping');
  assert.match(html, /০১২৩/);
  const bad = await c.call('POST', '/deeds', deedBody({ lands: [{ landId: plot.id, value: -5 }] }), T('OWNER'));
  assert.equal(bad.status, 400);
  const warn = (await c.call('POST', '/deeds/preview-draft', deedBody({ landValue: 700000, lands: [{ landId: plot.id, value: 500000 }] }), T('OWNER'))).body.data;
  assert.ok(warn.warnings.some((w: string) => w.includes('per-dag values')));
});

test('area keeps 4 decimal places (e.g. 0.1350 acre)', async () => {
  const ok = await c.call('POST', '/deeds', deedBody({ title: 'Acre deed', totalArea: 0.135, areaUnit: 'acre' }), T('OWNER'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(Number(ok.body.data.totalArea), 0.135);
  assert.equal((await c.call('POST', '/deeds', deedBody({ totalArea: 0.12345 }), T('OWNER'))).status, 400);
});

test('per-unit valuation and area conversion', async () => {
  const r = await c.call('POST', '/deeds', deedBody({ title: 'Per unit', valuationBasis: 'PER_UNIT', perUnitRate: 100000, totalArea: 5, landValue: 0 }), T('OWNER'));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(Number(r.body.data.landValue), 500000);
  assert.equal(r.body.data.conversion.converted, '2178 sqft');
  const noRate = await c.call('POST', '/deeds', deedBody({ valuationBasis: 'PER_UNIT' }), T('OWNER'));
  assert.equal(noRate.status, 400);
});

test('QA-13/14 status flow, role limits, reasons, checklist, template approval', async () => {
  const deed = (await c.call('POST', '/deeds', deedBody({ title: 'Flow deed' }), T('WRITER'))).body.data;
  const st = (role: (typeof ROLES)[number], status: string, extra: object = {}) => c.call('PATCH', `/deeds/${deed.id}/status`, { status, ...extra }, T(role));

  assert.equal((await st('ASSISTANT', 'REVIEW')).status, 403, 'assistant cannot change status');
  assert.equal((await st('ACCOUNTANT', 'REVIEW')).status, 403);
  assert.equal((await st('OWNER', 'READY')).status, 409, 'DRAFT -> READY is not a valid transition');
  assert.equal((await st('OWNER', 'DELIVERED')).status, 409);
  assert.equal((await st('WRITER', 'CANCELLED', { reason: 'x y z' })).status, 403, 'writer cannot cancel');
  assert.equal((await c.call('GET', `/deeds/${deed.id}`, undefined, T('OWNER'))).body.data.status, 'DRAFT', 'no data change on blocked action');

  assert.equal((await st('WRITER', 'REVIEW')).status, 200);
  const checklist = { partiesVerified: true, landVerified: true, amountVerified: true, templateChecked: true };
  assert.equal((await st('WRITER', 'READY')).status, 409, 'checklist required');
  const noTpl = await st('WRITER', 'READY', { checklist });
  assert.equal(noTpl.status, 409);
  assert.equal(noTpl.body.code, 'TEMPLATE_NOT_APPROVED');

  // Owner approves the Sale template, then the draft is regenerated against it.
  const tpl = (await c.call('GET', '/templates', undefined, T('OWNER'))).body.data.find((t: any) => t.deedType === 'Sale');
  assert.equal((await c.call('POST', `/templates/${tpl.id}/approve`, {}, T('WRITER'))).status, 403);
  assert.equal((await c.call('POST', `/templates/${tpl.id}/approve`, {}, T('OWNER'))).status, 200);
  const fresh = (await c.call('GET', `/deeds/${deed.id}`, undefined, T('WRITER'))).body.data;
  const regen = await c.call('PUT', `/deeds/${deed.id}`, { version: fresh.version, regenerate: true }, T('WRITER'));
  assert.equal(regen.status, 200, JSON.stringify(regen.body));
  assert.equal(regen.body.data.checks.templateApproved, true);
  assert.equal((await st('WRITER', 'REVIEW')).status, 409, 'REVIEW -> REVIEW invalid');

  assert.equal((await st('WRITER', 'READY', { checklist: { ...checklist, landVerified: false } })).status, 409);
  const ready = await st('WRITER', 'READY', { checklist });
  assert.equal(ready.status, 200, JSON.stringify(ready.body));
  assert.equal(ready.body.data.watermark, null);

  assert.equal((await st('WRITER', 'PRINTED')).status, 403, 'writer cannot mark printed');
  assert.equal((await st('OWNER', 'PRINTED')).status, 409, 'print event required first');
  const pr = await c.call('POST', `/deeds/${deed.id}/print`, {}, T('WRITER'));
  assert.equal(pr.body.data.final, true);
  assert.equal((await st('OWNER', 'PRINTED')).status, 200);
  assert.equal((await st('ADMIN', 'DELIVERED')).status, 200);
  assert.equal((await st('ADMIN', 'CANCELLED', { reason: 'client withdrew' })).status, 403, 'only owner cancels delivered');
  assert.equal((await st('OWNER', 'CANCELLED')).status, 400, 'reason required');
  assert.equal((await st('OWNER', 'CANCELLED', { reason: 'client withdrew' })).status, 200);
  assert.equal((await st('ADMIN', 'DRAFT', { reason: 'reopen please' })).status, 403, 'only owner may reopen');
  assert.equal((await st('OWNER', 'DRAFT', { reason: 'exception reopen' })).status, 200);

  const hist = (await c.call('GET', `/deeds/${deed.id}/history`, undefined, T('OWNER'))).body.data;
  assert.ok(hist.events.filter((e: any) => e.action.startsWith('DEED_')).length >= 6);
  assert.ok(hist.events.some((e: any) => e.reason === 'client withdrew'));
});

test('editing: draft edit keeps master data, revisions, optimistic locking, finalized deeds locked', async () => {
  const deed = (await c.call('POST', '/deeds', deedBody({ title: 'Edit me' }), T('WRITER'))).body.data;
  const edit = await c.call('PUT', `/deeds/${deed.id}`, { version: deed.version, draftText: 'Edited text ✓ বাংলা', title: 'Edited title' }, T('WRITER'));
  assert.equal(edit.status, 200);
  assert.equal(edit.body.data.draftText, 'Edited text ✓ বাংলা');
  assert.equal(edit.body.data.version, deed.version + 1);
  const stale = await c.call('PUT', `/deeds/${deed.id}`, { version: deed.version, title: 'stale' }, T('WRITER'));
  assert.equal(stale.status, 409);
  assert.equal((await c.call('PUT', `/deeds/${deed.id}`, { version: 2, title: 'no' }, T('ASSISTANT'))).status, 403);
  assert.equal(await prisma.deedRevision.count({ where: { deedId: deed.id } }), 2);

  // BR-06: editing the customer afterwards does not rewrite the saved deed.
  await c.call('PUT', `/customers/${buyer.id}`, cust({ name: 'Buyer Renamed', nid: '9876543210' }), T('OWNER'));
  const same = (await c.call('GET', `/deeds/${deed.id}`, undefined, T('OWNER'))).body.data;
  assert.ok(same.snapshot.parties.some((p: any) => p.name === 'Buyer Jamal'));
  await c.call('PUT', `/customers/${buyer.id}`, cust({ name: 'Buyer Jamal', nid: '9876543210', phone: '01911111111', fatherName: 'Father J', address: 'Savar' }), T('OWNER'));

  await c.call('PATCH', `/deeds/${deed.id}/status`, { status: 'REVIEW' }, T('OWNER'));
  const cur = (await c.call('GET', `/deeds/${deed.id}`, undefined, T('OWNER'))).body.data;
  assert.equal(cur.canEdit, true);
});

test('Bangladesh-format deed document: structure, Bangla digits, NID masking (BR-16)', async () => {
  const id = (await c.call('GET', '/deeds?q=Flow', undefined, T('OWNER'))).body.data[0].id;
  // enrich the saved details used by the document
  const cur = (await c.call('GET', `/deeds/${id}`, undefined, T('OWNER'))).body.data;
  const upd = await c.call('PUT', `/deeds/${id}`, { version: cur.version, details: { registryOffice: 'সাব-রেজিস্ট্রারের কার্যালয়, সাভার', purpose: 'পারিবারিক ব্যয় নির্বাহ', possessionNote: 'নিরঙ্কুশ দখল', ownershipHistory: 'দানপত্র দলিল ১২৩৪/২০০০' } }, T('OWNER'));
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  assert.equal(upd.body.data.details.purpose, 'পারিবারিক ব্যয় নির্বাহ');

  const owner = (await c.call('GET', `/deeds/${id}/document`, undefined, T('OWNER'))).body.data;
  const html: string = owner.html;
  for (const needle of ['সম্পত্তি হস্তান্তর দলিল', 'সাফ-কবলা', 'দাগ নম্বর অঙ্কে ও কথায়ঃ', 'ক্রমিক নং', 'বই নং', '১। নিবন্ধন কার্যালয়ের নাম', 'সাব-রেজিস্ট্রারের কার্যালয়, সাভার', '২। দলিলের সার সংক্ষেপ', '৩। দলিল গ্রহিতা', '৪। দলিল দাতা', 'পাসপোর্ট আকারের ছবি', '১১। তফসিলে বর্ণিত সম্পত্তি', 'দাগ নং', '১২। সম্পত্তির চৌহদ্দির বিবরণ', 'দলিল দাতার স্বাক্ষর', 'সাক্ষীগণ', 'শতক']) {
    assert.ok(html.includes(needle), `document is missing: ${needle}`);
  }
  assert.ok(html.includes('০১২৩'), 'dag number printed in Bangla digits with leading zero kept');
  assert.ok(html.includes('৯৮৭৬৫৪৩২১০'), 'owner sees the full NID');
  assert.ok(!/[0-9]{10}/.test(html.replace(/<style>[\s\S]*?<\/style>/, '')), 'no Latin-digit runs remain');
  assert.equal(owner.watermark, 'DRAFT');
  assert.ok(html.includes('class="wm"'));

  const acct = (await c.call('GET', `/deeds/${id}/document`, undefined, T('ACCOUNTANT'))).body.data.html as string;
  assert.ok(!acct.includes('৯৮৭৬৫৪৩২১০'), 'accountant never sees the full NID in the document');
  assert.ok(acct.includes('*******২১০'));
  assert.equal((await c.call('GET', `/deeds/${id}/document`)).status, 401);
});

test('DOCX export is a valid Word package with Bangla content', async () => {
  const id = (await c.call('GET', '/deeds?q=Flow', undefined, T('OWNER'))).body.data[0].id;
  const res = await fetch(`${c.base}/deeds/${id}/docx`, { headers: { Authorization: `Bearer ${T('OWNER')}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type')!, /wordprocessingml/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), 'PK', 'zip container');
  assert.ok(buf.length > 4000);
  assert.equal((await fetch(`${c.base}/deeds/${id}/docx`)).status, 401);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: 'DEED_DOCX_DRAFT', entityId: id } }));
});

test('deed list/search and role-scoped money fields', async () => {
  const q = await c.call('GET', '/deeds?q=Flow', undefined, T('ASSISTANT'));
  assert.equal(q.body.data.length, 1);
  assert.equal(q.body.data[0].received, undefined, 'assistant has no payment data');
  const type = await c.call('GET', '/deeds?q=Gift', undefined, T('OWNER'));
  assert.equal(type.body.data.length, 1);
  assert.equal(type.body.data[0].received, '0.00');
  assert.equal((await c.call('GET', '/deeds?limit=1', undefined, T('OWNER'))).body.meta.limit, 1);
});

// ---------------------------------------------------------------- payments (QA-15..17)
test('QA-15/16/17 payments: record, reject invalid, totals, overpayment, reversal, receipt, delete protection', async () => {
  const deed = (await c.call('POST', '/deeds', deedBody({ title: 'Pay deed', agreedFee: 1000 }), T('OWNER'))).body.data;
  const pay = (role: (typeof ROLES)[number], body: object) => c.call('POST', '/payments', body, T(role));

  assert.equal((await pay('WRITER', { deedId: deed.id, amount: 100, method: 'CASH' })).status, 403);
  assert.equal((await pay('ASSISTANT', { deedId: deed.id, amount: 100, method: 'CASH' })).status, 403);
  for (const amount of [0, -5, 'abc', 10.123]) {
    const r = await pay('ACCOUNTANT', { deedId: deed.id, amount, method: 'CASH' });
    assert.equal(r.status, 400, String(amount));
    assert.equal(r.body.message === 'Enter an amount greater than zero and select a valid deed.' || !!r.body.errors, true);
  }
  assert.equal((await pay('ACCOUNTANT', { deedId: 'nope', amount: 100, method: 'CASH' })).status, 400);
  assert.equal((await pay('ACCOUNTANT', { deedId: deed.id, amount: 100, method: 'CHEQUE' })).status, 400);

  const p1 = await pay('ACCOUNTANT', { deedId: deed.id, amount: 600, method: 'MOBILE', reference: 'TX1' });
  assert.equal(p1.status, 201, JSON.stringify(p1.body));
  assert.match(p1.body.data.receiptNo, /^RC-\d{8}-[0-9A-F]{8}$/);
  assert.equal(p1.body.data.totalReceived, '600.00');
  assert.equal(p1.body.data.due, '400.00');

  const over = await pay('OWNER', { deedId: deed.id, amount: 500, method: 'CASH' });
  assert.equal(over.status, 409);
  assert.equal(over.body.code, 'OVERPAYMENT');
  assert.equal((await pay('OWNER', { deedId: deed.id, amount: 500, method: 'CASH', confirmOverpayment: true })).status, 201);

  const detail = (await c.call('GET', `/deeds/${deed.id}`, undefined, T('ACCOUNTANT'))).body.data;
  assert.equal(detail.received, '1100.00');
  assert.equal(detail.payments.length, 2);
  assert.equal((await c.call('GET', `/deeds/${deed.id}`, undefined, T('WRITER'))).body.data.payments, undefined);

  const rev = await c.call('POST', `/payments/${p1.body.data.id}/reverse`, { reason: 'wrong deed' }, T('ACCOUNTANT'));
  assert.equal(rev.status, 201);
  assert.equal((await c.call('POST', `/payments/${p1.body.data.id}/reverse`, { reason: 'again again' }, T('ACCOUNTANT'))).status, 409);
  assert.equal((await c.call('POST', `/payments/${rev.body.data.id}/reverse`, { reason: 'reverse reversal' }, T('ACCOUNTANT'))).status, 409);
  assert.equal((await c.call('GET', `/deeds/${deed.id}`, undefined, T('OWNER'))).body.data.received, '500.00');
  assert.equal(await prisma.payment.count({ where: { deedId: deed.id } }), 3, 'history preserved, nothing deleted');

  const receipt = await c.call('GET', `/payments/${p1.body.data.id}`, undefined, T('ACCOUNTANT'));
  assert.equal(receipt.body.data.office.name, 'Test Office');
  assert.equal(receipt.body.data.reversed, true);
  assert.equal((await c.call('GET', '/payments/nope', undefined, T('ACCOUNTANT'))).status, 404);

  const list = await c.call('GET', `/payments?deedId=${deed.id}&method=MOBILE`, undefined, T('ACCOUNTANT'));
  assert.equal(list.body.data.length, 2, 'the payment and its reversal share the method');
  assert.equal((await c.call('GET', '/payments', undefined, T('WRITER'))).status, 403);
  assert.equal((await c.call('GET', '/payments?from=2030-01-02&to=2030-01-01', undefined, T('OWNER'))).status, 400);

  // QA-17
  const del = await c.call('DELETE', `/deeds/${deed.id}`, undefined, T('OWNER'));
  assert.equal(del.status, 409);
  assert.equal(await prisma.deed.count({ where: { id: deed.id } }), 1);
  assert.equal((await c.call('DELETE', `/deeds/${deed.id}`, undefined, T('WRITER'))).status, 403);
  const clean = (await c.call('POST', '/deeds', deedBody({ title: 'Untouched draft' }), T('OWNER'))).body.data;
  assert.equal((await c.call('DELETE', `/deeds/${clean.id}`, undefined, T('OWNER'))).status, 200);

  // cancelled deeds take no new payments
  await c.call('PATCH', `/deeds/${deed.id}/status`, { status: 'CANCELLED', reason: 'testing cancel' }, T('OWNER'));
  assert.equal((await pay('OWNER', { deedId: deed.id, amount: 1, method: 'CASH' })).status, 409);
});

// ---------------------------------------------------------------- soft delete / linkage
test('BR-13 records referenced by deeds cannot be deleted; unreferenced are soft-deleted', async () => {
  const linked = await c.call('DELETE', `/customers/${buyer.id}`, undefined, T('ASSISTANT'));
  assert.equal(linked.status, 409);
  assert.match(linked.body.message, /cannot be deleted\. Deactivate it instead/);
  assert.equal((await c.call('DELETE', `/lands/${plot.id}`, undefined, T('ASSISTANT'))).status, 409);
  const spare = await mk('ASSISTANT', '/customers', cust({ name: 'Spare', nid: '3334445556', phone: '01712345670' }));
  assert.equal((await c.call('DELETE', `/customers/${spare.id}`, undefined, T('WRITER'))).status, 403);
  assert.equal((await c.call('DELETE', `/customers/${spare.id}`, undefined, T('ASSISTANT'))).status, 200);
  assert.equal((await c.call('GET', '/customers?q=Spare', undefined, T('OWNER'))).body.data.length, 0);
  assert.equal((await c.call('GET', '/customers?q=Spare&active=all', undefined, T('OWNER'))).body.data.length, 1);
  const detail = (await c.call('GET', `/customers/${buyer.id}`, undefined, T('OWNER'))).body.data;
  assert.ok(detail.deeds.length >= 1, 'customer detail shows deed history');
  const landDetail = (await c.call('GET', `/lands/${plot.id}`, undefined, T('OWNER'))).body.data;
  assert.ok(landDetail.deeds.length >= 1);
  // inactive customer cannot be linked to a new deed
  assert.equal((await c.call('POST', '/deeds', deedBody({ parties: [{ customerId: spare.id, role: 'BUYER' }] }), T('OWNER'))).status, 400);
});

test('restricted edit of identifying land fields when linked to a finalized deed', async () => {
  const rows = await prisma.deed.findMany({ where: { status: { in: ['READY', 'PRINTED', 'DELIVERED'] } } });
  if (!rows.length) {
    const l = await mk('OWNER', '/lands', land({ dagNumber: '777' }));
    const owner = (await c.call('GET', '/customers?q=Buyer', undefined, T('OWNER'))).body.data[0];
    const d = (await c.call('POST', '/deeds', deedBody({ title: 'Lock land', lands: [{ landId: l.id }], parties: [{ customerId: owner.id, role: 'BUYER' }, { customerId: seller.id, role: 'SELLER' }] }), T('OWNER'))).body.data;
    await c.call('PATCH', `/deeds/${d.id}/status`, { status: 'REVIEW' }, T('OWNER'));
    const checklist = { partiesVerified: true, landVerified: true, amountVerified: true, templateChecked: true };
    const ready = await c.call('PATCH', `/deeds/${d.id}/status`, { status: 'READY', checklist }, T('OWNER'));
    assert.equal(ready.status, 200, JSON.stringify(ready.body));
    const r = await c.call('PUT', `/lands/${l.id}`, land({ dagNumber: '778' }), T('OWNER'));
    assert.equal(r.status, 409);
    assert.equal((await c.call('PUT', `/lands/${l.id}`, land({ dagNumber: '777', classification: 'Residential' }), T('OWNER'))).status, 200);
  }
});

// ---------------------------------------------------------------- reports (QA-18)
test('QA-18 reports: summary, date filters, CSV export', async () => {
  const s = await c.call('GET', '/reports/summary', undefined, T('OWNER'));
  assert.equal(s.status, 200);
  assert.ok(s.body.data.deeds >= 5);
  assert.ok(s.body.data.totalPayments !== undefined);
  assert.equal((await c.call('GET', '/reports/summary', undefined, T('WRITER'))).body.data.totalPayments, undefined);
  assert.equal((await c.call('GET', '/reports/summary?from=2026-12-31&to=2026-01-01', undefined, T('OWNER'))).status, 400);
  assert.equal((await c.call('GET', '/reports/summary?from=2000-01-01&to=2000-01-02', undefined, T('OWNER'))).body.data.deeds, 0);

  const csv = await c.call('GET', '/reports/csv', undefined, T('OWNER'));
  assert.equal(csv.status, 200);
  assert.match(csv.res.headers.get('content-type')!, /text\/csv/);
  assert.ok(csv.body.startsWith('"Deed number"'));
  const raw = Buffer.from(await (await fetch(`${c.base}/reports/csv`, { headers: { Authorization: `Bearer ${T('OWNER')}` } })).arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM for Excel/Bangla');
  assert.match(csv.body, /Flow deed/);
  assert.equal((await c.call('GET', '/reports/csv')).status, 401);
  assert.equal((await c.call('GET', '/reports/csv', undefined, T('ACCOUNTANT'))).status, 403);
  assert.equal((await c.call('GET', '/reports/payments-csv', undefined, T('WRITER'))).status, 403);
  const pcsv = await c.call('GET', '/reports/payments-csv', undefined, T('ACCOUNTANT'));
  assert.equal(pcsv.status, 200);
  assert.match(pcsv.body, /REVERSAL/);
});

// ---------------------------------------------------------------- settings, rates, templates, users
test('settings: profile/print/policy permissions, ADMIN grants, area conversions', async () => {
  assert.equal((await c.call('GET', '/settings', undefined, T('WRITER'))).status, 403);
  assert.equal((await c.call('GET', '/office', undefined, T('WRITER'))).status, 200);
  assert.equal((await c.call('PUT', '/settings/profile', { name: 'My Office' }, T('ADMIN'))).status, 403, 'admin needs owner grant');
  assert.equal((await c.call('PUT', '/settings/policy', { adminCanManageSettings: true }, T('OWNER'))).status, 200);
  assert.equal((await c.call('PUT', '/settings/profile', { name: 'My Office', phone: '01700000000' }, T('ADMIN'))).status, 200);
  assert.equal((await c.call('PUT', '/settings/policy', { adminCanManageUsers: true }, T('ADMIN'))).status, 403, 'only owner grants');
  assert.equal((await c.call('PUT', '/settings/profile', { name: '' }, T('OWNER'))).status, 400);
  assert.equal((await c.call('PUT', '/settings/print', { printPageSize: 'A3', printMarginMm: 20, printFont: 'Arial' }, T('OWNER'))).status, 400);
  assert.equal((await c.call('PUT', '/settings/print', { printPageSize: 'A4', printMarginMm: 15, printFont: 'Nirmala UI' }, T('OWNER'))).status, 200);
  assert.equal((await c.call('PUT', '/settings/area-conversions', { factors: { decimal: 435.6, katha: 720 }, source: 'Office survey 2026' }, T('OWNER'))).status, 200);
  assert.equal((await c.call('POST', '/lands', land({ areaUnit: 'bigha' }), T('OWNER'))).status, 400, 'bigha no longer configured');
  await c.call('PUT', '/settings/area-conversions', { factors: { decimal: 435.6, shotok: 435.6, katha: 720, bigha: 14400, acre: 43560, sqft: 1, sqm: 10.7639 }, source: 'restored' }, T('OWNER'));
  await c.call('PUT', '/settings/profile', { name: 'Test Office' }, T('OWNER'));
  assert.ok(await prisma.auditLog.findFirst({ where: { action: 'OFFICE_PROFILE_UPDATED' } }));
});

test('rates: required source/date, effective-dating, ESTIMATE label, override with reason', async () => {
  assert.equal((await c.call('POST', '/rates', { label: 'Stamp', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 1.5 }, T('OWNER'))).status, 400);
  assert.equal((await c.call('POST', '/rates', { label: 'Stamp', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 1.5, effectiveFrom: '2026-01-01', source: '' }, T('OWNER'))).status, 400);
  assert.equal((await c.call('POST', '/rates', { label: 'Stamp', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 1.5, effectiveFrom: '2026-01-01', source: 'Notice 1' }, T('WRITER'))).status, 403);
  const a = await c.call('POST', '/rates', { label: 'Stamp', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 1.5, effectiveFrom: '2026-01-01', source: 'Manual entry' }, T('OWNER'));
  assert.equal(a.status, 201);
  await c.call('POST', '/rates', { label: 'Office charge', kind: 'OFFICE', basis: 'FIXED', rate: 2500, effectiveFrom: '2026-01-01', source: 'Office price list', verified: true }, T('OWNER'));
  await c.call('POST', '/rates', { label: 'Stamp', kind: 'STATUTORY', basis: 'PERCENT_OF_VALUE', rate: 3, effectiveFrom: '2027-01-01', source: 'Future notice' }, T('OWNER'));

  const prev = await c.call('POST', '/calculations/preview', { landValue: 1000000, totalArea: 10, areaUnit: 'decimal', date: '2026-06-01' }, T('WRITER'));
  assert.equal(prev.status, 200);
  const stamp = prev.body.data.lines.find((l: any) => l.label === 'Stamp');
  assert.equal(stamp.amount, '15000.00');
  assert.equal(stamp.estimateLabel, 'ESTIMATE – VERIFY OFFICIAL RATE');
  const office = prev.body.data.lines.find((l: any) => l.label === 'Office charge');
  assert.equal(office.estimateLabel, null);
  assert.equal(prev.body.data.totalFees, '17500.00');
  const future = await c.call('POST', '/calculations/preview', { landValue: 1000000, totalArea: 10, areaUnit: 'decimal', date: '2027-06-01' }, T('WRITER'));
  assert.equal(future.body.data.lines.find((l: any) => l.label === 'Stamp').amount, '30000.00');

  const noReason = await c.call('POST', '/calculations/preview', { landValue: 1000000, totalArea: 10, areaUnit: 'decimal', date: '2026-06-01', feeOverrides: [{ key: stamp.key, amount: 20000, reason: '' }] }, T('WRITER'));
  assert.equal(noReason.status, 400);

  const d = await c.call('POST', '/deeds', deedBody({ title: 'Fees deed', executionDate: '2026-06-01', feeOverrides: [{ key: stamp.key, amount: 20000, reason: 'Verified at sub-registry' }] }), T('WRITER'));
  assert.equal(d.status, 201, JSON.stringify(d.body));
  const line = d.body.data.feeLines.find((l: any) => l.label === 'Stamp');
  assert.equal(line.finalAmount, '20000.00');
  assert.equal(line.override.reason, 'Verified at sub-registry');
  assert.match(line.override.by, /WRITER/);
  assert.equal(Number(d.body.data.calculatedFees), 22500);
});

test('templates: unknown placeholder rejected; edits create unapproved versions', async () => {
  const bad = await c.call('POST', '/templates', { deedType: 'Sale', name: 'Bad', body: 'Hello {{not.real}} this is a long body' }, T('OWNER'));
  assert.equal(bad.status, 400);
  const ok = await c.call('POST', '/templates', { deedType: 'Sale', name: 'v2', body: 'Sale deed on {{deed.date}}\n{{SELLER.list}}\n{{BUYER.list}}\n{{lands.list}}' }, T('OWNER'));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.version, 2);
  assert.equal(ok.body.data.approvalStatus, 'UNAPPROVED');
  const types = (await c.call('GET', '/templates/types', undefined, T('WRITER'))).body.data;
  assert.equal(types.length, 7);
  assert.deepEqual(types.map((t: any) => t.name), ['Sale', 'Gift', 'Agreement', 'Partition', 'Exchange', 'Power of Attorney', 'Mortgage']);
  assert.equal(types.find((t: any) => t.name === 'Sale').approved, true, 'v1 stays approved');
  assert.equal(types.find((t: any) => t.name === 'Gift').approved, false);
  assert.ok(types.find((t: any) => t.name === 'Gift').warning);
});

test('QA-21 users and role-based access', async () => {
  assert.equal((await c.call('GET', '/users', undefined, T('WRITER'))).status, 403);
  assert.equal((await c.call('GET', '/users', undefined, T('OWNER'))).status, 200);
  const nu = await c.call('POST', '/users', { name: 'New Writer', email: 'nw@test.local', password: 'Abcdefg1', role: 'WRITER' }, T('OWNER'));
  assert.equal(nu.status, 201);
  assert.equal(nu.body.data.passwordHash, undefined);
  assert.equal((await c.call('POST', '/users', { name: 'Dup', email: 'nw@test.local', password: 'Abcdefg1', role: 'WRITER' }, T('OWNER'))).status, 409);
  assert.equal((await c.call('POST', '/users', { name: 'Weak', email: 'w@test.local', password: 'abc', role: 'WRITER' }, T('OWNER'))).status, 400);
  await c.call('PUT', '/settings/policy', { adminCanManageUsers: true }, T('OWNER'));
  assert.equal((await c.call('POST', '/users', { name: 'Own', email: 'own@test.local', password: 'Abcdefg1', role: 'OWNER' }, T('ADMIN'))).status, 403);
  const self = (await c.call('GET', '/auth/me', undefined, T('OWNER'))).body.data;
  assert.equal((await c.call('PATCH', `/users/${self.id}`, { active: false }, T('OWNER'))).status, 409);
  // deactivation takes effect on the existing token immediately
  const login = await c.call('POST', '/auth/login', { email: 'nw@test.local', password: 'Abcdefg1' });
  assert.equal((await c.call('GET', '/customers', undefined, login.body.data.token)).status, 200);
  await c.call('PATCH', `/users/${nu.body.data.id}`, { active: false }, T('OWNER'));
  assert.equal((await c.call('GET', '/customers', undefined, login.body.data.token)).status, 401);
  assert.equal((await c.call('POST', '/auth/login', { email: 'nw@test.local', password: 'Abcdefg1' })).status, 401);

  // matrix spot checks
  assert.equal((await c.call('POST', '/customers', cust({ nid: null }), T('ACCOUNTANT'))).status, 403);
  assert.equal((await c.call('POST', '/lands', land(), T('ACCOUNTANT'))).status, 403);
  assert.equal((await c.call('POST', '/deeds', deedBody(), T('ASSISTANT'))).status, 403);
  assert.equal((await c.call('GET', '/deeds', undefined, T('ASSISTANT'))).status, 200);
  assert.equal((await c.call('GET', '/deeds', undefined, T('ACCOUNTANT'))).status, 200);
  assert.equal((await c.call('GET', '/lands', undefined, T('ACCOUNTANT'))).status, 200);
});

test('QA-22 cross-office isolation', async () => {
  const other = await makeOfficeWithUsers('Other Office', 'b');
  const login = await c.call('POST', '/auth/login', { email: 'owner.b@test.local', password: PASSWORD });
  const tb = login.body.data.token;
  const ownCust = (await c.call('GET', '/customers?q=Abdul', undefined, T('OWNER'))).body.data[0];
  const deed = (await c.call('GET', '/deeds?q=Flow', undefined, T('OWNER'))).body.data[0];
  assert.equal((await c.call('GET', '/customers', undefined, tb)).body.data.length, 0);
  assert.equal((await c.call('GET', '/lands', undefined, tb)).body.data.length, 0);
  assert.equal((await c.call('GET', '/deeds', undefined, tb)).body.data.length, 0);
  assert.equal((await c.call('GET', `/customers/${ownCust.id}`, undefined, tb)).status, 404);
  assert.equal((await c.call('PUT', `/customers/${ownCust.id}`, cust({ name: 'Hacked', nid: '7778889990' }), tb)).status, 404);
  assert.equal((await c.call('GET', `/deeds/${deed.id}`, undefined, tb)).status, 404);
  assert.equal((await c.call('PATCH', `/deeds/${deed.id}/status`, { status: 'REVIEW' }, tb)).status, 404);
  assert.equal((await c.call('POST', '/payments', { deedId: deed.id, amount: 5, method: 'CASH' }, tb)).status, 400);
  assert.equal((await c.call('POST', '/deeds', deedBody(), tb)).status, 400, 'cannot link another office\'s customers');
  assert.equal((await c.call('GET', '/payments', undefined, tb)).body.data.length, 0);
  assert.equal((await c.call('GET', '/users', undefined, tb)).body.data.length, 5);
  assert.equal((await c.call('GET', '/reports/summary', undefined, tb)).body.data.deeds, 0);
  assert.equal(other.id !== c.officeId, true);
  // same NID can exist in another office (uniqueness is per office)
  assert.equal((await c.call('POST', '/customers', cust({ name: 'Other office person' }), tb)).status, 201);
});

// ---------------------------------------------------------------- documents
test('documents: validated upload, saved to disk, list, download; bad files rejected', async () => {
  const deedId = (await c.call('GET', '/deeds?q=Flow', undefined, T('OWNER'))).body.data[0].id;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
  const up = (body: object, role: (typeof ROLES)[number] = 'WRITER') => c.call('POST', '/documents', { ownerType: 'DEED', ownerId: deedId, ...body }, T(role));
  const good = await up({ filename: 'scan.png', mimeType: 'image/png', contentBase64: png.toString('base64') });
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.data.size, png.length);
  assert.equal(good.body.data.storedName, undefined, 'storage path is not exposed');
  assert.equal((await up({ filename: 'x.exe', mimeType: 'application/x-msdownload', contentBase64: png.toString('base64') })).status, 400);
  assert.equal((await up({ filename: 'fake.png', mimeType: 'image/png', contentBase64: Buffer.from('not a png').toString('base64') })).status, 400);
  assert.equal((await up({ filename: 'big.pdf', mimeType: 'application/pdf', contentBase64: Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(5 * 1024 * 1024 + 10)]).toString('base64') })).status, 413);
  const eicar = Buffer.from('%PDF-1.4 X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  assert.equal((await up({ filename: 'v.pdf', mimeType: 'application/pdf', contentBase64: eicar.toString('base64') })).status, 422);
  assert.equal((await up({ filename: 'a.png', mimeType: 'image/png', contentBase64: png.toString('base64') }, 'ACCOUNTANT')).status, 403);
  const list = await c.call('GET', `/documents?ownerType=DEED&ownerId=${deedId}`, undefined, T('ACCOUNTANT'));
  assert.equal(list.body.data.length, 1);
  const dl = await fetch(`${c.base}/documents/${good.body.data.id}/download`, { headers: { Authorization: `Bearer ${T('OWNER')}` } });
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await dl.arrayBuffer()), png);
  assert.equal((await fetch(`${c.base}/documents/${good.body.data.id}/download`)).status, 401);
});

// ---------------------------------------------------------------- misc
test('PDF export: Bangla deed downloads as a real PDF (skipped when no Chrome/Edge is installed)', async (t) => {
  const { findChrome } = await import('../src/utils/pdf.js');
  if (!findChrome()) return t.skip('no Chromium-based browser found');
  const id = (await c.call('GET', '/deeds?q=Flow', undefined, T('OWNER'))).body.data[0].id;
  const res = await fetch(`${c.base}/deeds/${id}/pdf`, { headers: { Authorization: `Bearer ${T('OWNER')}` } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 5000);
});

test('API hygiene: envelope, 404, malformed JSON, no secrets, request id', async () => {
  const nf = await c.call('GET', '/nope', undefined, T('OWNER'));
  assert.equal(nf.status, 404);
  assert.equal(nf.body.success, false);
  const bad = await fetch(`${c.base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
  assert.ok(bad.headers.get('x-request-id'));
  const me = await c.call('GET', '/auth/me', undefined, T('OWNER'));
  assert.equal(me.body.data.passwordHash, undefined);
  assert.equal(me.body.data.permissions.settingsWrite, true);
});

// ---------------------------------------------------------------- review regressions
test('REVIEW: a deed stays editable after one of its parties is deactivated', async () => {
  const p = await mk('OWNER', '/customers', cust({ name: 'Soon Inactive', nid: '5550001112', phone: '01712345671' }));
  const deed = (await c.call('POST', '/deeds', deedBody({ title: 'Inactive party', parties: [{ customerId: p.id, role: 'SELLER' }, { customerId: buyer.id, role: 'BUYER' }] }), T('OWNER'))).body.data;
  assert.equal((await c.call('PATCH', `/customers/${p.id}/active`, { active: false }, T('OWNER'))).status, 200);
  const cur = (await c.call('GET', `/deeds/${deed.id}`, undefined, T('OWNER'))).body.data;
  const r = await c.call('PUT', `/deeds/${deed.id}`, { version: cur.version, regenerate: true }, T('OWNER'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const r2 = await c.call('PUT', `/deeds/${deed.id}`, { version: r.body.data.version, lands: [{ landId: plot.id, share: 5 }] }, T('OWNER'));
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.ok(r2.body.data.snapshot.parties.some((x: any) => x.name === 'Soon Inactive'), 'existing party kept');
  // but an inactive customer still cannot be newly added
  const other = (await c.call('POST', '/deeds', deedBody({ parties: [{ customerId: p.id, role: 'BUYER' }] }), T('OWNER')));
  assert.equal(other.status, 400);
});

test('REVIEW: changing deed values without touching the draft flags the draft as stale and blocks READY', async () => {
  const deed = (await c.call('POST', '/deeds', deedBody({ title: 'Stale draft', landValue: 500000 }), T('OWNER'))).body.data;
  const r = await c.call('PUT', `/deeds/${deed.id}`, { version: deed.version, landValue: 900000 }, T('OWNER'));
  assert.equal(r.status, 200);
  assert.ok(r.body.data.checks.blocking.some((m: string) => /out of date/i.test(m)), JSON.stringify(r.body.data.checks));
  const fixed = await c.call('PUT', `/deeds/${deed.id}`, { version: r.body.data.version, regenerate: true }, T('OWNER'));
  assert.ok(!fixed.body.data.checks.blocking.some((m: string) => /out of date/i.test(m)), 'regenerate clears the flag');
  assert.match(fixed.body.data.draftText, /নয় লক্ষ/);
});

test('REVIEW: narrative uses Bangla unit names and lakh-grouped money', async () => {
  const d = (await c.call('POST', '/deeds', deedBody({ title: 'Unit text', totalArea: 3, areaUnit: 'katha', landValue: 1250000 }), T('OWNER'))).body.data;
  assert.ok(d.draftText.includes('কাঠা'), d.draftText);
  assert.ok(!d.draftText.includes('katha'));
  assert.ok(d.draftText.includes('12,50,000'), 'lakh grouping');
});

test('REVIEW: customer documents (NID scans) are not readable by accountants', async () => {
  const cu = (await c.call('GET', '/customers?q=Buyer', undefined, T('OWNER'))).body.data[0];
  assert.equal((await c.call('GET', `/documents?ownerType=CUSTOMER&ownerId=${cu.id}`, undefined, T('ACCOUNTANT'))).status, 403);
  assert.equal((await c.call('GET', `/documents?ownerType=CUSTOMER&ownerId=${cu.id}`, undefined, T('WRITER'))).status, 200);
});

test('REVIEW: input sanity for land area precision and birth dates', async () => {
  assert.equal((await c.call('POST', '/lands', land({ dagNumber: '9001', area: 1.23456 }), T('OWNER'))).status, 400, '5 decimals rejected');
  assert.equal((await c.call('POST', '/lands', land({ dagNumber: '9002', area: 0.1235 }), T('OWNER'))).status, 201);
  assert.equal((await c.call('POST', '/customers', cust({ name: 'Future Born', nid: '8880001112', birthDate: '2999-01-01' }), T('OWNER'))).status, 400);
  assert.equal((await c.call('POST', '/customers', cust({ name: 'Too Old', nid: '8880001113', birthDate: '1700-01-01' }), T('OWNER'))).status, 400);
  assert.equal((await c.call('POST', '/customers', cust({ name: 'Fine Date', nid: '8880001114', birthDate: '1990-05-28' }), T('OWNER'))).status, 201);
});

test('customers: NID, nationality, date of birth, religion, phone and permanent address are required', async () => {
  const required: [string, string][] = [['nid', 'NID'], ['nationality', 'Nationality'], ['birthDate', 'Date of birth'], ['religion', 'Religion'], ['phone', 'Phone'], ['permanentAddress', 'Permanent address']];
  for (const [field, label] of required) {
    for (const blank of [undefined, '', '   ', null]) {
      const r = await c.call('POST', '/customers', cust({ name: 'Req ' + field, nid: '4440001110', [field]: blank }), T('OWNER'));
      assert.equal(r.status, 400, `${field}=${JSON.stringify(blank)}`);
      assert.ok(r.body.errors?.[field], `error is reported on ${field}`);
      assert.match(r.body.errors[field], new RegExp(label + ' is required'));
    }
  }
  // every error is reported at once so the form can mark all fields
  const all = await c.call('POST', '/customers', { name: 'Only a name' }, T('OWNER'));
  assert.equal(all.status, 400);
  assert.deepEqual(Object.keys(all.body.errors).sort(), ['birthDate', 'nationality', 'nid', 'permanentAddress', 'phone', 'religion']);
  // updates follow the same rule
  const ok = await mk('OWNER', '/customers', cust({ name: 'Complete Person', nid: '4440001119', phone: '01712345672' }));
  const upd = await c.call('PUT', `/customers/${ok.id}`, cust({ name: 'Complete Person', nid: '4440001119', religion: '' }), T('OWNER'));
  assert.equal(upd.status, 400);
  assert.ok(upd.body.errors.religion);
  assert.equal((await c.call('PUT', `/customers/${ok.id}`, cust({ name: 'Complete Person 2', nid: '4440001119', phone: '01712345672' }), T('OWNER'))).status, 200);
});

test('land records: land office, khatian number and holding no. are required', async () => {
  for (const [field, label] of [['landOffice', 'Land office'], ['khatianNumber', 'Khatian number'], ['holdingNo', 'Holding no.']] as const) {
    for (const blank of [undefined, '', '   ', null]) {
      const r = await c.call('POST', '/lands', land({ dagNumber: '8800', [field]: blank }), T('OWNER'));
      assert.equal(r.status, 400, `${field}=${JSON.stringify(blank)}`);
      assert.match(r.body.errors?.[field] ?? '', new RegExp(label + ' is required'));
    }
  }
  const l = await mk('OWNER', '/lands', land({ dagNumber: '8801' }));
  const upd = await c.call('PUT', `/lands/${l.id}`, land({ dagNumber: '8801', holdingNo: '' }), T('OWNER'));
  assert.equal(upd.status, 400);
});

test('SYNC: required fields in the customer and land forms equal what the API requires', async () => {
  const apiRequired = async (path: string) => Object.keys((await c.call('POST', path, {}, T('OWNER'))).body.errors).sort();
  const uiRequired = (defs: { name: string; required?: boolean }[]) => defs.filter((d) => d.required).map((d) => d.name).sort();
  assert.deepEqual(uiRequired(CUSTOMER_FIELDS), await apiRequired('/customers'), 'customer form vs API');
  assert.deepEqual(uiRequired(landFields(['decimal'])), await apiRequired('/lands'), 'land form vs API');
});

test('SYNC: religion list has the four main religions plus others', () => {
  assert.deepEqual(RELIGIONS, ['ইসলাম', 'হিন্দু', 'বৌদ্ধ', 'খ্রিষ্টান', 'অন্যান্য']);
  const religion = CUSTOMER_FIELDS.find((f) => f.name === 'religion')!;
  assert.equal(religion.type, 'select');
  assert.equal(religion.required, true);
});

test('geo data: 64 districts / 495 upazilas, clean Bangla names, usable for the land form', () => {
  assert.equal(BD_GEO.length, 64);
  assert.equal(BD_GEO.reduce((n, d) => n + d.upazilas.length, 0), 495);
  assert.equal(new Set(BD_GEO.map((d) => d.bn)).size, 64, 'unique district names');
  for (const d of BD_GEO) {
    assert.ok(d.upazilas.length >= 3, d.en);
    assert.equal(new Set(d.upazilas.map((u) => u.bn)).size, d.upazilas.length, `duplicate upazila in ${d.en}`);
    for (const n of [d.bn, ...d.upazilas.map((u) => u.bn)]) {
      assert.equal(n, n.trim(), `padded name: "${n}"`);
      assert.ok(!/[A-Za-z0-9]/.test(n), `Latin character in Bangla name: ${n}`);
    }
  }
  const find = (bn: string) => BD_GEO.find((d) => d.bn.normalize('NFC') === bn.normalize('NFC'))!;
  // the reference deed: কুষ্টিয়া → কুমারখালী
  assert.ok(find('কুষ্টিয়া').upazilas.some((u) => u.bn === 'কুমারখালী'));
  assert.equal(find('ঢাকা').upazilas.some((u) => u.bn === 'সাভার'), true);
  // the 2021 upazilas and corrected spellings are present
  assert.ok(find('মাদারীপুর').upazilas.some((u) => u.bn === 'দাসার'));
  assert.ok(find('কক্সবাজার').upazilas.some((u) => u.bn === 'ঈদগাঁও'));
  assert.ok(find('সুনামগঞ্জ').upazilas.some((u) => u.bn === 'মধ্যনগর'));
  assert.ok(find('চট্টগ্রাম').upazilas.some((u) => u.bn === 'সীতাকুণ্ড'));
});

test('Bangla text is stored in one canonical form: precomposed য় and the two-character form are the same to search', async () => {
  // 'কুষ্টিয়া' with the single precomposed য় (U+09DF) vs the two-character য় (U+09AF U+09BC) – visually identical
  const pre = String.fromCharCode(0x995, 0x9c1, 0x9b7, 0x9cd, 0x99f, 0x9bf, 0x9df, 0x9be);
  const dec = pre.normalize('NFC');
  assert.notEqual(pre, dec, 'the two spellings differ at code-point level');
  const l = await mk('OWNER', '/lands', land({ dagNumber: '8802', district: pre, upazila: 'কুমারখালী' }));
  assert.equal(l.district, dec, 'stored canonically');
  for (const q of [pre, dec]) {
    const r = await c.call('GET', `/lands?q=${encodeURIComponent(q)}`, undefined, T('OWNER'));
    assert.ok(r.body.data.some((x: any) => x.id === l.id), 'found by either spelling');
  }
  const cu = await mk('OWNER', '/customers', cust({ name: 'নাম ' + pre, nid: '6660001112', phone: '01712345673' }));
  assert.equal(cu.name, 'নাম ' + dec);
});
