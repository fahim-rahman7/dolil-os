"use client";
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, fmtDate } from '@/lib/api';
import { Alert, Field, Modal, Pill, Spinner, useSubmit, useToast } from '@/components/ui';

export default function TemplatesSettings({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<null | { deedType: string; name: string; body: string }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [view, setView] = useState<any>(null);
  const save = useSubmit();
  const act = useSubmit();

  const load = useCallback(() => {
    api<any[]>('/templates').then(setRows).catch((e) => setErr(e.message));
    api<string[]>('/templates/placeholders').then(setPlaceholders).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!edit) return;
    setFormErr('');
    const errs: Record<string, string> = {};
    if (edit.name.trim().length < 2) errs.name = 'Template name is required';
    if (edit.body.trim().length < 20) errs.body = 'Template text is too short';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await save.run(async () => {
      try {
        await api('/templates', { method: 'POST', body: JSON.stringify({ deedType: edit.deedType, name: edit.name.trim(), body: edit.body }) });
        toast.success('New template version saved – it must be approved before final use');
        setEdit(null);
        load();
      } catch (e: any) {
        if (e instanceof ApiError && e.errors) setErrors(e.errors);
        setFormErr(e.message);
      }
    });
  }
  async function toggle(t: any) {
    await act.run(async () => {
      try {
        await api(`/templates/${t.id}/${t.approvalStatus === 'APPROVED' ? 'unapprove' : 'approve'}`, { method: 'POST' });
        toast.success(t.approvalStatus === 'APPROVED' ? 'Template approval withdrawn' : 'Template approved');
        load();
      } catch (e: any) { toast.error(e.message); }
    });
  }

  if (err) return <Alert kind="error">{err}</Alert>;
  if (!rows) return <Spinner />;
  const types = [...new Set(rows.map((r) => r.deedType))];
  return (
    <div className="space-y-5">
      <Alert kind="warn" title="Templates must be approved by a qualified reviewer">
        The bundled starter templates are unapproved drafting aids with generic structure. Have a local legal professional review the wording, then approve each version here. Only approved templates can be used for READY output. Editing creates a new unapproved version; approved versions are never changed.
      </Alert>
      {types.map((type) => {
        const list = rows.filter((r) => r.deedType === type);
        return (
          <div key={type} className="panel overflow-x-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{type}</h2>
              {canWrite && <button className="btn btn-secondary btn-sm" onClick={() => setEdit({ deedType: type, name: `${type} (new version)`, body: list[0].body })}>New version</button>}
            </div>
            <table className="table">
              <thead><tr><th>Version</th><th>Name</th><th>Status</th><th>Created</th><th /></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td>v{t.version}</td><td>{t.name}</td>
                    <td>{t.approvalStatus === 'APPROVED' ? <Pill tone="green">Approved {fmtDate(t.approvedAt)}</Pill> : <Pill tone="amber">Unapproved</Pill>}</td>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td className="whitespace-nowrap">
                      <button className="linkbtn" onClick={() => setView(t)}>View</button>
                      {canWrite && <button className="linkbtn" disabled={act.busy} onClick={() => toggle(t)}>{t.approvalStatus === 'APPROVED' ? 'Withdraw approval' : 'Approve'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {view && (
        <Modal title={`${view.deedType} template v${view.version}`} onClose={() => setView(null)} wide>
          <pre className="deed-text max-h-[60vh] overflow-auto rounded-lg bg-slate-50 p-4 font-sans text-sm">{view.body}</pre>
        </Modal>
      )}
      {edit && (
        <Modal title={`New ${edit.deedType} template version`} onClose={() => setEdit(null)} wide>
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Template text" required error={errors.body}><textarea className="field min-h-72 font-mono text-sm" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <div className="text-xs muted">Placeholders: {placeholders.map((p) => <code key={p} className="mr-2">{`{{${p}}}`}</code>)}</div>
            {formErr && <Alert kind="error">{formErr}</Alert>}
            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setEdit(null)} disabled={save.busy}>Cancel</button>
              <button className="btn" onClick={create} disabled={save.busy}>{save.busy ? 'Saving…' : 'Save new version'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
