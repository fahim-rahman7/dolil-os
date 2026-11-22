"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorState, Spinner } from '@/components/ui';

export interface DocumentFrameHandle {
  print: () => void;
}

/** Shows the server-rendered Bangladesh-format deed (same HTML that is used for PDF), so preview = print output. */
const DocumentFrame = forwardRef<DocumentFrameHandle, { deedId: string; refreshKey?: string | number }>(function DocumentFrame({ deedId, refreshKey }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [height, setHeight] = useState(900);

  useEffect(() => {
    setHtml(null);
    setErr('');
    api<{ html: string }>(`/deeds/${deedId}/document`).then((d) => setHtml(d.html)).catch((e) => setErr(e.message));
  }, [deedId, refreshKey]);

  useImperativeHandle(ref, () => ({ print: () => frame.current?.contentWindow?.print() }));

  if (err) return <ErrorState message={err} />;
  if (html === null) return <Spinner label="Preparing document…" />;
  return (
    <iframe
      ref={frame}
      title="Deed document"
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      className="w-full rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ height }}
      onLoad={() => {
        const h = frame.current?.contentDocument?.documentElement?.scrollHeight;
        if (h) setHeight(h + 24);
      }}
    />
  );
});
export default DocumentFrame;
