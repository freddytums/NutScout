import type { Request } from 'firebase-functions/v2/https';
import { adminAuth, db } from './lib/admin';
import type { AppUser, UserRole } from '@shared/types/scout';

export interface AuthContext {
  uid: string;
  email: string | null;
  role: UserRole;
  teamKey: string | null;
  teamNumber: number | null;
  displayName: string;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function verifyAuth(req: Request): Promise<AuthContext> {
  const token = extractBearer(req);
  if (!token) throw new AuthError(401, 'Missing Authorization: Bearer <id-token> header');

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw new AuthError(401, 'Invalid or expired Firebase ID token');
  }

  const snap = await db.collection('users').doc(decoded.uid).get();
  const user = snap.exists ? (snap.data() as AppUser) : null;

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    role: user?.role ?? 'scout',
    teamKey: user?.teamKey ?? null,
    teamNumber: user?.teamNumber ?? null,
    displayName: user?.displayName ?? decoded.name ?? decoded.email ?? 'Scout',
  };
}
