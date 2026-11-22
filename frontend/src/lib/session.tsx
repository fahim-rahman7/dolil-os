"use client";
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearSession, getToken } from '@/lib/api';
import type { Role } from '@/lib/perms';

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  office: { id: string; name: string };
  permissions: { settingsWrite: boolean; settingsRead: boolean; userManage: boolean };
}

const Ctx = createContext<Me | null>(null);
export const useMe = () => {
  const me = useContext(Ctx);
  if (!me) throw new Error('useMe outside RequireAuth');
  return me;
};

/** Redirects to /login without a valid session; renders children only once the current user is loaded. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Me>('/auth/me')
      .then(setMe)
      .catch((e) => {
        if (e.status === 401) {
          clearSession();
          router.replace('/login');
        } else setError(e.message);
      });
  }, [router]);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-red-700">{error}</p>
          <button className="btn mt-4" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }
  if (!me) return <div className="p-10 text-center muted">Loading Dolil OS…</div>;
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}
