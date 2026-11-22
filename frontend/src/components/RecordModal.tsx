"use client";
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Alert, Field, Modal, Spinner, focusFirstError, useSubmit, useToast } from '@/components/ui';
import { CUSTOMER_DEFAULTS, CUSTOMER_FIELDS, landFields } from '@/lib/forms';
import type { FieldDef } from '@/components/RecordsPage';
import FieldInput from '@/components/FieldInput';

const toForm = (row: any, fields: FieldDef[]) =>
  Object.fromEntries(fields.map((f) => [f.name, row?.[f.name] == null ? '' : f.type === 'date' ? String(row[f.name]).slice(0, 10) : String(row[f.name])]));

/** Create or complete a customer / land record from inside another form (e.g. Create Deed). Returns the saved record. */
export default function RecordModal({
  kind, id, onClose, onSaved,
}: {
  kind: 'customer' | 'land';
  id?: string; // edit when set
  onClose: () => void;
  onSaved: (record: any) => void;
}) {
  const toast = useToast();
  const endpoint = kind === 'customer' ? '/customers' : '/lands';
  const [fields, setFields] = useState<FieldDef[] | null>(kind === 'customer' ? CUSTOMER_FIELDS : null);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const { busy, run } = useSubmit();

  useEffect(() => {
    (async () => {
      try {
        const defs = kind === 'customer' ? CUSTOMER_FIELDS : landFields((await api<any>('/office')).areaUnits);
        setFields(defs);
        const row = id ? await api(`${endpoint}/${id}`) : null;
        const base = toForm(row, defs);
        if (!id && kind === 'customer') Object.assign(base, CUSTOMER_DEFAULTS);
        if (!id && kind === 'land') base.areaUnit = defs.find((f) => f.name === 'areaUnit')?.options?.includes('decimal') ? 'decimal' : defs.find((f) => f.name === 'areaUnit')?.options?.[0] ?? '';
        setForm(base);
      } catch (e: any) {
        setFormError(e.message);
      }
    })();
  }, [kind, id, endpoint]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields || !form) return;
    setFormError('');
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (form[f.name] ?? '').trim();
      if (f.required && !v) errs[f.name] = `${f.label} is required`;
      else if (v && f.validate) {
        const m = f.validate(v);
        if (m) errs[f.name] = m;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await run(async () => {
      try {
        const body = JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])));
        const saved = id ? await api(`${endpoint}/${id}`, { method: 'PUT', body }) : await api(endpoint, { method: 'POST', body });
        toast.success(kind === 'customer' ? 'Customer saved' : 'Land record saved');
        onSaved(saved);
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) {
          setErrors(err.errors);
          focusFirstError();
        }
        setFormError(err.message);
      }
    });
  }

  const title = `${id ? 'বিস্তারিত সম্পাদনা' : 'নতুন'} – ${kind === 'customer' ? 'গ্রাহক / পক্ষ (Party)' : 'জমির তথ্য (Land record)'}`;
  return (
    <Modal title={title} onClose={onClose} wide>
      {!fields || !form ? (
        formError ? <Alert kind="error">{formError}</Alert> : <Spinner />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-xs muted">These details are printed in the deed. Anything left blank prints as “—” or a dotted line for you to complete by hand.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {fields.map((f) => (
              <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]} hint={f.hint} className={f.span === 3 ? 'md:col-span-3' : f.span === 2 ? 'md:col-span-2' : ''}>
                <FieldInput f={f} form={form} invalid={!!errors[f.name]} setValue={(patch) => { setForm((cur) => ({ ...(cur ?? {}), ...patch })); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) })); }} />
              </Field>
            ))}
          </div>
          {formError && <Alert kind="error">{formError}</Alert>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save & use'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
