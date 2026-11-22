"use client";
import AppShell from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, bdt, download, qs } from '@/lib/api';
import { ErrorState, Field, Spinner, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

function Reports() {
  const me = useMe();
  const toast = useToast();
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState(range);
  const [rangeErr, setRangeErr] = useState('');
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const csv = useSubmit();

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api(`/reports/summary${qs(applied)}`).then(setS).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [applied]);
  useEffect(load, [load]);

  function apply() {
    if (range.from && range.to && range.from > range.to) return setRangeErr('Start date must be on or before the end date.');
    setRangeErr('');
    setApplied(range);
  }
  const exportCsv = (path: string, name: string) =>
    csv.run(async () => {
      try {
        await download(`${path}${qs(applied)}`, name);
        toast.success('Report exported');
      } catch (e: any) {
        toast.error(e.message);
      }
    });

  const cards: [string, React.ReactNode][] = s
    ? [['Total deeds', s.deeds], ['Customers', s.customers], ...(s.totalPayments !== undefined ? [['Received amount', bdt(s.totalPayments)] as [string, React.ReactNode]] : []), ['Pending deeds', s.pending], ['Printed / delivered', s.completed], ['Cancelled', s.cancelled]]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="muted text-sm">Office summary and CSV exports. Dates use the office timezone (Asia/Dhaka).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          {can(me.role, 'report:deeds') && <button className="btn" disabled={csv.busy} onClick={() => exportCsv('/reports/csv', 'dolil-os-deeds-report.csv')}>{csv.busy ? 'Exporting…' : 'Export deeds CSV'}</button>}
          {can(me.role, 'report:payments') && <button className="btn" disabled={csv.busy} onClick={() => exportCsv('/reports/payments-csv', 'dolil-os-payments-report.csv')}>{csv.busy ? 'Exporting…' : 'Export payments CSV'}</button>}
        </div>
      </div>
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <Field label="From"><input className="field" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
        <Field label="To"><input className="field" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        <button className="btn" onClick={apply}>Apply date filter</button>
        <button className="btn btn-secondary" onClick={() => { const z = { from: '', to: '' }; setRange(z); setApplied(z); setRangeErr(''); }}>Clear</button>
        {rangeErr && <p className="w-full text-sm text-red-600" role="alert">{rangeErr}</p>}
      </div>
      {loading ? <Spinner /> : err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([k, v]) => <div className="stat" key={k}><div className="muted text-sm">{k}</div><div className="mt-3 text-2xl font-bold">{v}</div></div>)}
        </div>
      )}
      {!can(me.role, 'report:deeds') && !can(me.role, 'report:payments') && <p className="text-sm muted">Your role can view the summary. CSV exports are limited to deed and payment report roles.</p>}
    </div>
  );
}

export default function Page() {
  return <AppShell><Reports /></AppShell>;
}
