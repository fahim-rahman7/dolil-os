"use client";
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, fmtDate } from '@/lib/api';
import { Alert, Field, Modal, Pill, Spinner, focusFirstError, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';

const ROLES = ['OWNER', 'ADMIN', 'WRITER', 'ASSISTANT', 'ACCOUNTANT'];
const strong = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

export default function UsersSettings() {
  const me = useMe();
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'reset'; user: any }>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WRITER' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const save = useSubmit();
  const act = useSubmit();

  const load = useCallback(() => { api<any[]>('/users').then(setRows).catch((e) => setErr(e.message)); }, []);
  useEffect(load, [load]);
  const roles = me.role === 'OWNER' ? ROLES : ROLES.filter((r) => r !== 'OWNER');

  async function patch(id: string, body: object, okMsg: string) {
    await act.run(async () => {
      try { await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); toast.success(okMsg); load(); } catch (e: any) { toast.error(e.message); load(); }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    const errs: Record<string, string> = {};
    const reset = modal?.mode === 'reset';
    if (!reset && form.name.trim().length < 2) errs.name = 'Name is required';
    if (!reset && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (!strong(form.password)) errs.password = 'At least 8 characters with upper-case, lower-case and a number';
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await save.run(async () => {
      try {
        if (reset) await api(`/users/${(modal as any).user.id}`, { method: 'PATCH', body: JSON.stringify({ password: form.password }) });
        else await api('/users', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim() }) });
        toast.success(reset ? 'Password reset' : 'User created');
        setModal(null);
        load();
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) { setErrors(err.errors); focusFirstError(); }
        setFormErr(err.message);
      }
    });
  }

  if (err) return <Alert kind="error">{err}</Alert>;
  if (!rows) return <Spinner />;
  return (
    <div className="panel overflow-x-auto p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Users &amp; roles</h2>
        <button className="btn btn-sm" onClick={() => { setForm({ name: '', email: '', password: '', role: 'WRITER' }); setErrors({}); setFormErr(''); setModal({ mode: 'create' }); }}>Add user</button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.name}{u.id === me.id && <span className="muted"> (you)</span>}</td>
              <td>{u.email}</td>
              <td>
                <select className="field !w-auto !py-1" value={u.role} disabled={u.id === me.id || act.busy || (me.role !== 'OWNER' && u.role === 'OWNER')} onChange={(e) => patch(u.id, { role: e.target.value }, 'Role updated')} aria-label={`Role for ${u.name}`}>
                  {ROLES.map((r) => <option key={r} disabled={!roles.includes(r)}>{r}</option>)}
                </select>
              </td>
              <td>{u.active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}</td>
              <td>{fmtDate(u.createdAt)}</td>
              <td className="whitespace-nowrap">
                <button className="linkbtn" disabled={me.role !== 'OWNER' && u.role === 'OWNER'} onClick={() => { setForm({ name: '', email: '', password: '', role: u.role }); setErrors({}); setFormErr(''); setModal({ mode: 'reset', user: u }); }}>Reset password</button>
                {u.id !== me.id && <button className="linkbtn" disabled={act.busy || (me.role !== 'OWNER' && u.role === 'OWNER')} onClick={() => patch(u.id, { active: !u.active }, u.active ? 'User deactivated' : 'User reactivated')}>{u.active ? 'Deactivate' : 'Reactivate'}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add user' : `Reset password – ${modal.user.name}`} onClose={() => setModal(null)}>
          <form onSubmit={submit} noValidate className="space-y-4">
            {modal.mode === 'create' && (
              <>
                <Field label="Name" required error={errors.name}><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Email" required error={errors.email}><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Role" required><select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
              </>
            )}
            <Field label={modal.mode === 'create' ? 'Initial password' : 'New password'} required error={errors.password} hint="At least 8 characters with upper-case, lower-case and a number.">
              <input className="field" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            {formErr && <Alert kind="error">{formErr}</Alert>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={save.busy}>Cancel</button>
              <button className="btn" disabled={save.busy}>{save.busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
