"use client";
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import { api, download } from '@/lib/api';
import { RequireAuth } from '@/lib/session';
import { ErrorState, Spinner, useSubmit, useToast } from '@/components/ui';
import DocumentFrame, { type DocumentFrameHandle } from '@/components/DocumentFrame';

function PrintView() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const frame = useRef<DocumentFrameHandle>(null);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const { busy, run } = useSubmit();
  const pdf = useSubmit();

  useEffect(() => {
    api(`/deeds/${id}`).then(setD).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="p-6"><ErrorState message={err} /></div>;
  if (!d) return <Spinner />;

  async function doPrint() {
    await run(async () => {
      try {
        await api(`/deeds/${id}/print`, { method: 'POST' }); // stores the print event (final copies are counted)
        frame.current?.print();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  }

  async function downloadPdf() {
    await pdf.run(async () => {
      try {
        await download(`/deeds/${id}/pdf`, `deed-${String(id).slice(-8)}.pdf`);
        toast.success('PDF downloaded');
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-slate-100 p-3 text-sm">
        <span>{d.watermark ? `This is a ${d.watermark} copy and will carry a watermark.` : 'Final copy – printing is recorded.'}</span>
        <div className="flex gap-2">
          <button className="btn" onClick={doPrint} disabled={busy || pdf.busy}><Printer size={16} /> {busy ? 'Preparing…' : 'Print'}</button>
          <button className="btn btn-secondary" onClick={downloadPdf} disabled={pdf.busy || busy}><Download size={16} /> {pdf.busy ? 'Preparing PDF…' : 'Download PDF'}</button>
          <button className="btn btn-secondary" onClick={() => window.close()}>Close</button>
        </div>
      </div>
      <DocumentFrame ref={frame} deedId={id} refreshKey={d.version} />
    </div>
  );
}

export default function Page() {
  return <RequireAuth><PrintView /></RequireAuth>;
}
