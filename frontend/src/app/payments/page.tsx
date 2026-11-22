"use client";
import AppShell from '@/components/AppShell';
import EntityPicker, { type Picked } from '@/components/EntityPicker';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, apiPage, bdt, download, fmtDateTime, qs, type Page } from '@/lib/api';
import { Alert, ConfirmModal, EmptyRow, ErrorState, Field, Pagination, Pill, Spinner, focusFirstError, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const deedItem = (d: any) => ({ id: d.id, label: d.title, sub: `${d.status} · Received ${bdt(d.received)}${d.due != null ? ` · Due ${bdt(d.due)}` : ''}` });

function Payments() {
  const me = useMe();
  const toast = useToast();
  const canWrite = can(me.role, 'payment:write');
  const [deed, setDeed] = useState<Picked | null>(null);
  const [form, setForm] = useState({ amount: '', method: 'CASH', reference: '', paidAt: nowLocal(), note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const [rev, setRev] = useState<any>(null);
  const save = useSubmit();
  const act = useSubmit();
  const exp = useSubmit();

  const [filters, setFilters] = useState({ method: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [filterErr, setFilterErr] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Page<any[]> | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    apiPage<any[]>(`/payments${qs({ ...applied, page, limit: 20 })}`)
      .then(setRes)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [applied, page]);
  useEffect(load, [load]);

  // /payments?deedId=… preselects a deed (link from the deed page)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('deedId');
    if (!id) return;
    api<any>(`/deeds/${id}`).then((d) => setDeed({ id: d.id, label: d.title })).catch(() => {});
  }, []);

  function applyFilters() {
    if (filters.from && filters.to && filters.from > filters.to) return setFilterErr('Start date must be on or before the end date.');
    setFilterErr('');
    setPage(1);
    setApplied(filters);
  }

  async function submit(e: React.FormEvent, confirmOverpayment = false) {
    e.preventDefault();
    setFormError('');
    const errs: Record<string, string> = {};
    if (!deed) errs.deedId = 'Select a deed';
    if (!(Number(form.amount) > 0)) errs.amount = 'Enter an amount greater than zero';
    else if (Math.round(Number(form.amount) * 100) / 100 !== Number(form.amount)) errs.amount = 'Amount can have at most 2 decimal places';
    if (form.paidAt && new Date(form.paidAt).getTime() > Date.now() + 5 * 60000) errs.paidAt = 'Payment date cannot be in the future';
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await save.run(async () => {
      try {
        const p = await api<any>('/payments', {
          method: 'POST',
          body: JSON.stringify({ deedId: deed!.id, amount: Number(form.amount), method: form.method, reference: form.reference.trim(), note: form.note.trim(), paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined, confirmOverpayment }),
        });
        toast.success(`Payment recorded – receipt ${p.receiptNo}`);
        setForm({ amount: '', method: 'CASH', reference: '', paidAt: nowLocal(), note: '' });
        setDeed(null);
        setOver(null);
        load();
      } catch (err: any) {
        if (err instanceof ApiError && err.code === 'OVERPAYMENT') return setOver(err.message);
        if (err instanceof ApiError && err.errors) { setErrors(err.errors); focusFirstError(); }
        setFormError(err.message);
      }
    });
  }

  async function reverse(reason: string) {
    await act.run(async () => {
      try {
        await api(`/payments/${rev.id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
        toast.success('Payment reversed – the original receipt is kept in the history');
        setRev(null);
        load();
      } catch (e: any) {
        setRev(null);
        toast.error(e.message);
      }
    });
  }

  if (!can(me.role, 'payment:read')) return <Alert kind="error">Your role cannot access payments.</Alert>;
  const rows = res?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payment management</h1>
          <p className="muted text-sm">Record customer payments and review receipts. Payments are never edited or deleted; corrections are made by reversal.</p>
        </div>
        {can(me.role, 'report:payments') && (
          <button className="btn btn-secondary" disabled={exp.busy} onClick={() => exp.run(async () => { try { await download(`/reports/payments-csv${qs({ from: applied.from, to: applied.to })}`, 'dolil-os-payments-report.csv'); } catch (e: any) { toast.error(e.message); } })}>
            {exp.busy ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>

      {canWrite && (
        <form onSubmit={(e) => submit(e)} noValidate className="panel grid gap-4 p-5 md:grid-cols-4">
          <Field label="Deed" required error={errors.deedId} className="md:col-span-2">
            <EntityPicker endpoint="/deeds" extraQuery={{ forPayment: 1 }} value={deed} onChange={(v) => { setDeed(v); setErrors({ ...errors, deedId: '' }); }} toItem={deedItem} placeholder="Search and select a deed" invalid={!!errors.deedId} />
          </Field>
          <Field label="Amount (BDT)" required error={errors.amount}>
            <input className="field" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-invalid={!!errors.amount} />
          </Field>
          <Field label="Method" required>
            <select className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="CASH">Cash</option><option value="BANK">Bank</option><option value="MOBILE">Mobile financial service</option>
            </select>
          </Field>
          <Field label="Reference"><input className="field" value={form.reference} maxLength={100} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <Field label="Date & time" error={errors.paidAt}><input className="field" type="datetime-local" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} /></Field>
          <Field label="Note" className="md:col-span-1"><input className="field" value={form.note} maxLength={1000} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex items-end"><button className="btn w-full" disabled={save.busy}>{save.busy ? 'Recording…' : 'Record payment'}</button></div>
          {formError && <div className="md:col-span-4"><Alert kind="error">{formError}</Alert></div>}
        </form>
      )}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Method"><select className="field" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}><option value="">All</option><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="MOBILE">Mobile</option></select></Field>
          <Field label="From"><input className="field" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></Field>
          <Field label="To"><input className="field" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></Field>
          <button className="btn btn-secondary" onClick={applyFilters}>Apply filters</button>
          <button className="btn btn-secondary" onClick={() => { const z = { method: '', from: '', to: '' }; setFilters(z); setApplied(z); setFilterErr(''); setPage(1); }}>Clear</button>
          {filterErr && <p className="w-full text-sm text-red-600" role="alert">{filterErr}</p>}
        </div>
        {loading && !res ? <Spinner /> : err ? <div className="p-4"><ErrorState message={err} onRetry={load} /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Receipt</th><th>Deed</th><th>Amount</th><th>Method</th><th>Date</th><th>Received by</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} className={x.type === 'REVERSAL' ? 'bg-red-50/50' : ''}>
                      <td className="font-mono text-xs">{x.receiptNo} {x.type === 'REVERSAL' && <Pill tone="red">Reversal</Pill>} {x.reversed && <Pill tone="amber">Reversed</Pill>}</td>
                      <td><Link className="text-emerald-700 hover:underline" href={`/deeds/${x.deed.id}`}>{x.deed.title}</Link></td>
                      <td className={`whitespace-nowrap ${x.type === 'REVERSAL' ? 'text-red-700' : ''}`}>{x.type === 'REVERSAL' ? '−' : ''}{bdt(x.amount)}</td>
                      <td>{x.method}</td><td>{fmtDateTime(x.paidAt)}</td><td>{x.receivedBy.name}</td>
                      <td className="whitespace-nowrap">
                        <Link className="linkbtn" href={`/payments/${x.id}`}>View receipt</Link>
                        <Link className="linkbtn" href={`/payments/${x.id}?print=1`}>Print receipt</Link>
                        {canWrite && x.type === 'PAYMENT' && !x.reversed && <button className="linkbtn danger" onClick={() => setRev(x)}>Reverse</button>}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <EmptyRow cols={7} text="No payments recorded." />}
                </tbody>
              </table>
            </div>
            <Pagination meta={res?.meta} onPage={setPage} />
          </>
        )}
      </div>

      {over && (
        <ConfirmModal title="Payment exceeds the due amount" message={over} confirmLabel="Record anyway" busy={save.busy} onClose={() => setOver(null)} onConfirm={() => submit({ preventDefault() {} } as any, true)} />
      )}
      {rev && (
        <ConfirmModal title={`Reverse receipt ${rev.receiptNo}?`} danger requireReason confirmLabel="Reverse payment" busy={act.busy}
          message={`A reversal of ${bdt(rev.amount)} will be added. The original receipt stays in the history and cannot be edited or deleted.`}
          onClose={() => setRev(null)} onConfirm={reverse} />
      )}
    </div>
  );
}

export default function Page() {
  return <AppShell><Payments /></AppShell>;
}
