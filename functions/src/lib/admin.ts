import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// firebase-admin app singleton — Cloud Functions reuses the runtime instance
// across warm invocations, so guard against re-initialization.
if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();
