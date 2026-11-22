"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError, api, bdt, isoDate } from '@/lib/api';
import { Alert, Field, Pill, Spinner, focusFirstError, useDebounced, useSubmit, useToast } from '@/components/ui';
import EntityPicker, { customerItem, landItem, type Picked } from '@/components/EntityPicker';
import { PARTY_ROLES, ROLE_LABEL } from '@/lib/perms';
import RecordModal from '@/components/RecordModal';
import { missingCustomer, missingLand } from '@/lib/forms';

interface PartyRow { key: number; role: string; customer: Picked | null }
interface LandRow { key: number; land: Picked | null; share: string; value: string }
type Override = { amount: string; reason: string };

/** Shows the full-size A4 deed HTML scaled down to fit the side panel. */
function ScaledDoc({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1100);
  const scale = 0.58;
  return (
    <div className="max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      <div style={{ width: 794 * scale, height: h * scale }}>
        <iframe
          ref={frame}
          title="Deed preview"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          style={{ width: 794, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onLoad={() => { const x = frame.current?.contentDocument?.documentElement?.scrollHeight; if (x) setH(x + 10); }}
        />
      </div>
    </div>
  );
}

let seq = 1;
const nextKey = () => seq++;

const sig = (parties: PartyRow[], lands: LandRow[]) =>
  JSON.stringify([parties.map((p) => [p.customer?.id, p.role]).sort(), lands.map((l) => [l.land?.id, l.share, l.value]).sort()]);

export default function DeedForm({
  mode, deed, onSaved, onCancel,
}: {
  mode: 'create' | 'edit';
  deed?: any;
  onSaved: (deed: any) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [types, setTypes] = useState<any[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState('');

  const initial = useMemo(() => {
    if (mode === 'edit' && deed) {
      return {
        title: deed.title as string,
        deedType: deed.deedType as string,
        executionDate: isoDate(deed.executionDate),
        valuationBasis: deed.valuationBasis as string,
        perUnitRate: deed.perUnitRate != null ? String(Number(deed.perUnitRate)) : '',
        landValue: String(Number(deed.landValue)),
        totalArea: String(Number(deed.totalArea)),
        areaUnit: deed.areaUnit as string,
        agreedFee: deed.agreedFee != null ? String(Number(deed.agreedFee)) : '',
        notes: (deed.notes ?? '') as string,
        deedNumber: (deed.deedNumber ?? '') as string,
      };
    }
    return { title: '', deedType: 'Sale', executionDate: isoDate(new Date()), valuationBasis: 'TOTAL', perUnitRate: '', landValue: '', totalArea: '', areaUnit: 'decimal', agreedFee: '', notes: '', deedNumber: '' };
  }, [mode, deed]);

  const [f, setF] = useState(initial);
  const [det, setDet] = useState<Record<string, string>>(() => ({ registryOffice: '', purpose: '', ownershipHistory: '', possessionNote: '', powerOfAttorney: '', ...(mode === 'edit' && deed?.details ? Object.fromEntries(Object.entries(deed.details).map(([k, v]) => [k, String(v ?? '')])) : {}) }));
  const setD = (k: string, v: string) => { setDet((x) => ({ ...x, [k]: v })); setDirty(true); };
  const [parties, setParties] = useState<PartyRow[]>(() =>
    mode === 'edit' && deed
      ? deed.snapshot.parties.map((p: any) => ({ key: nextKey(), role: p.role, customer: { id: p.customerId, label: p.name } }))
      : [{ key: nextKey(), role: 'SELLER', customer: null }, { key: nextKey(), role: 'BUYER', customer: null }],
  );
  const [lands, setLands] = useState<LandRow[]>(() =>
    mode === 'edit' && deed
      ? deed.snapshot.lands.map((l: any) => ({ key: nextKey(), land: { id: l.landId, label: `${l.mouza}, ${l.upazila} – Dag ${l.dagNumber}` }, share: l.share != null ? String(Number(l.share)) : '', value: l.value != null ? String(Number(l.value)) : '' }))
      : [{ key: nextKey(), land: null, share: '', value: '' }],
  );
  const initialSig = useRef(sig(parties, lands));
  const [draftText, setDraftText] = useState<string>(mode === 'edit' ? deed?.draftText ?? '' : '');
  const [draftTouched, setDraftTouched] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [regenerate, setRegenerate] = useState(false);
  const [refreshSnap, setRefreshSnap] = useState(false); // corrected a customer/land in the modal: re-copy their data into this deed
  const [reason, setReason] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [ovEdit, setOvEdit] = useState<string | null>(null);
  const [calc, setCalc] = useState<any>(mode === 'edit' && deed ? { lines: deed.feeLines || [], totalFees: String(deed.calculatedFees), conversion: null, landValue: String(deed.landValue) } : null);
  const [calcErr, setCalcErr] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const gen = useSubmit();

  // Full records of the selected parties / lands: used for "what is still missing in the dolil" hints and inline editing.
  const [info, setInfo] = useState<Record<string, any>>({});
  const [modal, setModal] = useState<null | { kind: 'customer' | 'land'; id?: string; rowKey: number }>(null);
  const wanted = [...parties.filter((p) => p.customer).map((p) => `c:${p.customer!.id}`), ...lands.filter((l) => l.land).map((l) => `l:${l.land!.id}`)];
  const wantedKey = wanted.join(',');
  useEffect(() => {
    for (const k of wanted) {
      if (info[k]) continue;
      const [t, id] = [k[0], k.slice(2)];
      api<any>(`${t === 'c' ? '/customers' : '/lands'}/${id}`).then((r) => setInfo((x) => ({ ...x, [k]: r }))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);
  const refreshInfo = (kind: 'customer' | 'land', rec: any) => { setInfo((x) => ({ ...x, [`${kind === 'customer' ? 'c' : 'l'}:${rec.id}`]: rec })); setDocNonce((n) => n + 1); };

  // Live Bangladesh-format document preview (same renderer as the PDF/Word output)
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [docErr, setDocErr] = useState('');
  const [docNonce, setDocNonce] = useState(0);
  const save = useSubmit();

  useEffect(() => {
    Promise.all([api<any[]>('/templates/types'), api<any>('/office')])
      .then(([t, o]) => { setTypes(t); setUnits(o.areaUnits); })
      .catch((e) => setLoadErr(e.message));
  }, []);

  const set = (k: string, v: string) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); setErrors((e) => ({ ...e, [k]: '' })); };
  const typeCfg = types.find((t) => t.name === f.deedType);

  // beforeunload guard for unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // live calculation preview (FR-CALC-*)
  const calcKey = useDebounced(JSON.stringify([f.valuationBasis, f.perUnitRate, f.landValue, f.totalArea, f.areaUnit, f.executionDate, Object.entries(overrides)]), 450);
  useEffect(() => {
    if (!units.length) return;
    const body: any = {
      valuationBasis: f.valuationBasis,
      perUnitRate: f.valuationBasis === 'PER_UNIT' && f.perUnitRate !== '' ? Number(f.perUnitRate) : undefined,
      landValue: f.landValue === '' ? 0 : Number(f.landValue),
      totalArea: f.totalArea === '' ? 0 : Number(f.totalArea),
      areaUnit: f.areaUnit,
      date: f.executionDate || undefined,
      feeOverrides: Object.entries(overrides).filter(([, o]) => o.amount !== '' && o.reason.trim().length >= 3).map(([key, o]) => ({ key, amount: Number(o.amount), reason: o.reason.trim() })),
    };
    if (Number.isNaN(body.landValue) || Number.isNaN(body.totalArea)) return;
    api<any>('/calculations/preview', { method: 'POST', body: JSON.stringify(body) })
      .then((c) => {
        // keep previously saved overrides visible in edit mode
        if (mode === 'edit' && deed?.feeLines) {
          c.lines = c.lines.map((l: any) => {
            const prev = deed.feeLines.find((p: any) => p.key === l.key && p.override);
            return prev && !l.override ? { ...l, override: prev.override, finalAmount: prev.finalAmount, estimateLabel: null } : l;
          });
          c.totalFees = c.lines.reduce((s: number, l: any) => s + Number(l.finalAmount), 0).toFixed(2);
        }
        setCalc(c); setCalcErr('');
      })
      .catch((e) => setCalcErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcKey, units.length]);

  // --- party / land rows
  const updParty = (key: number, patch: Partial<PartyRow>) => { setParties((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r))); setDirty(true); setErrors((e) => ({ ...e, parties: '' })); };
  const updLand = (key: number, patch: Partial<LandRow>) => { setLands((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r))); setDirty(true); setErrors((e) => ({ ...e, lands: '' })); };

  function validate(forPreview = false) {
    const e: Record<string, string> = {};
    if (!forPreview && f.title.trim().length < 2) e.title = 'Deed title is required';
    if (!f.deedType) e.deedType = 'Select a deed type';
    if (f.executionDate && Number.isNaN(new Date(f.executionDate).getTime())) e.executionDate = 'Enter a valid date';
    if (f.valuationBasis === 'PER_UNIT') {
      if (f.perUnitRate === '' || Number(f.perUnitRate) < 0) e.perUnitRate = 'Enter the per-unit rate';
    } else {
      if (f.landValue === '' || Number(f.landValue) < 0) e.landValue = 'Enter the land value (0 or more)';
      else if (Number(f.landValue) === 0 && typeCfg && !typeCfg.allowsZeroValue) e.landValue = `Land value must be greater than zero for a ${f.deedType} deed`;
    }
    if (f.totalArea === '' || Number(f.totalArea) < 0) e.totalArea = 'Enter the total area (0 or more)';
    if (f.agreedFee !== '' && Number(f.agreedFee) < 0) e.agreedFee = 'Agreed fee cannot be negative';
    if (parties.some((p) => !p.customer)) e.parties = 'Select a customer for every party row, or remove the empty row';
    else if (new Set(parties.map((p) => `${p.customer!.id}:${p.role}`)).size !== parties.length) e.parties = 'The same customer is added twice with the same role';
    if (lands.some((l) => !l.land)) e.lands = 'Select a land record for every row, or remove the empty row';
    else if (new Set(lands.map((l) => l.land!.id)).size !== lands.length) e.lands = 'The same land record is added twice';
    return e;
  }

  const partyPayload = () => parties.filter((p) => p.customer).map((p) => ({ customerId: p.customer!.id, role: p.role }));
  const landPayload = () => lands.filter((l) => l.land).map((l) => ({ landId: l.land!.id, ...(l.share !== '' ? { share: Number(l.share) } : {}), ...(l.value !== '' ? { value: Number(l.value) } : {}) }));

  async function generate() {
    setFormError('');
    const errs = validate(true);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await gen.run(async () => {
      try {
        const p = await api<any>('/deeds/preview-draft', {
          method: 'POST',
          body: JSON.stringify({
            deedType: f.deedType, executionDate: f.executionDate || null, valuationBasis: f.valuationBasis,
            perUnitRate: f.valuationBasis === 'PER_UNIT' ? Number(f.perUnitRate) : undefined,
            landValue: f.landValue === '' ? 0 : Number(f.landValue), totalArea: Number(f.totalArea || 0), areaUnit: f.areaUnit,
            parties: partyPayload(), lands: landPayload(),
          }),
        });
        setPreview(p);
        setDraftText(p.draftText);
        setDraftTouched(true);
        setDirty(true);
        toast.success('Draft generated – review it before saving');
      } catch (err: any) {
        setFormError(err.message);
      }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    await save.run(async () => {
      try {
        const feeOverrides = Object.entries(overrides)
          .filter(([, o]) => o.amount !== '' && o.reason.trim().length >= 3)
          .map(([key, o]) => ({ key, amount: Number(o.amount), reason: o.reason.trim() }));
        const body: any = {
          title: f.title.trim(), deedType: f.deedType, executionDate: f.executionDate || null,
          valuationBasis: f.valuationBasis,
          perUnitRate: f.valuationBasis === 'PER_UNIT' ? Number(f.perUnitRate) : undefined,
          landValue: f.landValue === '' ? 0 : Number(f.landValue), totalArea: Number(f.totalArea || 0), areaUnit: f.areaUnit,
          agreedFee: f.agreedFee === '' ? null : Number(f.agreedFee), notes: f.notes.trim() || null,
          ...(feeOverrides.length ? { feeOverrides } : {}),
          details: Object.fromEntries(Object.entries(det).map(([k, v]) => [k, v.trim()])),
        };
        let saved: any;
        if (mode === 'create') {
          body.parties = partyPayload();
          body.lands = landPayload();
          if (draftTouched && draftText.trim()) body.draftText = draftText;
          saved = await api('/deeds', { method: 'POST', body: JSON.stringify(body) });
          toast.success('Deed draft saved');
        } else {
          body.version = deed.version;
          body.deedNumber = f.deedNumber.trim() || null;
          body.reason = reason.trim() || null;
          if (sig(parties, lands) !== initialSig.current || regenerate || refreshSnap) { body.parties = partyPayload(); body.lands = landPayload(); }
          if (regenerate) body.regenerate = true;
          else if (draftText !== (deed.draftText ?? '')) body.draftText = draftText;
          saved = await api(`/deeds/${deed.id}`, { method: 'PUT', body: JSON.stringify(body) });
          toast.success('Deed changes saved');
        }
        setDirty(false);
        if (saved.warnings?.length) saved.warnings.forEach((w: string) => toast.error(w));
        onSaved(saved);
      } catch (err: any) {
        if (err instanceof ApiError && err.errors) { setErrors(err.errors); focusFirstError(); }
        setFormError(err.message);
      }
    });
  }

  function cancel() {
    // Cancel discards the form directly (no confirmation popup).
    setDirty(false);
    onCancel();
  }

  const dateWarning = useMemo(() => {
    if (!f.executionDate) return '';
    const d = new Date(f.executionDate).getTime();
    if (Number.isNaN(d)) return '';
    if (d > Date.now() + 864e5) return 'This date is in the future. Please confirm it is correct.';
    if (d < Date.now() - 366 * 864e5) return 'This date is more than a year ago. Please confirm it is correct.';
    return '';
  }, [f.executionDate]);
  void warnings; void setWarnings;

  const docKey = useDebounced(
    JSON.stringify([f.deedType, f.executionDate, f.valuationBasis, f.perUnitRate, f.landValue, f.totalArea, f.areaUnit, det, f.deedNumber,
      parties.map((p) => [p.customer?.id, p.role]), lands.map((l) => [l.land?.id, l.share, l.value]), draftTouched || mode === 'edit' ? draftText : '', regenerate, docNonce]),
    900,
  );
  useEffect(() => {
    if (!units.length) return;
    if (!parties.some((p) => p.customer) && !lands.some((l) => l.land)) { setDocHtml(null); return; }
    let alive = true;
    api<any>('/deeds/preview-draft', {
      method: 'POST',
      body: JSON.stringify({
        deedType: f.deedType, executionDate: f.executionDate || null, valuationBasis: f.valuationBasis,
        perUnitRate: f.valuationBasis === 'PER_UNIT' && f.perUnitRate !== '' ? Number(f.perUnitRate) : undefined,
        landValue: f.landValue === '' ? 0 : Number(f.landValue), totalArea: Number(f.totalArea || 0), areaUnit: f.areaUnit,
        parties: partyPayload(), lands: landPayload(),
        details: Object.fromEntries(Object.entries(det).map(([k, v]) => [k, v.trim()])),
        deedNumber: f.deedNumber.trim() || null,
        ...((draftTouched || (mode === 'edit' && !regenerate)) && draftText.trim() ? { draftText } : {}),
      }),
    })
      .then((p) => { if (alive) { setDocHtml(p.documentHtml); setDocErr(''); } })
      .catch((e) => { if (alive) setDocErr(`প্রিভিউ হালনাগাদ হয়নি: ${e.message}`); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, units.length]);

  // (all hooks must run before any early return)
  if (loadErr) return <Alert kind="error">{loadErr}</Alert>;
  if (!types.length) return <Spinner />;

  const steps = [
    ['s-info', 'দলিলের তথ্য', 'Deed info'],
    ['s-parties', 'পক্ষসমূহ', 'Parties'],
    ['s-land', 'জমি', 'Land'],
    ['s-calc', 'হিসাব', 'Calculation'],
    ['s-draft', 'খসড়া', 'Draft'],
  ];
  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const previewText = draftText || preview?.draftText || '';
  const wm = mode === 'edit' && deed?.watermark === null ? null : 'DRAFT';

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_490px]">
    <form onSubmit={submit} noValidate className="min-w-0 space-y-5">
      <nav className="panel sticky top-16 z-20 flex flex-wrap items-center gap-1.5 p-2" aria-label="Form sections">
        {steps.map(([id, bn, en], i) => (
          <button key={id} type="button" onClick={() => goto(id)} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">
            <span className="section-num !h-5 !w-5 !text-[11px]">{i + 1}</span>
            {bn} <span className="hidden text-xs text-slate-400 2xl:inline">{en}</span>
          </button>
        ))}
      </nav>
      {/* ------------------------------------------------ deed info */}
      <section id="s-info" className="panel scroll-mt-32 space-y-4 p-5">
        <h2 className="section-title"><span className="section-num">১</span> দলিলের তথ্য <span className="text-xs font-medium text-slate-400">Deed information</span></h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Deed title" required error={errors.title} className="md:col-span-2">
            <input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} aria-invalid={!!errors.title} />
          </Field>
          <Field label="Deed type" required error={errors.deedType}>
            <select className="field" value={f.deedType} onChange={(e) => set('deedType', e.target.value)}>
              {types.map((t) => <option key={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Execution date" error={errors.executionDate} hint={dateWarning || undefined}>
            <input className="field" type="date" value={f.executionDate} onChange={(e) => set('executionDate', e.target.value)} />
          </Field>
          <Field label="Area" required error={errors.totalArea}>
            <input className="field" type="number" min="0" step="any" value={f.totalArea} onChange={(e) => set('totalArea', e.target.value)} aria-invalid={!!errors.totalArea} />
          </Field>
          <Field label="Area unit" required error={errors.areaUnit}>
            <select className="field" value={f.areaUnit} onChange={(e) => set('areaUnit', e.target.value)}>
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Valuation basis">
            <select className="field" value={f.valuationBasis} onChange={(e) => set('valuationBasis', e.target.value)}>
              <option value="TOTAL">Total land value entered</option>
              <option value="PER_UNIT">Per-unit rate × area</option>
            </select>
          </Field>
          {f.valuationBasis === 'PER_UNIT' ? (
            <Field label={`Rate per ${f.areaUnit} (BDT)`} required error={errors.perUnitRate}>
              <input className="field" type="number" min="0" step="0.01" value={f.perUnitRate} onChange={(e) => set('perUnitRate', e.target.value)} aria-invalid={!!errors.perUnitRate} />
            </Field>
          ) : (
            <Field label="Land value (BDT)" required error={errors.landValue} hint={typeCfg?.allowsZeroValue ? 'Zero is allowed for this deed type.' : undefined}>
              <input className="field" type="number" min="0" step="0.01" value={f.landValue} onChange={(e) => set('landValue', e.target.value)} aria-invalid={!!errors.landValue} />
            </Field>
          )}
          <Field label="Agreed office charge (BDT)" error={errors.agreedFee} hint="Used for the outstanding due. Not a government fee.">
            <input className="field" type="number" min="0" step="0.01" value={f.agreedFee} onChange={(e) => set('agreedFee', e.target.value)} />
          </Field>
          {mode === 'edit' && (
            <Field label="Deed number" error={errors.deedNumber} hint="Leave blank until assigned. Never enter a number you have not been issued.">
              <input className="field" value={f.deedNumber} onChange={(e) => set('deedNumber', e.target.value)} maxLength={50} />
            </Field>
          )}
          <Field label="Internal notes" className="md:col-span-3">
            <textarea className="field min-h-20" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
          </Field>
        </div>
        {typeCfg?.warning && <Alert kind="warn">{typeCfg.warning}</Alert>}
        <div className="mt-2 border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-bold text-slate-700">দলিলের অতিরিক্ত বিবরণ <span className="text-xs font-medium text-slate-400">Registration details (printed in the deed)</span></h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="১। নিবন্ধন কার্যালয়ের নাম (Sub-registry office)" className="md:col-span-2"><input className="field" value={det.registryOffice} onChange={(e) => setD('registryOffice', e.target.value)} maxLength={200} placeholder="যেমন: সাব-রেজিস্ট্রারের কার্যালয়, সাভার, ঢাকা" /></Field>
            <Field label="৮। সম্পত্তি হস্তান্তরের উদ্দেশ্য (Purpose)"><textarea className="field min-h-20" value={det.purpose} onChange={(e) => setD('purpose', e.target.value)} maxLength={3000} /></Field>
            <Field label="৯। দখল, ইজমেন্ট স্বত্ব ও মন্তব্য (Possession / easement)"><textarea className="field min-h-20" value={det.possessionNote} onChange={(e) => setD('possessionNote', e.target.value)} maxLength={3000} /></Field>
            <Field label="৭। ২৫ বছরের মালিকানার ধারাবাহিক বিবরণ (Ownership history)" className="md:col-span-2"><textarea className="field min-h-24" value={det.ownershipHistory} onChange={(e) => setD('ownershipHistory', e.target.value)} maxLength={6000} /></Field>
            <Field label="৬। পাওয়ার অব অ্যাটর্নির বিবরণ (if applicable)" className="md:col-span-2"><textarea className="field min-h-16" value={det.powerOfAttorney} onChange={(e) => setD('powerOfAttorney', e.target.value)} maxLength={3000} /></Field>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ parties */}
      <section id="s-parties" className="panel scroll-mt-32 space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title"><span className="section-num">২</span> পক্ষসমূহ <span className="text-xs font-medium text-slate-400">Parties</span></h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setParties((p) => [...p, { key: nextKey(), role: 'WITNESS', customer: null }]); setDirty(true); }}>
            <Plus size={14} /> Add party
          </button>
        </div>
        {parties.map((p) => {
          const rec = p.customer ? info[`c:${p.customer.id}`] : null;
          const miss = rec ? missingCustomer(rec, p.role) : [];
          return (
            <div key={p.key} className="rounded-xl border border-slate-200 p-3">
              <div className="grid items-start gap-3 md:grid-cols-[180px_1fr_auto_auto]">
                <select className="field" value={p.role} onChange={(e) => updParty(p.key, { role: e.target.value })} aria-label="Party role">
                  {PARTY_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <EntityPicker endpoint="/customers" value={p.customer} onChange={(v) => updParty(p.key, { customer: v })} toItem={customerItem} placeholder={`Search and select ${ROLE_LABEL[p.role].toLowerCase()}`} invalid={!!errors.parties && !p.customer} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'customer', rowKey: p.key })}><Plus size={14} /> নতুন</button>
                <button type="button" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setParties((x) => x.filter((r) => r.key !== p.key)); setDirty(true); }} aria-label="Remove party">
                  <Trash2 size={16} />
                </button>
              </div>
              {p.customer && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {!rec ? <span className="muted">Checking details…</span> : miss.length === 0 ? <span className="font-semibold text-emerald-700">✓ দলিলের তথ্য সম্পূর্ণ</span> : (
                    <span className="text-amber-700">দলিলে অনুপস্থিত: <b>{miss.join(', ')}</b> <span className="muted">(ফাঁকা থাকলে “—” ছাপা হবে)</span></span>
                  )}
                  <button type="button" className="linkbtn" onClick={() => setModal({ kind: 'customer', id: p.customer!.id, rowKey: p.key })}>{miss.length ? 'বিস্তারিত দিন' : 'সম্পাদনা'}</button>
                </div>
              )}
            </div>
          );
        })}
        {errors.parties && <p className="text-xs text-red-600" role="alert" data-field-error>{errors.parties}</p>}
        {parties.length === 0 && <p className="text-sm muted">No parties. At least one party is required before the deed can move to review.</p>}
      </section>

      {/* ------------------------------------------------ lands */}
      <section id="s-land" className="panel scroll-mt-32 space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title"><span className="section-num">৩</span> জমির তথ্য <span className="text-xs font-medium text-slate-400">Land records</span></h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLands((p) => [...p, { key: nextKey(), land: null, share: '', value: '' }]); setDirty(true); }}>
            <Plus size={14} /> Add land
          </button>
        </div>
        {lands.map((l) => {
          const rec = l.land ? info[`l:${l.land.id}`] : null;
          const miss = rec ? missingLand(rec) : [];
          return (
            <div key={l.key} className="rounded-xl border border-slate-200 p-3">
              <div className="grid items-start gap-3 md:grid-cols-[1fr_auto_auto]">
                <EntityPicker endpoint="/lands" value={l.land} onChange={(v) => updLand(l.key, { land: v })} toItem={landItem} placeholder="Search and select land record (দাগ)" invalid={!!errors.lands && !l.land} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'land', rowKey: l.key })}><Plus size={14} /> নতুন জমি</button>
                <button type="button" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setLands((x) => x.filter((r) => r.key !== l.key)); setDirty(true); }} aria-label="Remove land">
                  <Trash2 size={16} />
                </button>
              </div>
              {l.land && (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={`হস্তান্তরিত জমি${rec ? ` (${rec.areaUnit})` : ''}`} hint="Blank = whole dag is transferred">
                      <input className="field" type="number" min="0" step="any" value={l.share} onChange={(e) => updLand(l.key, { share: e.target.value })} placeholder={rec ? `${Number(rec.area)}` : ''} />
                    </Field>
                    <Field label="এই দাগের মূল্য (BDT)" hint="Optional – prints in the শ্রেণি অনুযায়ী মূল্য table">
                      <input className="field" type="number" min="0" step="0.01" value={l.value} onChange={(e) => updLand(l.key, { value: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {!rec ? <span className="muted">Checking details…</span> : miss.length === 0 ? <span className="font-semibold text-emerald-700">✓ তফসিলের তথ্য সম্পূর্ণ</span> : (
                      <span className="text-amber-700">তফসিলে অনুপস্থিত: <b>{miss.join(', ')}</b></span>
                    )}
                    <button type="button" className="linkbtn" onClick={() => setModal({ kind: 'land', id: l.land!.id, rowKey: l.key })}>{miss.length ? 'বিস্তারিত দিন' : 'সম্পাদনা'}</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {errors.lands && <p className="text-xs text-red-600" role="alert" data-field-error>{errors.lands}</p>}
        <p className="text-xs muted">A stored land record is an office note; it does not prove ownership.</p>
      </section>

      {/* ------------------------------------------------ calculation */}
      <section id="s-calc" className="panel scroll-mt-32 space-y-3 p-5">
        <h2 className="section-title"><span className="section-num">৪</span> হিসাব <span className="text-xs font-medium text-slate-400">Calculation</span></h2>
        {calcErr && <Alert kind="error">{calcErr}</Alert>}
        {calc && (
          <>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><div className="muted">Land value</div><div className="font-semibold">{bdt(calc.landValue)}</div></div>
              {calc.conversion && (
                <div className="sm:col-span-2">
                  <div className="muted">Area conversion</div>
                  <div className="font-semibold">{calc.conversion.original.value} {calc.conversion.original.unit} = {calc.conversion.converted.value} {calc.conversion.converted.unit}</div>
                  <div className="text-xs muted">{calc.conversion.note}</div>
                </div>
              )}
            </div>
            {calc.lines.length === 0 ? (
              <p className="text-sm muted">No fee rates apply on this date. Office charges and statutory estimates can be configured in Settings → Calculation.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Line</th><th>Basis</th><th>Rate</th><th>Effective / source</th><th className="text-right">Amount</th><th /></tr></thead>
                  <tbody>
                    {calc.lines.map((l: any) => {
                      const ov = overrides[l.key];
                      return (
                        <tr key={l.key}>
                          <td className="font-medium">{l.label} <Pill tone={l.kind === 'OFFICE' ? 'blue' : 'slate'}>{l.kind === 'OFFICE' ? 'Office' : 'Statutory'}</Pill>
                            {l.estimateLabel && <div className="mt-1"><Pill tone="amber">{l.estimateLabel}</Pill></div>}
                            {l.override && <div className="mt-1 text-xs muted">Overridden by {l.override.by || 'you'}: {l.override.reason}</div>}
                          </td>
                          <td className="text-xs">{l.basisText}</td>
                          <td>{l.rate}</td>
                          <td className="text-xs">{l.effectiveFrom}<br />{l.source}</td>
                          <td className="text-right font-semibold">{bdt(l.finalAmount)}{l.override && <div className="text-xs font-normal muted line-through">{bdt(l.amount)}</div>}</td>
                          <td>
                            <button type="button" className="linkbtn" onClick={() => setOvEdit(ovEdit === l.key ? null : l.key)}>Override</button>
                            {ovEdit === l.key && (
                              <div className="mt-2 w-56 space-y-2">
                                <input className="field" type="number" min="0" step="0.01" placeholder="Verified amount" value={ov?.amount ?? ''} onChange={(e) => { setOverrides({ ...overrides, [l.key]: { amount: e.target.value, reason: ov?.reason ?? '' } }); setDirty(true); }} />
                                <input className="field" placeholder="Reason / source" value={ov?.reason ?? ''} onChange={(e) => { setOverrides({ ...overrides, [l.key]: { amount: ov?.amount ?? '', reason: e.target.value } }); setDirty(true); }} />
                                <p className="text-xs muted">Needs an amount and a reason (3+ chars). Recorded with your name.</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td colSpan={4} className="text-right font-semibold">Total fee estimate</td><td className="text-right font-bold">{bdt(calc.totalFees)}</td><td /></tr></tfoot>
                </table>
              </div>
            )}
            <p className="text-xs muted">Estimates only – not official government fee advice. Verify current rates with the authority.</p>
          </>
        )}
      </section>

      {/* ------------------------------------------------ draft */}
      <section id="s-draft" className="panel scroll-mt-32 space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title"><span className="section-num">৫</span> দলিলের খসড়া <span className="text-xs font-medium text-slate-400">Draft</span> <Pill tone="amber">DRAFT – not legally verified</Pill></h2>
            <p className="text-xs muted">Generated from the stored party and land details. Review and edit it; master records are not changed.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={generate} disabled={gen.busy}>
            {gen.busy ? 'Generating…' : mode === 'edit' ? 'Preview regenerated draft' : 'Generate draft / preview'}
          </button>
        </div>
        {preview?.templateWarning && <Alert kind="warn">{preview.templateWarning}</Alert>}
        {preview && (preview.blocking.length > 0 || preview.unresolved.length > 0) && (
          <Alert kind="warn" title="Missing required information">
            <ul className="list-disc pl-5">
              {preview.blocking.map((m: string) => <li key={m}>{m}</li>)}
              {preview.unresolved.map((m: string) => <li key={m}>Unresolved placeholder: {`{{${m}}}`}</li>)}
            </ul>
          </Alert>
        )}
        {preview && preview.warnings.length > 0 && (
          <Alert kind="info" title="Flagged for manual review"><ul className="list-disc pl-5">{preview.warnings.map((m: string) => <li key={m}>{m}</li>)}</ul></Alert>
        )}
        {(draftText || mode === 'edit') ? (
          <textarea className="field deed-text min-h-[22rem] font-sans" value={draftText} onChange={(e) => { setDraftText(e.target.value); setDraftTouched(true); setDirty(true); }} aria-label="Draft text" />
        ) : (
          <p className="text-sm muted">Click “Generate draft / preview” to see the text, or save now and the system will generate it automatically.</p>
        )}
        {mode === 'edit' && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={regenerate} onChange={(e) => { setRegenerate(e.target.checked); setDirty(true); }} />
              Regenerate the draft from the template using current customer/land data (overwrites the text above)
            </label>
            <Field label="Reason for change (kept in the revision history)"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
          </>
        )}
      </section>

      {formError && <Alert kind="error">{formError}</Alert>}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
        <button className="btn" disabled={save.busy}>{save.busy ? 'Saving…' : mode === 'create' ? 'Save draft / create deed' : 'Save changes'}</button>
        <button type="button" className="btn btn-secondary" onClick={cancel} disabled={save.busy}>Cancel</button>
        {dirty && <span className="ml-auto text-xs text-amber-600">● Unsaved changes</span>}
      </div>
    </form>

    <aside className="sticky top-20 hidden xl:block" aria-label="Document preview">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-sm font-bold">দলিল প্রিভিউ <span className="text-xs font-medium text-slate-400">Live preview</span></div>
        <Pill tone="amber">DRAFT</Pill>
      </div>
      {docHtml ? (
        <ScaledDoc html={docHtml} />
      ) : (
        <div className="paper max-h-[calc(100vh-9rem)] overflow-y-auto">
          {wm && <div className="stamp" aria-hidden>{wm}</div>}
          <div className="relative">
            {previewText ? previewText : <span className="text-slate-400">দলিলের প্রিভিউ এখানে দেখাবে — একজন পক্ষ বা জমি নির্বাচন করুন। The deed (Bangladesh format) appears here and updates as you type.</span>}
          </div>
        </div>
      )}
      {docErr && <p className="mt-2 px-1 text-xs text-amber-700">{docErr}</p>}
      <p className="mt-2 px-1 text-xs muted">Draft only – verify against source documents before use.</p>
    </aside>
    {modal && (
      <RecordModal
        kind={modal.kind}
        id={modal.id}
        onClose={() => setModal(null)}
        onSaved={(rec) => {
          refreshInfo(modal.kind, rec);
          if (modal.kind === 'customer') updParty(modal.rowKey, { customer: { id: rec.id, label: rec.name } });
          else updLand(modal.rowKey, { land: { id: rec.id, label: `${rec.mouza}, ${rec.upazila} – Dag ${rec.dagNumber}` } });
          // A saved deed keeps its own copy of party/land data: it is re-copied on save (the draft text is left as it is).
          if (mode === 'edit') { setRefreshSnap(true); setDirty(true); }
          setModal(null);
        }}
      />
    )}
    </div>
  );
}
