"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, Paperclip } from 'lucide-react';
import { api, download, fmtDateTime, openInline, qs } from '@/lib/api';
import { Alert, Spinner, useSubmit, useToast } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX = 5 * 1024 * 1024;

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.readAsDataURL(file);
  });

export default function DocumentsPanel({ ownerType, ownerId }: { ownerType: 'CUSTOMER' | 'LAND' | 'DEED'; ownerId: string }) {
  const me = useMe();
  const toast = useToast();
  const [docs, setDocs] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useSubmit();

  const load = useCallback(() => {
    api<any[]>(`/documents${qs({ ownerType, ownerId })}`).then(setDocs).catch((e) => setError(e.message));
  }, [ownerType, ownerId]);
  useEffect(load, [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError('');
    if (!OK_TYPES.includes(file.type)) return setFileError('Unsupported file type. Upload a PDF, PNG or JPEG file.');
    if (file.size > MAX) return setFileError('The file is larger than the 5 MB limit.');
    await run(async () => {
      try {
        const contentBase64 = await readBase64(file);
        await api('/documents', { method: 'POST', body: JSON.stringify({ ownerType, ownerId, filename: file.name, mimeType: file.type, contentBase64 }) });
        toast.success('Document uploaded');
        load();
      } catch (err: any) {
        setFileError(err.message); // never claims success when the server did not save the file
      }
    });
  }

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Paperclip size={17} /> Documents
        </h2>
        {can(me.role, 'document:write') && (
          <>
            <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={onPick} />
            <button className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : 'Upload file'}
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-xs muted">PDF, PNG or JPEG, up to 5 MB. Files are stored on the server and checked by type and a basic signature scan; connect a full antivirus scanner before production.</p>
      {fileError && (
        <div className="mt-3">
          <Alert kind="error">{fileError}</Alert>
        </div>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : docs === null ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <p className="mt-4 text-sm muted">No documents uploaded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.originalName}</div>
                <div className="text-xs muted">
                  {(d.size / 1024).toFixed(1)} KB · {d.mimeType} · {d.uploadedBy?.name} · {fmtDateTime(d.createdAt)}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="linkbtn" onClick={() => openInline(`/documents/${d.id}/download?inline=1`).catch((e) => toast.error(e.message))}>
                  <Eye size={14} className="mr-1 inline" />
                  Preview
                </button>
                <button className="linkbtn" onClick={() => download(`/documents/${d.id}/download`, d.originalName).catch((e) => toast.error(e.message))}>
                  <Download size={14} className="mr-1 inline" />
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
