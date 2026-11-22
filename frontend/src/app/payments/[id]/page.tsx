"use client";
import AppShell from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { api, bdt, fmtDateTime } from '@/lib/api';
import { Alert, ErrorState, Spinner } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

function Receipt() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api(`/payments/${id}`).then(setP).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    if (p && new URLSearchParams(window.location.search).get('print') === '1') setTimeout(() => window.print(), 300);
  }, [p]);

  if (!can(me.role, 'payment:read')) return <Alert kind="error">Your role cannot view receipts.</Alert>;
  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!p) return <Spinner />;
  const rev = p.type === 'REVERSAL';
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="noprint flex items-center justify-between">
        <Link href="/payments" className="linkbtn inline-flex items-center gap-1 !pl-0"><ArrowLeft size={14} /> Back to payments</Link>
        <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print receipt</button>
      </div>
      <article className="panel relative p-8 print-sheet">
        {(rev || p.reversed) && <div className="watermark" aria-hidden>{rev ? 'REVERSAL' : 'REVERSED'}</div>}
        <div className="relative z-10">
          <header className="border-b border-slate-300 pb-4 text-center">
            <h1 className="text-xl font-bold">{p.office.name}</h1>
            <div className="whitespace-pre-line text-sm muted">{[p.office.address, p.office.phone, p.office.email].filter(Boolean).join('\n')}</div>
            <h2 className="mt-3 text-lg font-semibold">{rev ? 'Payment Reversal Receipt' : 'Payment Receipt'}</h2>
          </header>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="muted">Receipt no.</dt><dd className="font-mono font-semibold">{p.receiptNo}</dd></div>
            <div><dt className="muted">Date</dt><dd className="font-medium">{fmtDateTime(p.paidAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="muted">For deed</dt><dd className="font-medium">{p.deed.title} ({p.deed.deedType}){p.deed.deedNumber ? ` – No. ${p.deed.deedNumber}` : ''}</dd></div>
            <div><dt className="muted">{rev ? 'Amount reversed' : 'Amount received'}</dt><dd className="text-2xl font-bold">{bdt(p.amount)}</dd></div>
            <div><dt className="muted">Method</dt><dd className="font-medium">{p.method}</dd></div>
            <div><dt className="muted">Reference</dt><dd className="font-medium">{p.reference || '—'}</dd></div>
            <div><dt className="muted">Received by</dt><dd className="font-medium">{p.receivedBy.name}</dd></div>
            {p.note && <div className="sm:col-span-2"><dt className="muted">Note</dt><dd>{p.note}</dd></div>}
          </dl>
          {p.reversed && <p className="mt-4 text-sm text-red-700">This payment was reversed (reversal receipt {p.reversedBy.receiptNo}).</p>}
          <div className="mt-5 grid gap-3 border-t border-slate-300 pt-4 text-sm sm:grid-cols-2">
            <div><dt className="muted">Total received for this deed</dt><dd className="font-semibold">{bdt(p.totalReceived)}</dd></div>
            {p.due != null && <div><dt className="muted">Outstanding office due</dt><dd className="font-semibold">{bdt(p.due)}</dd></div>}
          </div>
          <p className="mt-6 text-xs muted">Office charge receipt only. This is not a government registration fee receipt.</p>
        </div>
      </article>
    </div>
  );
}

export default function Page() {
  return <AppShell><Receipt /></AppShell>;
}
