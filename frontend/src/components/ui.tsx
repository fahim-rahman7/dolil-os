"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { STATUS_LABEL } from '@/lib/perms';

// ------------------------------------------------------------------ toasts
type Toast = { id: number; kind: 'success' | 'error'; text: string };
const ToastCtx = createContext<{ success: (t: string) => void; error: (t: string) => void }>({ success: () => {}, error: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const api = useRef({ success: (t: string) => push('success', t), error: (t: string) => push('error', t) });
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 print:hidden" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`toast-in flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ${t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {t.kind === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ small pieces
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-3 py-6" role="status" aria-label={label}>
      <div className="skeleton h-5 w-1/3" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary mt-3" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center muted">
        {text}
      </td>
    </tr>
  );
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  REVIEW: 'bg-amber-100 text-amber-800',
  READY: 'bg-blue-100 text-blue-800',
  PRINTED: 'bg-violet-100 text-violet-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status] || 'bg-slate-100'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'red' | 'green' | 'blue' }) {
  const t = { slate: 'bg-slate-100 text-slate-700', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', green: 'bg-emerald-100 text-emerald-800', blue: 'bg-blue-100 text-blue-800' }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Alert({ kind = 'warn', title, children }: { kind?: 'warn' | 'error' | 'info'; title?: string; children?: React.ReactNode }) {
  const cls = { warn: 'border-amber-200 bg-amber-50 text-amber-900', error: 'border-red-200 bg-red-50 text-red-800', info: 'border-blue-200 bg-blue-50 text-blue-900' }[kind];
  return (
    <div className={`rounded-xl border p-3 text-sm ${cls}`} role={kind === 'error' ? 'alert' : undefined}>
      {title && <div className="font-semibold">{title}</div>}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ form field
export function Field({ label, error, required, hint, children, className = '' }: { label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs muted">{hint}</span>}
      {error && (
        <span className="mt-1 block text-xs text-red-600" role="alert" data-field-error>
          {error}
        </span>
      )}
    </label>
  );
}

/** Focuses the first invalid field after a failed submit (SRS 11.2). */
export function focusFirstError() {
  setTimeout(() => {
    const el = document.querySelector('[data-field-error]');
    const input = el?.parentElement?.querySelector('input,select,textarea') as HTMLElement | null;
    input?.focus();
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 50);
}

// ------------------------------------------------------------------ modal / confirm
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`panel modal-card my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  title, message, confirmLabel = 'Confirm', danger = false, busy = false, requireReason = false, reasonLabel = 'Reason', onConfirm, onClose,
}: {
  title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; requireReason?: boolean; reasonLabel?: string;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = requireReason && reason.trim().length < 3;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>{message}</div>
        {requireReason && (
          <Field label={reasonLabel} required error={touched && invalid ? 'Enter a reason (at least 3 characters)' : undefined}>
            <textarea className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
          </Field>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : ''}`}
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ pagination / debounce
export function Pagination({ meta, onPage }: { meta?: { page: number; pages: number; total: number }; onPage: (p: number) => void }) {
  if (!meta || meta.pages <= 1) return meta ? <div className="px-4 py-2 text-xs muted">{meta.total} record(s)</div> : null;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="muted">
        Page {meta.page} of {meta.pages} · {meta.total} records
      </span>
      <div className="flex gap-2">
        <button className="btn btn-secondary !px-2" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-secondary !px-2" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Guards against double submission: the handler cannot re-enter while a request is in flight. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
