"use client";
import AppShell from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, bdt, fmtDate } from '@/lib/api';
import { FileText, Users, Wallet, Clock, Plus, ArrowRight, MapPinned } from 'lucide-react';
import { ErrorState, StatusBadge } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

const TINT: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
};

function Dashboard() {
  const me = useMe();
  const [s, setS] = useState<any>(null);
  const [recent, setRecent] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api('/reports/summary')
      .then(setS)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    if (can(me.role, 'deed:read')) api<any[]>('/deeds?limit=5').then(setRecent).catch(() => setRecent([]));
  }, [me.role]);
  useEffect(load, [load]);

  const cards = [
    { label: 'মোট দলিল', en: 'Total deeds', value: s?.deeds, Icon: FileText, tint: 'emerald' },
    { label: 'গ্রাহক', en: 'Customers', value: s?.customers, Icon: Users, tint: 'sky' },
    ...(s?.totalPayments !== undefined ? [{ label: 'মোট প্রাপ্ত', en: 'Total received', value: bdt(s.totalPayments), Icon: Wallet, tint: 'violet' }] : []),
    { label: 'অপেক্ষমাণ দলিল', en: 'Pending deeds', value: s?.pending, Icon: Clock, tint: 'amber' },
  ];

  const quick = [
    can(me.role, 'deed:write') && { href: '/new-deed', label: 'নতুন দলিল', en: 'Create a deed', Icon: Plus, primary: true },
    can(me.role, 'customer:write') && { href: '/customers?new=1', label: 'গ্রাহক যোগ', en: 'Add customer', Icon: Users },
    can(me.role, 'land:write') && { href: '/lands?new=1', label: 'জমির তথ্য যোগ', en: 'Add land record', Icon: MapPinned },
    can(me.role, 'payment:write') && { href: '/payments', label: 'পেমেন্ট রেকর্ড', en: 'Record payment', Icon: Wallet },
  ].filter(Boolean) as any[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ড্যাশবোর্ড <span className="text-base font-medium text-slate-400">Dashboard</span></h1>
          <p className="muted mt-1 text-sm">স্বাগতম, {me.name} — your office activity at a glance.</p>
        </div>
        {can(me.role, 'deed:write') && (
          <Link className="btn" href="/new-deed">
            <Plus size={17} /> নতুন দলিল
          </Link>
        )}
      </div>

      {err ? (
        <ErrorState message={`Could not load the dashboard. ${err}`} onRetry={load} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[104px]" />)
            : cards.map(({ label, en, value, Icon, tint }) => (
                <div className="stat" key={en}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-600">{label}</div>
                      <div className="text-xs text-slate-400">{en}</div>
                    </div>
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${TINT[tint]}`}>
                      <Icon size={20} />
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-bold tracking-tight">{value ?? '—'}</div>
                </div>
              ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {can(me.role, 'deed:read') && (
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="font-bold">সাম্প্রতিক দলিল <span className="text-xs font-medium text-slate-400">Recent deeds</span></h2>
              <Link href="/deeds" className="linkbtn inline-flex items-center gap-1">সব দেখুন <ArrowRight size={14} /></Link>
            </div>
            {recent === null ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
            ) : recent.length === 0 ? (
              <p className="p-8 text-center text-sm muted">No deeds yet. Create your first deed to see it here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deeds/${d.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><FileText size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{d.title}</div>
                        <div className="truncate text-xs muted">{d.deedType} · {d.partyNames.slice(0, 2).join(' → ') || 'No parties'} · {fmtDate(d.createdAt)}</div>
                      </div>
                      <StatusBadge status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="space-y-5">
          {quick.length > 0 && (
            <div className="panel p-5">
              <h2 className="mb-4 font-bold">দ্রুত কাজ <span className="text-xs font-medium text-slate-400">Quick actions</span></h2>
              <div className="grid gap-2.5">
                {quick.map(({ href, label, en, Icon, primary }) => (
                  <Link key={href} href={href} className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition ${primary ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'}`}>
                    <Icon size={18} className={primary ? '' : 'text-emerald-600'} />
                    <span className="flex-1 font-semibold">{label} <span className={`text-xs font-normal ${primary ? 'text-emerald-100' : 'text-slate-400'}`}>{en}</span></span>
                    <ArrowRight size={16} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="panel p-5">
            <h2 className="mb-3 font-bold">শুরু করার ধাপ <span className="text-xs font-medium text-slate-400">Getting started</span></h2>
            <ol className="space-y-2.5 text-sm text-slate-600">
              {['Create buyer and seller customer profiles.', 'Add the relevant land record.', 'Create a deed and select its deed type.', 'Review the draft against source documents before printing.', 'Record payments and export reports.'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="section-num !h-6 !w-6 shrink-0 !text-xs">{i + 1}</span>{t}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
