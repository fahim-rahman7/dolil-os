"use client";
import AppShell from '@/components/AppShell';
import DocumentsPanel from '@/components/DocumentsPanel';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { Alert, ErrorState, Pill, Spinner, StatusBadge } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

function Detail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [l, setL] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api(`/lands/${id}`).then(setL).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!l) return <Spinner />;
  const rows: [string, React.ReactNode][] = [
    ['District', l.district], ['Upazila / Thana', l.upazila], ['Mouza', l.mouza], ['JL number', l.jlNumber || '—'], ['ইউনিয়ন (Union)', l.union || '—'], ['ভূমি অফিস (Land office)', l.landOffice || '—'], ['হোল্ডিং নং (Holding)', l.holdingNo || '—'],
    ['Khatian', `${l.khatianNumber || '—'}${l.khatianType ? ` (${l.khatianType})` : ''}`], ['Dag number', l.dagNumber],
    ['Area', `${Number(l.area)} ${l.areaUnit}`],
    ['Converted', l.conversion ? `${l.conversion.converted.value} ${l.conversion.converted.unit} (${l.conversion.note})` : '—'],
    ['Classification', l.classification || '—'], ['Ownership details', l.ownershipDetails || '—'],
    ['North', l.boundaryNorth || '—'], ['South', l.boundarySouth || '—'], ['East', l.boundaryEast || '—'], ['West', l.boundaryWest || '—'],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/lands" className="linkbtn inline-flex items-center gap-1 !pl-0"><ArrowLeft size={14} /> Back to land records</Link>
          <h1 className="mt-1 text-2xl font-bold">{l.mouza}, {l.upazila} – Dag {l.dagNumber} {!l.active && <Pill>Inactive</Pill>}</h1>
        </div>
        {can(me.role, 'land:write') && <Link className="btn btn-secondary" href={`/lands?edit=${l.id}`}>Edit</Link>}
      </div>
      <Alert kind="info">{l.notice}</Alert>
      <div className="panel p-5">
        <h2 className="mb-3 font-semibold">Recorded land description</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (<div key={k}><dt className="muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
        </dl>
      </div>
      <div className="panel overflow-hidden">
        <h2 className="p-5 pb-3 font-semibold">Linked deeds</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Deed</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {l.deeds.map((d: any) => (
                <tr key={d.id}>
                  <td>{can(me.role, 'deed:read') ? <Link className="text-emerald-700 hover:underline" href={`/deeds/${d.id}`}>{d.title}</Link> : d.title}</td>
                  <td>{d.deedType}</td><td><StatusBadge status={d.status} /></td><td>{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
              {!l.deeds.length && <tr><td colSpan={4} className="py-8 text-center muted">No deed references this land record yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <DocumentsPanel ownerType="LAND" ownerId={l.id} />
    </div>
  );
}

export default function LandDetail() {
  return <AppShell><Detail /></AppShell>;
}
