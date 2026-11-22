"use client";
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import RecordsPage, { type ColumnDef } from '@/components/RecordsPage';
import { Pill, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { CUSTOMER_DEFAULTS, CUSTOMER_FIELDS } from '@/lib/forms';
import { useMe } from '@/lib/session';

/**
 * NID is masked in lists (BR-16). Roles that may see full NIDs can reveal it with the eye button;
 * the full value is fetched only on demand and hidden again on the next click.
 */
function NidCell({ row }: { row: any }) {
  const me = useMe();
  const toast = useToast();
  const [full, setFull] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // a changed NID (after an edit) must never keep showing the old revealed value
  useEffect(() => { setFull(null); setShow(false); }, [row.nid, row.updatedAt]);

  if (!row.nid) return <Pill tone="amber">Missing – review</Pill>;
  const canReveal = me.role !== 'ACCOUNTANT'; // accountants never see full NIDs

  async function toggle() {
    if (show) return setShow(false);
    if (full) return setShow(true);
    setBusy(true);
    try {
      const rec = await api<any>(`/customers/${row.id}`);
      setFull(rec.nid);
      setShow(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs tracking-wide">{show && full ? full : row.nid}</span>
      {canReveal && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-60"
          aria-label={show ? 'Hide NID' : 'Show full NID'}
          aria-pressed={show}
          title={show ? 'Hide NID' : 'Show full NID'}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </span>
  );
}

const columns: ColumnDef[] = [
  { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'phone', label: 'Phone' },
  { key: 'nid', label: 'NID', render: (r) => <NidCell row={r} /> },
  { key: 'address', label: 'Address', render: (r) => <span className="line-clamp-2 max-w-xs">{r.address || r.permanentAddress || '—'}</span> },
];

export default function Customers() {
  return (
    <AppShell>
      <RecordsPage
        title="Customers"
        singular="Customer"
        endpoint="/customers"
        permBase="customer"
        fields={CUSTOMER_FIELDS}
        columns={columns}
        searchPlaceholder="Search name, phone or NID"
        emptyForm={CUSTOMER_DEFAULTS}
      />
    </AppShell>
  );
}
