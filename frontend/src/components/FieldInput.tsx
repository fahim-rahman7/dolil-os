"use client";
import { useMemo, useState } from 'react';
import SearchSelect from '@/components/SearchSelect';
import type { FieldDef } from '@/components/RecordsPage';
import { BD_GEO, findDistrict, nfc } from '@/data/bdGeo';

/**
 * The control for one form field. Shared by the list pages and the inline "new customer / land" modal so
 * both behave identically (dropdowns, searchable জেলা, dependent থানা/উপজেলা, dates, numbers…).
 */
export default function FieldInput({
  f, form, setValue, invalid,
}: {
  f: FieldDef;
  form: Record<string, string>;
  setValue: (patch: Record<string, string>) => void;
  invalid: boolean;
}) {
  const value = form[f.name] ?? '';
  const set = (v: string) => setValue({ [f.name]: v });

  // ---- জেলা: searchable list of the 64 districts
  if (f.type === 'district') {
    const options = BD_GEO.map((d) => ({ value: d.bn, label: `${d.bn} (${d.en})`, search: d.en }));
    return (
      <SearchSelect
        value={value}
        options={options}
        placeholder="জেলা নির্বাচন করুন"
        searchPlaceholder="জেলা খুঁজুন (বাংলা বা English)…"
        invalid={invalid}
        ariaLabel={f.label}
        // changing the district clears an upazila that does not belong to it
        onChange={(v) => setValue({ district: v, ...(findDistrict(v)?.upazilas.some((u) => nfc(u.bn) === nfc(form.upazila)) ? {} : { upazila: '' }) })}
      />
    );
  }

  // ---- থানা/উপজেলা: the upazilas of the chosen district (or free text via "অন্যান্য")
  if (f.type === 'upazila') return <UpazilaInput f={f} district={form.district ?? ''} value={value} set={set} invalid={invalid} />;

  if (f.type === 'select') {
    const opts = f.options ?? [];
    return (
      <select className="field" value={value} onChange={(e) => set(e.target.value)} aria-invalid={invalid}>
        <option value="">নির্বাচন করুন (Select)</option>
        {value && !opts.includes(value) && <option value={value}>{value}</option>}
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'textarea') {
    return <textarea className="field min-h-20" value={value} onChange={(e) => set(e.target.value)} aria-invalid={invalid} />;
  }
  return (
    <input
      className="field"
      type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'}
      step={f.type === 'number' ? 'any' : undefined}
      min={f.type === 'number' ? 0 : undefined}
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-invalid={invalid}
    />
  );
}

function UpazilaInput({ f, district, value, set, invalid }: { f: FieldDef; district: string; value: string; set: (v: string) => void; invalid: boolean }) {
  const geo = findDistrict(district);
  const options = useMemo(() => (geo ? geo.upazilas.map((u) => ({ value: u.bn, label: `${u.bn} (${u.en})`, search: u.en })) : []), [geo]);
  const [manual, setManual] = useState(false);
  // free text is used when the user asked for it, or when the saved value is not one of the district's upazilas
  const custom = manual || (!!value && !!geo && !options.some((o) => nfc(o.value) === nfc(value))) || (!geo && !!district && !!value);

  if (!district) {
    return <div className="field flex items-center text-sm text-slate-400" aria-disabled>আগে জেলা নির্বাচন করুন</div>;
  }
  if (custom) {
    return (
      <div className="space-y-1">
        <input className="field" value={value} onChange={(e) => set(e.target.value)} placeholder="থানা/উপজেলার নাম লিখুন" aria-invalid={invalid} autoFocus={manual} />
        {geo && <button type="button" className="linkbtn !pl-0 text-xs" onClick={() => { setManual(false); set(''); }}>← তালিকা থেকে নির্বাচন করুন ({options.length}টি উপজেলা)</button>}
      </div>
    );
  }
  return (
    <SearchSelect
      value={value}
      options={options}
      placeholder={`${district}-এর থানা/উপজেলা নির্বাচন করুন`}
      searchPlaceholder="উপজেলা খুঁজুন…"
      invalid={invalid}
      ariaLabel={f.label}
      onChange={set}
      footer={{ label: 'অন্যান্য / মেট্রোপলিটন থানা – নিজে লিখুন', onClick: () => { setManual(true); set(''); } }}
    />
  );
}
