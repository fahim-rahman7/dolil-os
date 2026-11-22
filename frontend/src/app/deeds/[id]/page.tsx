"use client";
import AppShell from '@/components/AppShell';
import DeedForm from '@/components/DeedForm';
import DocumentsPanel from '@/components/DocumentsPanel';
import DocumentFrame from '@/components/DocumentFrame';
import StatusModal, { type Transition } from '@/components/StatusModal';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Pencil, Printer, Trash2 } from 'lucide-react';
import { api, bdt, download, fmtDate, fmtDateTime } from '@/lib/api';
import { Alert, ConfirmModal, ErrorState, Pill, Spinner, StatusBadge, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/perms';

const LABEL: Record<string, (from: string) => string> = {
  REVIEW: (f) => (f === 'DRAFT' ? 'Move to Review' : 'Return to Review'),
  READY: () => 'Mark Ready',
  PRINTED: () => 'Mark Printed',
  DELIVERED: () => 'Mark Delivered',
  CANCELLED: () => 'Cancel Deed',
  DRAFT: (f) => (f === 'CANCELLED' ? 'Reopen as Draft' : 'Return to Draft'),
};

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const [hist, setHist] = useState<any>(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [change, setChange] = useState<Transition | null>(null);
  const [del, setDel] = useState(false);
  const pdf = useSubmit();
  const docx = useSubmit();
  const rm = useSubmit();

  const load = useCallback(() => {
    setErr('');
    api<any>(`/deeds/${id}`).then(setD).catch((e) => setErr(e.message));
    api<any>(`/deeds/${id}/history`).then(setHist).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!d) return <Spinner label="Loading deed…" />;

  if (editing) {
    return (
      <>
        <h1 className="mb-5 text-2xl font-bold">Edit draft – {d.title}</h1>
        <DeedForm mode="edit" deed={d} onSaved={(nd) => { setD(nd); setEditing(false); api<any>(`/deeds/${id}/history`).then(setHist).catch(() => {}); }} onCancel={() => setEditing(false)} />
      </>
    );
  }

  const snap = d.snapshot;
  const checks = d.checks;
  const canDeleteDraft = can(me.role, 'deed:delete') && d.status === 'DRAFT' && d.printCount === 0 && !(d.payments?.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/deeds" className="linkbtn inline-flex items-center gap-1 !pl-0"><ArrowLeft size={14} /> Back to Deeds</Link>
          <h1 className="mt-1 text-2xl font-bold">{d.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm muted">
            <StatusBadge status={d.status} /> {d.deedType}
            {d.deedNumber && <span>· No. {d.deedNumber}</span>}
            <span>· v{d.version}</span>
            {d.watermark && <Pill tone="amber">{d.watermark} copy</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.canEdit && <button className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit Draft</button>}
          {d.allowedTransitions.map((t: Transition) => (
            <button key={t.to} className={`btn ${t.to === 'CANCELLED' ? 'btn-danger' : t.to === 'READY' || t.to === 'REVIEW' && d.status === 'DRAFT' ? '' : 'btn-secondary'}`} onClick={() => setChange(t)}>
              {LABEL[t.to](d.status)}
            </button>
          ))}
          <a className="btn btn-secondary" href={`/deeds/${d.id}/print`} target="_blank" rel="noreferrer"><Printer size={15} /> Print</a>
          <button className="btn btn-secondary" disabled={pdf.busy} onClick={() => pdf.run(async () => {
            try { await download(`/deeds/${d.id}/pdf`, `deed-${d.id.slice(-8)}.pdf`); load(); } catch (e: any) { toast.error(e.message); }
          })}><Download size={15} /> {pdf.busy ? 'Preparing…' : 'Download PDF'}</button>
          <button className="btn btn-secondary" disabled={docx.busy} onClick={() => docx.run(async () => {
            try { await download(`/deeds/${d.id}/docx`, `deed-${d.id.slice(-8)}.docx`); load(); } catch (e: any) { toast.error(e.message); }
          })}><Download size={15} /> {docx.busy ? 'Preparing…' : 'Download Word (DOCX)'}</button>
          {canDeleteDraft && <button className="btn btn-secondary" onClick={() => setDel(true)}><Trash2 size={15} /> Delete draft</button>}
        </div>
      </div>

      {d.status === 'CANCELLED' && <Alert kind="error" title="This deed is cancelled">{d.cancelReason}</Alert>}
      {(d.status === 'DRAFT' || d.status === 'REVIEW') && <Alert kind="warn">DRAFT – not legally verified. Compare against original NID, land papers and other source documents before it is marked READY.</Alert>}

      {/* readiness */}
      {(d.status === 'DRAFT' || d.status === 'REVIEW') && (
        <div className="panel p-5">
          <h2 className="mb-2 font-semibold">Readiness checks</h2>
          <ul className="space-y-1 text-sm">
            <li>{checks.templateApproved ? '✅' : '⚠️'} Template: {checks.templateApproved ? `approved (v${checks.templateVersion})` : 'no approved template used – approve one in Settings, then regenerate the draft'}</li>
            <li>{checks.blocking.length ? '❌' : '✅'} Required data: {checks.blocking.length ? checks.blocking.join('; ') : 'complete'}</li>
            <li>{checks.unresolved.length ? '❌' : '✅'} Placeholders: {checks.unresolved.length ? `unresolved ${checks.unresolved.map((u: string) => `{{${u}}}`).join(', ')}` : 'all resolved'}</li>
            {checks.warnings.map((w: string) => <li key={w}>ℹ️ {w}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Details</h2>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="muted">Execution date</dt><dd className="font-medium">{fmtDate(d.executionDate)}</dd></div>
            <div><dt className="muted">Land value</dt><dd className="font-medium">{bdt(d.landValue)}{d.valuationBasis === 'PER_UNIT' && ` (${bdt(d.perUnitRate)} per ${d.areaUnit})`}</dd></div>
            <div><dt className="muted">Area</dt><dd className="font-medium">{Number(d.totalArea)} {d.areaUnit}{d.conversion && ` = ${d.conversion.converted} (1 ${d.areaUnit} = ${d.conversion.factor} sqft)`}</dd></div>
            <div><dt className="muted">Created by</dt><dd className="font-medium">{d.createdBy} · {fmtDateTime(d.createdAt)}</dd></div>
            <div><dt className="muted">Agreed office charge</dt><dd className="font-medium">{d.agreedFee == null ? '—' : bdt(d.agreedFee)}</dd></div>
            <div><dt className="muted">Fee estimate total</dt><dd className="font-medium">{bdt(d.calculatedFees)}</dd></div>
            <div className="sm:col-span-2"><dt className="muted">Notes</dt><dd className="font-medium">{d.notes || '—'}</dd></div>
          </dl>
        </div>
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold">Print status</h2>
          <p className="text-sm">Final copies printed: <b>{d.printCount}</b></p>
          <p className="mt-1 text-xs muted">Only READY or later output is printed as a final copy. Draft and review output carries a DRAFT watermark.</p>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="mb-1 font-semibold">Parties</h2>
        <p className="mb-3 text-xs muted">Saved copy of the details used when this deed was created ({fmtDateTime(snap.takenAt)}). Later edits to a customer profile do not change it.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {snap.parties.map((p: any) => (
            <div className="rounded-lg border border-slate-200 p-3 text-sm" key={`${p.customerId}-${p.role}`}>
              <div className="font-semibold">{ROLE_LABEL[p.role] || p.role}: {can(me.role, 'customer:read') ? <Link className="text-emerald-700 hover:underline" href={`/customers/${p.customerId}`}>{p.name}</Link> : p.name}</div>
              <div className="muted">Father: {p.fatherName || '—'} · Mother: {p.motherName || '—'}</div>
              <div className="muted">NID: {p.nid || '—'} · Phone: {p.phone || '—'}</div>
              <div className="muted">{p.address || 'No address'}</div>
            </div>
          ))}
          {!snap.parties.length && <p className="text-sm muted">No parties linked.</p>}
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="mb-3 font-semibold">Land references</h2>
        <div className="space-y-2">
          {snap.lands.map((l: any) => (
            <div key={l.landId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <Link className="font-semibold text-emerald-700 hover:underline" href={`/lands/${l.landId}`}>{l.mouza}, {l.upazila}, {l.district}</Link>
              <div className="muted">JL {l.jlNumber || '—'} · Khatian {l.khatianNumber || '—'}{l.khatianType ? ` (${l.khatianType})` : ''} · Dag {l.dagNumber} · Area {Number(l.area)} {l.areaUnit}{l.share ? ` · Share ${l.share}` : ''}</div>
              <div className="text-xs muted">N: {l.boundaryNorth || '—'} · S: {l.boundarySouth || '—'} · E: {l.boundaryEast || '—'} · W: {l.boundaryWest || '—'}</div>
            </div>
          ))}
          {!snap.lands.length && <p className="text-sm muted">No land records linked.</p>}
        </div>
      </div>

      {d.feeLines?.length > 0 && (
        <div className="panel overflow-x-auto p-5">
          <h2 className="mb-3 font-semibold">Fee calculation</h2>
          <table className="table">
            <thead><tr><th>Line</th><th>Basis</th><th>Effective / source</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {d.feeLines.map((l: any) => (
                <tr key={l.key}>
                  <td>{l.label} {l.estimateLabel && <Pill tone="amber">{l.estimateLabel}</Pill>}{l.override && <div className="text-xs muted">Overridden by {l.override.by}: {l.override.reason}</div>}</td>
                  <td className="text-xs">{l.basisText}</td><td className="text-xs">{l.effectiveFrom} · {l.source}</td>
                  <td className="text-right font-medium">{bdt(l.finalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">দলিল প্রিভিউ <span className="text-xs font-medium text-slate-400">Document preview – Bangladesh deed format</span></h2>
          <span className="text-xs muted">Same layout as the printed PDF / Word file</span>
        </div>
        <DocumentFrame deedId={d.id} refreshKey={`${d.version}-${d.status}`} />
        <p className="mt-3 border-t pt-3 text-xs muted">Draft generated by Dolil OS. This is not a legally validated instrument. Verify all facts, applicable law and approved wording before execution or registration.</p>
      </div>

      {d.payments && (
        <div className="panel overflow-x-auto p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Payments</h2>
            <div className="text-sm">Received <b>{bdt(d.received)}</b>{d.due != null && <> · Due <b>{bdt(d.due)}</b></>}</div>
            {can(me.role, 'payment:write') && d.status !== 'CANCELLED' && <Link className="btn btn-secondary btn-sm" href={`/payments?deedId=${d.id}`}>Record payment</Link>}
          </div>
          <table className="table">
            <thead><tr><th>Receipt</th><th>Amount</th><th>Method</th><th>Date</th><th>Received by</th></tr></thead>
            <tbody>
              {d.payments.map((p: any) => (
                <tr key={p.id}>
                  <td><Link className="text-emerald-700 hover:underline" href={`/payments/${p.id}`}>{p.receiptNo}</Link> {p.type === 'REVERSAL' && <Pill tone="red">Reversal</Pill>}</td>
                  <td>{p.type === 'REVERSAL' ? '−' : ''}{bdt(p.amount)}</td><td>{p.method}</td><td>{fmtDateTime(p.paidAt)}</td><td>{p.receivedBy.name}</td>
                </tr>
              ))}
              {!d.payments.length && <tr><td colSpan={5} className="py-6 text-center muted">No payments recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <DocumentsPanel ownerType="DEED" ownerId={d.id} />

      {hist && (
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold">History &amp; audit trail</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Events</h3>
              <ul className="space-y-2 text-sm">
                {hist.events.map((e: any) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.action.replaceAll('_', ' ').toLowerCase()}</span>
                    {e.meta?.from && <> ({e.meta.from} → {e.meta.to})</>}
                    <div className="text-xs muted">{e.by || 'system'} · {fmtDateTime(e.createdAt)}{e.reason ? ` · “${e.reason}”` : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Revisions</h3>
              <ul className="space-y-2 text-sm">
                {hist.revisions.map((r: any) => (
                  <li key={r.id}>v{r.version} – {r.title}<div className="text-xs muted">{r.editedBy} · {fmtDateTime(r.createdAt)}{r.reason ? ` · ${r.reason}` : ''}</div></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {change && <StatusModal deed={d} transition={change} onClose={() => setChange(null)} onDone={() => { setChange(null); load(); }} />}
      {del && (
        <ConfirmModal title="Delete this draft?" danger confirmLabel="Delete draft" busy={rm.busy}
          message="This permanently removes an untouched draft with no payments or prints. Any other deed must be cancelled instead."
          onClose={() => setDel(false)}
          onConfirm={() => rm.run(async () => {
            try { await api(`/deeds/${d.id}`, { method: 'DELETE' }); toast.success('Draft deleted'); router.push('/deeds'); } catch (e: any) { toast.error(e.message); setDel(false); }
          })} />
      )}
    </div>
  );
}

export default function DeedDetail() {
  return <AppShell><Detail /></AppShell>;
}
