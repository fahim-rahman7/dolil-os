"use client";
import AppShell from '@/components/AppShell';
import DeedForm from '@/components/DeedForm';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui';
import { useMe } from '@/lib/session';
import { can } from '@/lib/perms';

function NewDeed() {
  const router = useRouter();
  const me = useMe();
  if (!can(me.role, 'deed:write')) return <Alert kind="error">Your role cannot create deeds.</Alert>;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Create new deed</h1>
        <p className="muted text-sm">Enter deed, party and land details, generate a draft, then verify it against the source documents before printing.</p>
      </div>
      <DeedForm mode="create" onSaved={(d) => router.push(`/deeds/${d.id}`)} onCancel={() => router.push('/deeds')} />
    </>
  );
}

export default function Page() {
  return <AppShell><NewDeed /></AppShell>;
}
