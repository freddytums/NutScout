import { useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, upsertUser, subscribeToUser } from '@/lib/firestore';
import { useAuthStore } from '@/store/authStore';
import { useSandboxStore } from '@/store/sandboxStore';

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore();
  const userDocUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down any prior user-doc listener before processing the new auth state.
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;

      if (firebaseUser) {
        let appUser = await getUser(firebaseUser.uid);
        if (!appUser) {
          // New sign-ups start with no access — a lead/admin must elevate them.
          await upsertUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? 'Guest',
            photoURL: firebaseUser.photoURL ?? undefined,
            role: 'guest',
          });
          appUser = await getUser(firebaseUser.uid);
        }
        setUser(appUser);
        setLoading(false);

        // Subscribe to the user's doc so role changes propagate without re-login.
        userDocUnsubRef.current = subscribeToUser(firebaseUser.uid, (updated) => {
          if (updated) setUser(updated);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => {
      unsubAuth();
      userDocUnsubRef.current?.();
    };
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
