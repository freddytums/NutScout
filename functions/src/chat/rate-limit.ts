import { db } from '../lib/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 30;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkAndIncrementRateLimit(uid: string): Promise<RateLimitResult> {
  const ref = db.collection('ai_usage').doc(uid);
  const now = Date.now();

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { windowStart?: Timestamp; count?: number }) : null;
    const windowStartMs = data?.windowStart?.toMillis() ?? 0;
    const expired = now - windowStartMs > WINDOW_MS;
    const count = expired ? 0 : data?.count ?? 0;

    if (count >= MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStartMs + WINDOW_MS,
      };
    }

    if (expired) {
      tx.set(ref, { windowStart: Timestamp.now(), count: 1 });
    } else {
      tx.set(ref, { count: FieldValue.increment(1) }, { merge: true });
    }

    return {
      allowed: true,
      remaining: MAX_REQUESTS - count - 1,
      resetAt: (expired ? now : windowStartMs) + WINDOW_MS,
    };
  });
}
