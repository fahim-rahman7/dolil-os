"use client";
import { useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Field, Modal, StatusBadge, useSubmit, useToast } from '@/components/ui';

export interface Transition {
  to: string;
  needsReason: boolean;
  needsChecklist: boolean;
  needsPrint: boolean;
}

const CHECKS: [string, string][] = [
  ['partiesVerified', 'Parties and their identity details match the original documents'],
  ['landVerified', 'Land details (location, khatian, dag, area, boundaries) match the land papers'],
  ['amountVerified', 'Land value, amount in words and area are correct'],
  ['templateChecked', 'The approved template and the final wording have been reviewed'],
];

/** One modal for every status change: collects the reason / checklist the SRS requires and shows API errors. */
export default function StatusModal({ deed, transition, onClose, onDone }: { deed: { id: string; title: string; status: string }; transition: Transition; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({ partiesVerified: false, landVerified: false, amountVerified: false, templateChecked: false });
  const [error, setError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const { busy, run } = useSubmit();
  const allChecked = Object.values(checklist).every(Boolean);

  async function submit() {
    setError('');
    setReasonError('');
    if (transition.needsReason && reason.trim().length < 3) return setReasonError('Enter a reason (at least 3 characters)');
    if (transition.needsChecklist && !allChecked) return setError('Complete every item of the review checklist.');
    await run(async () => {
      try {
        await api(`/deeds/${deed.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: transition.to, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(transition.needsChecklist ? { checklist } : {}) }),
        });
        toast.success(`Deed moved to ${transition.to}`);
        onDone();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <Modal title={`Change status: ${deed.title}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={deed.status} /> → <StatusBadge status={transition.to} />
        </div>
        {transition.to === 'CANCELLED' && <Alert kind="warn">Cancelling closes the record. History and any payments are retained.</Alert>}
        {transition.needsChecklist && (
          <div className="space-y-2">
            <div className="font-semibold">Review checklist</div>
            {CHECKS.map(([k, label]) => (
              <label key={k} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={checklist[k]} onChange={(e) => setChecklist({ ...checklist, [k]: e.target.checked })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
        {transition.needsPrint && <Alert kind="info">A final copy must be printed first so a print event is recorded.</Alert>}
        {transition.needsReason && (
          <Field label="Reason" required error={reasonError}>
            <textarea className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
          </Field>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${transition.to === 'CANCELLED' ? 'btn-danger' : ''}`} onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : `Move to ${transition.to}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
