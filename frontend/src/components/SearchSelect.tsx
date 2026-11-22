"use client";
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/** Bangla can be typed in precomposed or decomposed form (য়, ড়, ঢ়); compare canonically. */
const same = (a: string, b: string) => a.normalize('NFC') === b.normalize('NFC');

export interface SelectOption {
  value: string;
  label: string;
  /** extra text matched by the search box (e.g. the English name) */
  search?: string;
}

/**
 * Searchable dropdown: click to open, type to filter, arrow keys + Enter or click to choose.
 * A value that is not in `options` (older records) is still shown so it is never silently lost.
 */
export default function SearchSelect({
  value, onChange, options, placeholder = 'নির্বাচন করুন', searchPlaceholder = 'খুঁজুন…', invalid, disabled, emptyText = 'কিছু পাওয়া যায়নি', footer, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyText?: string;
  footer?: { label: string; onClick: () => void };
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const all = useMemo(() => (value && !options.some((o) => same(o.value, value)) ? [{ value, label: `${value} (বর্তমান মান)` }, ...options] : options), [options, value]);
  const shown = useMemo(() => {
    const t = q.trim().normalize('NFC').toLowerCase();
    return t ? all.filter((o) => `${o.label} ${o.search ?? ''}`.normalize('NFC').toLowerCase().includes(t)) : all;
  }, [all, q]);
  const selected = all.find((o) => same(o.value, value));

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { if (open) { setQ(''); setActive(Math.max(0, all.findIndex((o) => same(o.value, value)))); setTimeout(() => input.current?.focus(), 0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId]);

  const pick = (v: string) => { onChange(v); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active].value); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  return (
    // inside a <label> a click on non-interactive list text would otherwise re-trigger the toggle button
    <div className="relative" ref={box} onClick={(e) => { if ((e.target as HTMLElement).closest('[role=listbox]')) e.preventDefault(); }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={`field flex items-center justify-between gap-2 text-left ${invalid ? 'invalid' : ''}`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
        <span className="flex items-center gap-1 text-slate-400">
          {value && !disabled && (
            <span role="button" tabIndex={-1} aria-label="Clear selection" className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(''); }}>
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={searchPlaceholder} className="field !py-2 !pl-9 text-sm" aria-label="Search options" role="combobox" aria-controls={listId} aria-expanded="true" />
          </div>
          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-3 text-sm muted">{emptyText}</li>}
            {shown.map((o, i) => (
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={same(o.value, value)}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === active ? 'bg-emerald-50' : ''}`}
                >
                  <span>{o.label}</span>
                  {same(o.value, value) && <Check size={15} className="text-emerald-600" />}
                </button>
              </li>
            ))}
          </ul>
          {footer && (
            <button type="button" onClick={() => { setOpen(false); footer.onClick(); }} className="w-full border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              {footer.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
