import { useEffect } from 'react';
import { subscribeToAppConfig, appConfigDoc } from '@/lib/firestore';
import { useAppConfigStore } from '@/store/appConfigStore';
import { useAuth } from '@/hooks/useAuth';
import { updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc } from 'firebase/firestore';

/** Call once at app root — syncs Firestore config/app into the Zustand store */
export function useAppConfigSync() {
  const { setConfig } = useAppConfigStore();

  useEffect(() => {
    return subscribeToAppConfig((data) => {
      setConfig({
        tbaKey: (data.tbaKey as string) ?? '',
        tbaKeyStale: (data.tbaKeyStale as boolean) ?? false,
        adminName: (data.adminName as string) ?? 'James Barnes',
        adminEmail: (data.adminEmail as string) ?? 'jamesabarnes3216@gmail.com',
      });
    });
  }, [setConfig]);
}

/** Admin-only: save TBA key to Firestore and clear stale flag */
export async function saveTbaKey(key: string) {
  const ref = appConfigDoc();
  await updateDoc(ref, { tbaKey: key, tbaKeyStale: false }).catch(async () => {
    // doc may not exist yet — create it
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, { tbaKey: key, tbaKeyStale: false }, { merge: true });
  });
}

/** Called when a TBA request returns 401 — marks key stale in Firestore */
export async function markTbaKeyStale() {
  try {
    await updateDoc(doc(db, 'config', 'app'), { tbaKeyStale: true });
  } catch {
    // best-effort; user may not have write permission
  }
  useAppConfigStore.getState().markTbaKeyStale();
}

export function useAppConfig() {
  return useAppConfigStore();
}

export function useTbaKeyAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'lead';
  return { canManageKey: isAdmin };
}
