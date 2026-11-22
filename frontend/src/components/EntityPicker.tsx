"use client";
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/components/ui';

export interface Picked {
  id: string;
  label: string;
}

/** Search-as-you-type selector backed by a paginated list endpoint (keeps working past 100 records). */
export default function EntityPicker({
  endpoint, value, onChange, toItem, placeholder, invalid, extraQuery,
}: {
  endpoint: string;
  value: Picked | null;
  onChange: (v: Picked | null) => void;
  toItem: (row: any) => Picked & { sub?: string };
  placeholder: string;
  invalid?: boolean;
  extraQuery?: Record<string, unknown>;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<(Picked & { sub?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setErr('');
    api<any[]>(`${endpoint}${qs({ q: dq, limit: 8, ...extraQuery })}`)
      .then((rows) => alive && setItems(rows.map(toItem)))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dq, endpoint]);

  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (value) {
    return (
      <div className={`field flex items-center justify-between gap-2 ${invalid ? 'invalid' : ''}`}>
        <span className="truncate">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="Clear selection" className="rounded p-1 hover:bg-slate-100">
          <X size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="relative" ref={box}>
      <input className={`field ${invalid ? 'invalid' : ''}`} placeholder={placeholder} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label={placeholder} aria-invalid={invalid} />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg" role="listbox">
          {loading && <li className="px-3 py-2 text-sm muted">Searching…</li>}
          {err && <li className="px-3 py-2 text-sm text-red-600">{err}</li>}
          {!loading && !err && items.length === 0 && <li className="px-3 py-2 text-sm muted">No records found.</li>}
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" role="option" className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50" onClick={() => { onChange({ id: it.id, label: it.label }); setOpen(false); setQ(''); }}>
                <div className="font-medium">{it.label}</div>
                {it.sub && <div className="text-xs muted">{it.sub}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const customerItem = (c: any) => ({ id: c.id, label: c.name, sub: [c.phone, c.nid && `NID ${c.nid}`, c.address].filter(Boolean).join(' · ') });
export const landItem = (l: any) => ({ id: l.id, label: `${l.mouza}, ${l.upazila} – Dag ${l.dagNumber}`, sub: `${l.district} · Khatian ${l.khatianNumber || '—'} · ${Number(l.area)} ${l.areaUnit}` });
