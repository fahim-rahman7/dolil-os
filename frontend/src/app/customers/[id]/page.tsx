"use client";
import AppShell from '@/components/AppShell';
import DocumentsPanel from '@/components/DocumentsPanel';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { ErrorState, Pill, Spinner, StatusBadge } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/perms';

function Detail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api(`/customers/${id}`).then(setC).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!c) return <Spinner />;
  const rows: [string, React.ReactNode][] = [
    ['Phone', c.phone || '—'],
    ['Email', c.email || '—'],
    ['NID', c.nid ? <span className="font-mono">{c.nid}</span> : <Pill tone="amber">Missing – verify identity manually</Pill>],
    ['Father name', c.fatherName || '—'],
    ['Mother name', c.motherName || '—'],
    ['স্বামীর নাম (Husband)', c.husbandName || '—'],
    ['জন্ম তারিখ (Date of birth)', c.birthDate ? fmtDate(c.birthDate) : '—'],
    ['ধর্ম (Religion)', c.religion || '—'],
    ['পেশা (Profession)', c.profession || '—'],
    ['জাতীয়তা (Nationality)', c.nationality || 'বাংলাদেশী'],
    ['স্থায়ী ঠিকানা (Permanent address)', c.permanentAddress || '—'],
    ['বর্তমান ঠিকানা (Present address)', c.address || '—'],
    ['Notes', c.notes || '—'],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/customers" className="linkbtn inline-flex items-center gap-1 !pl-0"><ArrowLeft size={14} /> Back to customers</Link>
          <h1 className="mt-1 text-2xl font-bold">
            {c.name} {!c.active && <Pill>Inactive</Pill>}
          </h1>
        </div>
        {can(me.role, 'customer:write') && <Link className="btn btn-secondary" href={`/customers?edit=${c.id}`}>Edit</Link>}
      </div>
      <div className="panel p-5">
        <h2 className="mb-3 font-semibold">Profile</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}><dt className="muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>
      <div className="panel overflow-hidden">
        <h2 className="p-5 pb-3 font-semibold">Deed history</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Deed</th><th>Type</th><th>Role</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {c.deeds.map((d: any) => (
                <tr key={`${d.id}-${d.role}`}>
                  <td>{can(me.role, 'deed:read') ? <Link className="text-emerald-700 hover:underline" href={`/deeds/${d.id}`}>{d.title}</Link> : d.title}</td>
                  <td>{d.deedType}</td><td>{ROLE_LABEL[d.role] || d.role}</td><td><StatusBadge status={d.status} /></td><td>{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
              {!c.deeds.length && <tr><td colSpan={5} className="py-8 text-center muted">This customer is not linked to any deed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {me.role !== 'ACCOUNTANT' && <DocumentsPanel ownerType="CUSTOMER" ownerId={c.id} />}
    </div>
  );
}

export default function CustomerDetail() {
  return <AppShell><Detail /></AppShell>;
}
