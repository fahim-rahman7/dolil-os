"use client";
import AppShell from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { apiPage, bdt, fmtDate, qs, type Page } from '@/lib/api';
import { EmptyRow, ErrorState, Pagination, Spinner, StatusBadge, useDebounced } from '@/components/ui';
import StatusModal, { type Transition } from '@/components/StatusModal';
import { useMe } from '@/lib/session';
import { can, STATUS_LABEL } from '@/lib/perms';

function Deeds() {
  const me = useMe();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Page<any[]> | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [change, setChange] = useState<null | { deed: any; t: Transition }>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    apiPage<any[]>(`/deeds${qs({ q: dq, status: status === 'ALL' ? '' : status, page, limit: 20 })}`)
      .then(setRes)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [dq, status, page]);
  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, status]);

  const showMoney = can(me.role, 'payment:read');
  const rows = res?.data ?? [];
  const cols = showMoney ? 8 : 7;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">দলিলসমূহ <span className="text-base font-medium text-slate-400">Deeds</span></h1>
          <p className="muted text-sm">Search, track and open deeds.</p>
        </div>
        {can(me.role, 'deed:write') && <Link href="/new-deed" className="btn"><Plus size={17} /> নতুন দলিল</Link>}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="field !pl-9" placeholder="Search title, deed number or type" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search deeds" />
          </div>
          <button className="btn btn-secondary" onClick={() => setQ('')} disabled={!q}>Clear search</button>
          <select className="field sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {loading && !res ? <Spinner /> : err ? (
          <div className="p-4"><ErrorState message={err} onRetry={load} /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Parties</th><th>Status</th><th>Land value</th>{showMoney && <th>Due</th>}<th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium">
                        <Link className="text-emerald-700 hover:underline" href={`/deeds/${d.id}`}>{d.title}</Link>
                        {d.deedNumber && <div className="text-xs muted">No. {d.deedNumber}</div>}
                      </td>
                      <td><span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tracking-wide text-slate-700">{d.deedType}</span></td>
                      <td className="max-w-xs text-xs">{d.partyNames.slice(0, 3).join(', ') || '—'}{d.partyNames.length > 3 ? ` +${d.partyNames.length - 3}` : ''}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="whitespace-nowrap">{bdt(d.landValue)}</td>
                      {showMoney && <td className="whitespace-nowrap">{d.due == null ? '—' : bdt(d.due)}</td>}
                      <td>{fmtDate(d.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        <Link className="linkbtn" href={`/deeds/${d.id}`}>View</Link>
                        <a className="linkbtn" href={`/deeds/${d.id}/print`} target="_blank" rel="noreferrer">Print</a>
                        {d.allowedTransitions.length > 0 && (
                          <select className="field ml-1 inline-block !w-auto !py-1 text-sm" aria-label={`Update status for ${d.title}`} value="" onChange={(e) => {
                            const t = d.allowedTransitions.find((x: Transition) => x.to === e.target.value);
                            if (t) setChange({ deed: d, t });
                          }}>
                            <option value="">Update status…</option>
                            {d.allowedTransitions.map((t: Transition) => <option key={t.to} value={t.to}>{t.to === 'CANCELLED' ? 'Cancel deed' : `→ ${STATUS_LABEL[t.to]}`}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <EmptyRow cols={cols} text={dq || status !== 'ALL' ? 'No deeds match your search.' : 'No deeds yet.'} />}
                </tbody>
              </table>
            </div>
            <Pagination meta={res?.meta} onPage={setPage} />
          </>
        )}
      </div>
      {change && <StatusModal deed={change.deed} transition={change.t} onClose={() => setChange(null)} onDone={() => { setChange(null); load(); }} />}
    </>
  );
}

export default function Page() {
  return <AppShell><Deeds /></AppShell>;
}
