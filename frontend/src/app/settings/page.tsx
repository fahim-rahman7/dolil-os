"use client";
import AppShell from '@/components/AppShell';
import CalcSettings from '@/components/settings/CalcSettings';
import TemplatesSettings from '@/components/settings/TemplatesSettings';
import UsersSettings from '@/components/settings/UsersSettings';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, clearSession } from '@/lib/api';
import { Alert, Field, Spinner, focusFirstError, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';

const strong = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

function Account() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const { busy, run } = useSubmit();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    const errs: Record<string, string> = {};
    if (!f.currentPassword) errs.currentPassword = 'Current password is required';
    if (!strong(f.newPassword)) errs.newPassword = 'At least 8 characters with upper-case, lower-case and a number';
    if (f.newPassword !== f.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await run(async () => {
      try {
        await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: f.currentPassword, newPassword: f.newPassword }) });
        toast.success('Password updated');
        setF({ currentPassword: '', newPassword: '', confirm: '' });
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) { setErrors(err.errors); focusFirstError(); }
        setFormErr(err.message);
      }
    });
  }
  async function signOut() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearSession();
    router.replace('/login');
  }
  return (
    <div className="max-w-xl space-y-5">
      <form onSubmit={submit} noValidate className="panel space-y-4 p-5">
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password" required error={errors.currentPassword}><input className="field" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
        <Field label="New password" required error={errors.newPassword} hint="At least 8 characters with upper-case, lower-case and a number."><input className="field" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
        <Field label="Confirm new password" required error={errors.confirm}><input className="field" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        {formErr && <Alert kind="error">{formErr}</Alert>}
        <button className="btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
      <div className="panel flex items-center justify-between p-5">
        <div><h2 className="font-semibold">Sign out</h2><p className="text-sm muted">Clears your session on this device.</p></div>
        <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

function Office({ settings, canWrite, reload }: { settings: any; canWrite: boolean; reload: () => void }) {
  const toast = useToast();
  const [p, setP] = useState({ name: settings.name ?? '', phone: settings.phone ?? '', email: settings.email ?? '', address: settings.address ?? '' });
  const [pr, setPr] = useState({ printPageSize: settings.printPageSize, printMarginMm: String(settings.printMarginMm), printFont: settings.printFont, printHeader: settings.printHeader ?? '', printFooter: settings.printFooter ?? '' });
  const [pol, setPol] = useState({ autoNumbering: settings.autoNumbering, numberPrefix: settings.numberPrefix, allowGenericDraft: settings.allowGenericDraft, adminCanManageSettings: settings.adminCanManageSettings, adminCanManageUsers: settings.adminCanManageUsers });
  const me = useMe();
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const s1 = useSubmit(), s2 = useSubmit(), s3 = useSubmit();

  async function send(section: string, path: string, body: object, runner: ReturnType<typeof useSubmit>, ok: string) {
    setErrors((e) => ({ ...e, [section]: {} }));
    await runner.run(async () => {
      try { await api(path, { method: 'PUT', body: JSON.stringify(body) }); toast.success(ok); reload(); }
      catch (err: any) { setErrors((e) => ({ ...e, [section]: { ...(err instanceof ApiError && err.errors ? err.errors : {}), _: err.message } })); focusFirstError(); }
    });
  }
  const E = (s: string) => errors[s] || {};
  const dis = !canWrite;

  return (
    <div className="max-w-3xl space-y-5">
      {!canWrite && <Alert kind="info">You can view these settings. Only the owner (or an administrator the owner has authorised) can change them.</Alert>}
      <form noValidate className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (p.name.trim().length < 2) return setErrors((x) => ({ ...x, profile: { name: 'Office name is required' } })); send('profile', '/settings/profile', p, s1, 'Office profile saved'); }}>
        <h2 className="font-semibold">Office profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Office name" required error={E('profile').name} className="sm:col-span-2"><input className="field" disabled={dis} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label="Phone" error={E('profile').phone}><input className="field" disabled={dis} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
          <Field label="Email" error={E('profile').email}><input className="field" disabled={dis} value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
          <Field label="Address" className="sm:col-span-2" error={E('profile').address}><textarea className="field" disabled={dis} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></Field>
        </div>
        {E('profile')._ && <Alert kind="error">{E('profile')._}</Alert>}
        {canWrite && <button className="btn" disabled={s1.busy}>{s1.busy ? 'Saving…' : 'Save office profile'}</button>}
      </form>

      <form noValidate className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); send('print', '/settings/print', { ...pr, printMarginMm: Number(pr.printMarginMm) }, s2, 'Print preferences saved'); }}>
        <h2 className="font-semibold">Print preferences</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Page size"><select className="field" disabled={dis} value={pr.printPageSize} onChange={(e) => setPr({ ...pr, printPageSize: e.target.value })}>{['A4', 'A5', 'Letter', 'Legal'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Margin (mm)" error={E('print').printMarginMm}><input className="field" type="number" min="5" max="50" disabled={dis} value={pr.printMarginMm} onChange={(e) => setPr({ ...pr, printMarginMm: e.target.value })} /></Field>
          <Field label="Font" hint="Bangla-capable font installed on the print device."><select className="field" disabled={dis} value={pr.printFont} onChange={(e) => setPr({ ...pr, printFont: e.target.value })}>{['Noto Sans Bengali', 'Nirmala UI', 'Kalpurush', 'SolaimanLipi', 'Arial'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Header text" className="sm:col-span-3"><input className="field" disabled={dis} value={pr.printHeader} onChange={(e) => setPr({ ...pr, printHeader: e.target.value })} /></Field>
          <Field label="Footer text" className="sm:col-span-3"><input className="field" disabled={dis} value={pr.printFooter} onChange={(e) => setPr({ ...pr, printFooter: e.target.value })} /></Field>
        </div>
        {E('print')._ && <Alert kind="error">{E('print')._}</Alert>}
        {canWrite && <button className="btn" disabled={s2.busy}>{s2.busy ? 'Saving…' : 'Save print preferences'}</button>}
      </form>

      <form noValidate className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const body: any = { autoNumbering: pol.autoNumbering, numberPrefix: pol.numberPrefix, allowGenericDraft: pol.allowGenericDraft }; if (me.role === 'OWNER') { body.adminCanManageSettings = pol.adminCanManageSettings; body.adminCanManageUsers = pol.adminCanManageUsers; } send('policy', '/settings/policy', body, s3, 'Office policy saved'); }}>
        <h2 className="font-semibold">Office policy</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={dis} checked={pol.autoNumbering} onChange={(e) => setPol({ ...pol, autoNumbering: e.target.checked })} /> Assign an internal deed number automatically (this is not an official registration number)</label>
        <Field label="Number prefix" error={E('policy').numberPrefix}><input className="field max-w-xs" disabled={dis || !pol.autoNumbering} value={pol.numberPrefix} onChange={(e) => setPol({ ...pol, numberPrefix: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={dis} checked={pol.allowGenericDraft} onChange={(e) => setPol({ ...pol, allowGenericDraft: e.target.checked })} /> Allow a clearly labelled generic draft when a deed type has no approved template</label>
        {me.role === 'OWNER' && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-sm font-semibold">Administrator permissions (owner only)</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pol.adminCanManageSettings} onChange={(e) => setPol({ ...pol, adminCanManageSettings: e.target.checked })} /> Administrators may change office settings, rates and templates</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pol.adminCanManageUsers} onChange={(e) => setPol({ ...pol, adminCanManageUsers: e.target.checked })} /> Administrators may manage users</label>
          </div>
        )}
        {E('policy')._ && <Alert kind="error">{E('policy')._}</Alert>}
        {canWrite && <button className="btn" disabled={s3.busy}>{s3.busy ? 'Saving…' : 'Save office policy'}</button>}
      </form>
    </div>
  );
}

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'office', label: 'Office & print', staff: true },
  { id: 'calc', label: 'Calculation', staff: true },
  { id: 'templates', label: 'Templates', staff: true },
  { id: 'users', label: 'Users', users: true },
];

