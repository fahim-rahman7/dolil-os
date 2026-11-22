"use client";
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, fmtDate } from '@/lib/api';
import { Alert, Field, Pill, Spinner, focusFirstError, useSubmit, useToast } from '@/components/ui';

export default function CalcSettings({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<any>(null);
  const [rates, setRates] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    api<any>('/settings').then((s) => setCfg(s.areaConversions)).catch((e) => setErr(e.message));
    api<any[]>('/rates').then(setRates).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  // ---- area conversions
  const [rows, setRows] = useState<{ unit: string; factor: string }[]>([]);
  const [source, setSource] = useState('');
  const [areaErr, setAreaErr] = useState('');
  const area = useSubmit();
  useEffect(() => {
    if (cfg) { setRows(Object.entries(cfg.factors).map(([unit, f]) => ({ unit, factor: String(f) }))); setSource(cfg.source); }
  }, [cfg]);

  async function saveArea() {
    setAreaErr('');
    if (!source.trim()) return setAreaErr('Enter the source of these conversion factors');
    if (rows.some((r) => !/^[A-Za-z][A-Za-z0-9_ -]{0,19}$/.test(r.unit) || !(Number(r.factor) > 0))) return setAreaErr('Every unit needs a name and a factor greater than zero');
    if (new Set(rows.map((r) => r.unit.toLowerCase())).size !== rows.length) return setAreaErr('Unit names must be unique');
    await area.run(async () => {
      try {
        await api('/settings/area-conversions', { method: 'PUT', body: JSON.stringify({ source: source.trim(), factors: Object.fromEntries(rows.map((r) => [r.unit, Number(r.factor)])) }) });
        toast.success('Area conversions saved');
        load();
      } catch (e: any) { setAreaErr(e.message); }
    });
  }

  // ---- rates
  const blank = { label: '', kind: 'OFFICE', basis: 'FIXED', rate: '', effectiveFrom: new Date().toISOString().slice(0, 10), source: '', verified: false };
  const [rf, setRf] = useState<any>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateErr, setRateErr] = useState('');
  const rate = useSubmit();

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setRateErr('');
    const errs: Record<string, string> = {};
    if (!rf.label.trim()) errs.label = 'Label is required';
    if (rf.rate === '' || Number(rf.rate) < 0) errs.rate = 'Enter a rate (0 or more)';
    if (!rf.effectiveFrom) errs.effectiveFrom = 'Effective date is required';
    if (rf.source.trim().length < 3) errs.source = 'A source is required (e.g. circular / price list reference)';
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await rate.run(async () => {
      try {
        await api('/rates', { method: 'POST', body: JSON.stringify({ ...rf, label: rf.label.trim(), source: rf.source.trim(), rate: Number(rf.rate) }) });
        toast.success('Rate saved');
        setRf(blank);
        load();
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) { setErrors(err.errors); focusFirstError(); }
        setRateErr(err.message);
      }
    });
  }
  async function patch(id: string, body: object) {
    try { await api(`/rates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); load(); } catch (e: any) { toast.error(e.message); }
  }

  if (err) return <Alert kind="error">{err}</Alert>;
  if (!cfg || !rates) return <Spinner />;
  return (
    <div className="space-y-5">
      <div className="panel space-y-4 p-5">
        <h2 className="font-semibold">Area conversion table</h2>
        <p className="text-sm muted">Square feet per 1 unit. The default values are conventional and must be verified by the office. Deeds always show the original value, the converted value and the factor used.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input className="field" value={r.unit} disabled={!canWrite} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} aria-label="Unit name" />
              <input className="field" type="number" min="0" step="any" value={r.factor} disabled={!canWrite} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, factor: e.target.value } : x)))} aria-label="Square feet per unit" />
              {canWrite && <button type="button" className="linkbtn danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          ))}
        </div>
        {canWrite && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { unit: '', factor: '' }])}>Add unit</button>
            <Field label="Source / approver of these factors" required><input className="field" value={source} onChange={(e) => setSource(e.target.value)} /></Field>
            {areaErr && <Alert kind="error">{areaErr}</Alert>}
            <button className="btn" onClick={saveArea} disabled={area.busy}>{area.busy ? 'Saving…' : 'Save calculation settings'}</button>
          </>
        )}
      </div>

      <div className="panel space-y-4 p-5">
        <h2 className="font-semibold">Office charges &amp; statutory fee estimates</h2>
        <p className="text-sm muted">Rates are effective-dated: a change is a new row with a later effective date. Unverified rates are always labelled “ESTIMATE – VERIFY OFFICIAL RATE”. Statutory rates are never presented as official.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Label</th><th>Kind</th><th>Basis</th><th>Rate</th><th>Effective</th><th>Source</th><th>Status</th>{canWrite && <th />}</tr></thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                  <td className="font-medium">{r.label}</td><td>{r.kind}</td><td className="text-xs">{r.basis.replaceAll('_', ' ').toLowerCase()}</td>
                  <td>{Number(r.rate)}</td><td>{fmtDate(r.effectiveFrom)}</td><td className="max-w-[12rem] text-xs">{r.source}</td>
                  <td>{r.verified ? <Pill tone="green">Verified{r.approvedBy ? ` by ${r.approvedBy}` : ''}</Pill> : <Pill tone="amber">Estimate</Pill>} {!r.active && <Pill>Inactive</Pill>}</td>
                  {canWrite && (
                    <td className="whitespace-nowrap">
                      <button className="linkbtn" onClick={() => patch(r.id, { verified: !r.verified })}>{r.verified ? 'Unverify' : 'Mark verified'}</button>
                      <button className="linkbtn" onClick={() => patch(r.id, { active: !r.active })}>{r.active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  )}
                </tr>
              ))}
              {!rates.length && <tr><td colSpan={8} className="py-6 text-center muted">No rates configured. Deeds will show no fee lines.</td></tr>}
            </tbody>
          </table>
        </div>
        {canWrite && (
          <form onSubmit={addRate} noValidate className="grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-3">
            <Field label="Label" required error={errors.label}><input className="field" value={rf.label} onChange={(e) => setRf({ ...rf, label: e.target.value })} placeholder="e.g. Drafting charge" /></Field>
            <Field label="Kind"><select className="field" value={rf.kind} onChange={(e) => setRf({ ...rf, kind: e.target.value })}><option value="OFFICE">Office charge</option><option value="STATUTORY">Statutory fee estimate</option></select></Field>
            <Field label="Basis"><select className="field" value={rf.basis} onChange={(e) => setRf({ ...rf, basis: e.target.value })}><option value="FIXED">Fixed amount</option><option value="PERCENT_OF_VALUE">% of land value</option><option value="PER_AREA_UNIT">Per area unit</option></select></Field>
            <Field label="Rate" required error={errors.rate}><input className="field" type="number" min="0" step="any" value={rf.rate} onChange={(e) => setRf({ ...rf, rate: e.target.value })} /></Field>
            <Field label="Effective from" required error={errors.effectiveFrom}><input className="field" type="date" value={rf.effectiveFrom} onChange={(e) => setRf({ ...rf, effectiveFrom: e.target.value })} /></Field>
            <Field label="Source" required error={errors.source}><input className="field" value={rf.source} onChange={(e) => setRf({ ...rf, source: e.target.value })} placeholder="Circular no. / price list" /></Field>
            <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" checked={rf.verified} onChange={(e) => setRf({ ...rf, verified: e.target.checked })} /> I have verified this rate against the official source (records you as approver)</label>
            {rateErr && <div className="md:col-span-3"><Alert kind="error">{rateErr}</Alert></div>}
            <div className="md:col-span-3"><button className="btn" disabled={rate.busy}>{rate.busy ? 'Saving…' : 'Add rate'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
