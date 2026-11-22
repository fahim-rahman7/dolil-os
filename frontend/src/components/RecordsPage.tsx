"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { ApiError, apiPage, api, qs, type Page } from '@/lib/api';
import { ConfirmModal, EmptyRow, ErrorState, Field, Modal, Pagination, Pill, Spinner, focusFirstError, useDebounced, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';
import FieldInput from '@/components/FieldInput';
import { can, type Perm } from '@/lib/perms';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'email' | 'date' | 'district' | 'upazila';
  required?: boolean;
  options?: string[];
  span?: 1 | 2 | 3;
  hint?: string;
  validate?: (v: string) => string | undefined;
}
export interface ColumnDef {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface Props {
  title: string;
  singular: string; // e.g. "Customer"
  endpoint: string; // e.g. /customers
  permBase: 'customer' | 'land';
  fields: FieldDef[];
  columns: ColumnDef[];
  searchPlaceholder: string;
  emptyForm?: Record<string, string>;
}

const toForm = (row: any, fields: FieldDef[]) =>
  Object.fromEntries(fields.map((f) => [f.name, row?.[f.name] == null ? '' : f.type === 'date' ? String(row[f.name]).slice(0, 10) : String(row[f.name])]));

export default function RecordsPage({ title, singular, endpoint, permBase, fields, columns, searchPlaceholder, emptyForm }: Props) {
  const me = useMe();
  const toast = useToast();
  const canWrite = can(me.role, `${permBase}:write` as Perm);
  const canDelete = can(me.role, `${permBase}:delete` as Perm);

  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [result, setResult] = useState<Page<any[]> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; id?: string }>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'deactivate' | 'reactivate'; row: any }>(null);
  const save = useSubmit();
  const act = useSubmit();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiPage<any[]>(`${endpoint}${qs({ q: dq, page, limit: 20, active: showInactive ? 'all' : 'true' })}`)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint, dq, page, showInactive]);
  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, showInactive]);

  const openCreate = useCallback(() => {
    setForm({ ...toForm({}, fields), ...(emptyForm || {}) });
    setErrors({});
    setFormError('');
    setDirty(false);
    setModal({ mode: 'create' });
  }, [fields, emptyForm]);

  const openEdit = useCallback(
    async (id: string) => {
      try {
        const row = await api(`${endpoint}/${id}`);
        setForm(toForm(row, fields));
        setErrors({});
        setFormError('');
        setDirty(false);
        setModal({ mode: 'edit', id });
      } catch (e: any) {
        toast.error(e.message);
      }
    },
    [endpoint, fields, toast],
  );

  // ?new=1 / ?edit=<id> deep links (dashboard quick actions, detail pages)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('new') === '1' && canWrite) openCreate();
    const id = p.get('edit');
    if (id && canWrite) openEdit(id);
    if (p.has('new') || p.has('edit')) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (form[f.name] ?? '').trim();
      if (f.required && !v) errs[f.name] = `${f.label} is required`;
      else if (v && f.validate) {
        const m = f.validate(v);
        if (m) errs[f.name] = m;
      }
    }
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await save.run(async () => {
      try {
        const body = JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])));
        if (modal?.mode === 'edit') await api(`${endpoint}/${modal.id}`, { method: 'PUT', body });
        else await api(endpoint, { method: 'POST', body });
        toast.success(`${singular} saved`);
        setModal(null);
        load();
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) {
          setErrors(err.errors);
          focusFirstError();
        }
        setFormError(err.message);
      }
    });
  }

  // Cancel / X / Esc simply discard whatever was typed – no confirmation popup.
  function closeModal() {
    setDirty(false);
    setModal(null);
  }

  async function runAction(reason?: string) {
    if (!confirm) return;
    await act.run(async () => {
      try {
        const { kind, row } = confirm;
        if (kind === 'delete') await api(`${endpoint}/${row.id}`, { method: 'DELETE' });
        else await api(`${endpoint}/${row.id}/active`, { method: 'PATCH', body: JSON.stringify({ active: kind === 'reactivate' }) });
        toast.success(kind === 'delete' ? `${singular} deleted` : kind === 'deactivate' ? `${singular} deactivated` : `${singular} reactivated`);
        setConfirm(null);
        load();
      } catch (err: any) {
        setConfirm(null);
        toast.error(err.message);
      }
    });
    void reason;
  }

  const rows = result?.data ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="muted mt-1 text-sm">Create, search and manage {title.toLowerCase()}.</p>
        </div>
        {canWrite && (
          <button className="btn" onClick={openCreate}>
            <Plus size={17} /> Add {singular.toLowerCase()}
          </button>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2 sm:max-w-md">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field !pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
            </div>
            <button className="btn btn-secondary" onClick={() => setQ('')} disabled={!q}>
              Clear search
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm muted">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
        </div>

        {loading && !result ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={row.active === false ? 'opacity-60' : ''}>
                      {columns.map((c, i) => (
                        <td key={c.key}>
                          {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                          {i === 0 && row.active === false && (
                            <span className="ml-2">
                              <Pill>Inactive</Pill>
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="whitespace-nowrap">
                        <Link className="linkbtn" href={`${endpoint}/${row.id}`}>
                          View
                        </Link>
                        {canWrite && (
                          <button className="linkbtn" onClick={() => openEdit(row.id)}>
                            Edit
                          </button>
                        )}
                        {canDelete &&
                          (row.active === false ? (
                            <button className="linkbtn" onClick={() => setConfirm({ kind: 'reactivate', row })}>
                              Reactivate
                            </button>
                          ) : (
                            <>
                              <button className="linkbtn" onClick={() => setConfirm({ kind: 'deactivate', row })}>
                                Deactivate
                              </button>
                              <button className="linkbtn danger" onClick={() => setConfirm({ kind: 'delete', row })}>
                                Delete
                              </button>
                            </>
                          ))}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <EmptyRow cols={columns.length + 1} text={dq ? 'No records match your search.' : `No ${title.toLowerCase()} yet.`} />}
                </tbody>
              </table>
            </div>
            <Pagination meta={result?.meta} onPage={setPage} />
          </>
        )}
      </div>

      {modal && (
        <Modal title={`${modal.mode === 'edit' ? 'Edit' : 'Add'} ${singular.toLowerCase()}`} onClose={closeModal} wide>
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {fields.map((f) => (
                <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]} hint={f.hint} className={f.span === 3 ? 'md:col-span-3' : f.span === 2 ? 'md:col-span-2' : ''}>
                  <FieldInput f={f} form={form} invalid={!!errors[f.name]} setValue={(patch) => { setForm((cur) => ({ ...cur, ...patch })); setDirty(true); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) })); }} />
                </Field>
              ))}
            </div>
            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={save.busy}>Cancel</button>
              <button className="btn" disabled={save.busy}>{save.busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'delete' ? `Delete ${singular.toLowerCase()}?` : confirm.kind === 'deactivate' ? `Deactivate ${singular.toLowerCase()}?` : `Reactivate ${singular.toLowerCase()}?`}
          danger={confirm.kind === 'delete'}
          confirmLabel={confirm.kind === 'delete' ? 'Delete' : confirm.kind === 'deactivate' ? 'Deactivate' : 'Reactivate'}
          busy={act.busy}
          message={
            confirm.kind === 'delete'
              ? `This removes the ${singular.toLowerCase()} from active lists. It is blocked if the record is used by any deed; deeds keep their own saved copy of the details.`
              : confirm.kind === 'deactivate'
                ? `The ${singular.toLowerCase()} will no longer be selectable for new deeds. Existing deeds and history are kept.`
                : `The ${singular.toLowerCase()} will be selectable for new deeds again.`
          }
          onConfirm={runAction}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