function Settings() {
  const me = useMe();
  const [tab, setTab] = useState('account');
  const [settings, setSettings] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    if (!me.permissions.settingsRead) return;
    api<any>('/settings').then(setSettings).catch((e) => setErr(e.message));
  }, [me.permissions.settingsRead]);
  useEffect(load, [load]);

  const tabs = TABS.filter((t) => (!t.staff || me.permissions.settingsRead) && (!t.users || me.permissions.userManage));
  const canWrite = me.permissions.settingsWrite;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="muted text-sm">Office configuration and your account.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
        ))}
      </div>
      {err && <Alert kind="error">{err}</Alert>}
      {tab === 'account' && <Account />}
      {tab === 'office' && (settings ? <Office key={JSON.stringify([settings.updatedAt])} settings={settings} canWrite={canWrite} reload={load} /> : <Spinner />)}
      {tab === 'calc' && <CalcSettings canWrite={canWrite} />}
      {tab === 'templates' && <TemplatesSettings canWrite={canWrite} />}
      {tab === 'users' && <UsersSettings />}
      <Alert kind="info">Fee calculations are configurable estimates, not official government fee advice. Confirm current rates, registration rules and deed wording with a qualified professional.</Alert>
    </div>
  );
}

export default function Page() {
  return <AppShell><Settings /></AppShell>;
}
