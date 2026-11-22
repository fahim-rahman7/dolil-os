"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, FileText, ShieldCheck, Zap } from 'lucide-react';
import { api, getToken, setSession } from '@/lib/api';
import { Field, focusFirstError, useSubmit } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const { busy, run } = useSubmit();

  useEffect(() => {
    if (getToken()) router.replace('/');
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await run(async () => {
      try {
        const data = await api<{ token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
        setSession(data.token, data.user);
        router.replace('/');
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="sidebar relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold text-white shadow-lg shadow-emerald-900/40">দ</div>
          <div className="text-xl font-bold text-white">দলিল OS</div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight text-white">
            দলিল লেখা, <span className="text-emerald-400">আরও সহজ</span> ও নির্ভুল
          </h2>
          <p className="max-w-md text-slate-300">Draft, review, print and track deeds, customers, land records and payments in one organised workspace.</p>
          <ul className="space-y-3 text-sm text-slate-300">
            {[[FileText, 'Template-driven drafts with Bangla amounts in words'], [ShieldCheck, 'Role-based access, audit trail and masked NIDs'], [Zap, 'Fast search, live calculation and one-click print']].map(([Icon, text]: any) => (
              <li key={text} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Icon size={16} className="text-emerald-300" /></span>{text}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">A drafting aid – not legal advice or an official land-record system.</p>
      </section>

      <section className="grid place-items-center p-4">
        <form onSubmit={submit} noValidate className="panel page-enter w-full max-w-md p-8">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold text-white shadow-lg shadow-emerald-600/30 lg:hidden">দ</div>
          <h1 className="text-2xl font-bold">স্বাগতম <span className="text-base font-medium text-slate-400">Welcome</span></h1>
          <p className="muted mb-6 mt-1 text-sm">Sign in to your deed writing workspace.</p>
          <div className="space-y-4">
            <Field label="Email" error={errors.email}>
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input className="field !pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 transition hover:bg-slate-100" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
          </div>
          <button className="btn mt-6 w-full !py-3" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <p className="mt-5 text-xs muted">Use the account created for you by your office owner. Seed credentials are in the project README; change them before production.</p>
        </form>
      </section>
    </main>
  );
}
