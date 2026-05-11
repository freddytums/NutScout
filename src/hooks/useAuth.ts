import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, upsertUser } from '@/lib/firestore';
import { useAuthStore } from '@/store/authStore';
import { useSandboxStore } from '@/store/sandboxStore';

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let appUser = await getUser(firebaseUser.uid);
        if (!appUser) {
          await upsertUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? 'Scout',
            photoURL: firebaseUser.photoURL ?? undefined,
            role: 'scout',
          });
          appUser = await getUser(firebaseUser.uid);
        }
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [setUser, setLoading]);
}

/** Returns the current user with sandbox overrides applied if active.
 *  - sandboxUser: full impersonation (name, photo, role, team all replaced)
 *  - sandboxRole: role-only override, identity stays the same
 *  Firestore operations always use the real auth token regardless of sandbox state. */
export function useAuth() {
  const { user, loading } = useAuthStore();
  const { sandboxRole, sandboxUser } = useSandboxStore();

  if (user && sandboxUser) {
    return { user: sandboxUser, loading, realRole: user.role, isImpersonating: true };
  }
  if (user && sandboxRole) {
    return { user: { ...user, role: sandboxRole }, loading, realRole: user.role, isImpersonating: false };
  }
  return { user, loading, realRole: user?.role ?? null, isImpersonating: false };
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  await firebaseSignOut(auth);
}
