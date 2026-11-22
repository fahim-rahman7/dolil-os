"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Users, MapPinned, Wallet, BarChart3, Plus, LogOut, Menu, Settings as Cog, X, ChevronRight, ArrowLeft } from 'lucide-react';
import { api, clearSession } from '@/lib/api';
import { RequireAuth, useMe } from '@/lib/session';
import { can, type Perm } from '@/lib/perms';

const NAV: { href: string; label: string; bn: string; Icon: any; perm?: Perm }[] = [
  { href: '/', label: 'Dashboard', bn: 'ড্যাশবোর্ড', Icon: LayoutDashboard },
  { href: '/deeds', label: 'Deeds', bn: 'দলিলসমূহ', Icon: FileText, perm: 'deed:read' },
  { href: '/new-deed', label: 'Create Deed', bn: 'নতুন দলিল', Icon: Plus, perm: 'deed:write' },
  { href: '/customers', label: 'Customers', bn: 'গ্রাহক', Icon: Users, perm: 'customer:read' },
  { href: '/lands', label: 'Land Records', bn: 'জমির তথ্য', Icon: MapPinned, perm: 'land:read' },
  { href: '/payments', label: 'Payments', bn: 'পেমেন্ট', Icon: Wallet, perm: 'payment:read' },
  { href: '/reports', label: 'Reports', bn: 'রিপোর্ট', Icon: BarChart3 },
  { href: '/settings', label: 'Settings', bn: 'সেটিংস', Icon: Cog },
];

const ROLE_BN: Record<string, string> = { OWNER: 'মালিক', ADMIN: 'অ্যাডমিন', WRITER: 'দলিল লেখক', ASSISTANT: 'সহকারী', ACCOUNTANT: 'হিসাবরক্ষক' };

function Logo() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-900/40">দ</div>
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-tight text-white">দলিল OS</div>
        <div className="text-[11px] text-slate-400">Deed Office Management</div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  async function signOut() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* the client session is always cleared */
    }
    clearSession();
    router.replace('/login');
  }
  // Back: previous page in the browser history; if this tab has no history (opened directly) go to the dashboard.
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  const current = NAV.find((n) => active(n.href));

  return (
    <div className="min-h-screen md:flex">
      <aside className={`sidebar ${open ? 'flex' : 'hidden'} md:flex md:sticky md:top-0 md:h-screen w-full shrink-0 flex-col gap-5 p-4 md:w-64 print:hidden`} aria-label="Sidebar">
        <Logo />
        <div className="user-card flex items-center gap-3 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300">{me.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{me.name}</div>
            <div className="truncate text-xs text-slate-400">{ROLE_BN[me.role] || me.role} · {me.office.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {NAV.filter((n) => !n.perm || can(me.role, n.perm)).map(({ href, label, bn, Icon }) => (
            <Link key={href} href={href} className={`navlink ${active(href) ? 'active' : ''}`} aria-current={active(href) ? 'page' : undefined}>
              <Icon size={18} />
              <span className="flex-1">
                {bn} <span className="text-[11px] opacity-60">{label}</span>
              </span>
            </Link>
          ))}
        </nav>
        <button className="navlink w-full" onClick={signOut}>
          <LogOut size={18} /> সাইন আউট <span className="text-[11px] opacity-60">Sign out</span>
        </button>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur md:px-7 print:hidden">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            {path !== '/' && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                aria-label="Go back to the previous page"
                title="আগের পেজে ফিরে যান (Back)"
              >
                <ArrowLeft size={16} />
                <span>পেছনে</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <span>দলিল OS</span>
              {current && (
                <>
                  <ChevronRight size={14} />
                  <span className="font-semibold text-slate-800">{current.bn}</span>
                </>
              )}
            </div>
          </div>
          <button className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" onClick={signOut}>
            Sign out
          </button>
        </header>
        <div className="page-enter mx-auto max-w-[1400px] p-4 md:p-7" key={path}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
