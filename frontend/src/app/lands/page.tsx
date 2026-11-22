"use client";
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import RecordsPage, { type ColumnDef } from '@/components/RecordsPage';
import { landFields } from '@/lib/forms';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

const columns: ColumnDef[] = [
  { key: 'district', label: 'District' },
  { key: 'upazila', label: 'Upazila / Thana' },
  { key: 'mouza', label: 'Mouza' },
  { key: 'khatianNumber', label: 'Khatian' },
  { key: 'dagNumber', label: 'Dag' },
  { key: 'area', label: 'Area', render: (r) => `${Number(r.area)} ${r.areaUnit}` },
];

function Lands() {
  const [units, setUnits] = useState<string[] | null>(null);
  useEffect(() => {
    api<any>('/office').then((o) => setUnits(o.areaUnits)).catch(() => setUnits(['decimal', 'shotok', 'katha', 'bigha']));
  }, []);
  if (!units) return <Spinner />;
  const fields = landFields(units);
  return <RecordsPage title="Land records" singular="Land record" endpoint="/lands" permBase="land" fields={fields} columns={columns} searchPlaceholder="Search district, upazila, mouza, khatian or dag" emptyForm={{ areaUnit: units.includes('decimal') ? 'decimal' : units[0] }} />;
}

export default function LandsPage() {
  return <AppShell><Lands /></AppShell>;
}
