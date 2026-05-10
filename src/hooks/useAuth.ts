import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, upsertUser } from '@/lib/firestore';
import { useAuthStore } from '@/store/authStore';

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

export function useAuth() {
  return useAuthStore();
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  await firebaseSignOut(auth);
}
