import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  getDocs,
  writeBatch,
  deleteField,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, PitEntry, MatchEntry, EventConfig, Station, StationAssignments, StationAssignment, GeneratedSchedule, ScoutNotification } from '@/types/scout';

// ─── Collections ────────────────────────────────────────────────────────────

export const usersCol = () => collection(db, 'users');
export const eventsCol = () => collection(db, 'events');
export const pitsCol = (eventId: string) => collection(db, 'events', eventId, 'pits');
export const matchesCol = (eventId: string) => collection(db, 'events', eventId, 'matches');

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(usersCol(), uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

export async function upsertUser(user: Omit<AppUser, 'createdAt'> & { createdAt?: Timestamp }) {
  const ref = doc(usersCol(), user.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, { ...user, createdAt: serverTimestamp() });
  } else {
    await updateDoc(ref, {
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
    });
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function subscribeToEvent(eventId: string, cb: (e: EventConfig | null) => void) {
  return onSnapshot(doc(eventsCol(), eventId), (snap) => {
    cb(snap.exists() ? (snap.data() as EventConfig) : null);
  });
}

// ─── Pit Scouting ────────────────────────────────────────────────────────────

export function subscribeToPits(eventId: string, cb: (pits: PitEntry[]) => void) {
  return onSnapshot(pitsCol(eventId), (snap) => {
    cb(snap.docs.map((d) => d.data() as PitEntry));
  });
}

export async function claimPit(eventId: string, teamNumber: number, userId: string, userName: string) {
  const ref = doc(pitsCol(eventId), String(teamNumber));
  await updateDoc(ref, {
    status: 'dibbed',
    dibbedBy: userId,
    dibbedByName: userName,
    dibbedAt: serverTimestamp(),
  });
}

export async function unclaimPit(eventId: string, teamNumber: number) {
  const ref = doc(pitsCol(eventId), String(teamNumber));
  await updateDoc(ref, {
    status: 'unclaimed',
    dibbedBy: null,
    dibbedByName: null,
    dibbedAt: null,
  });
}

export async function submitPitScouting(
  eventId: string,
  teamNumber: number,
  userId: string,
  data: Record<string, unknown>
) {
  const ref = doc(pitsCol(eventId), String(teamNumber));
  await updateDoc(ref, {
    status: 'scouted',
    scoutedBy: userId,
    scoutedAt: serverTimestamp(),
    data,
  });
}

// ─── Match Scouting ──────────────────────────────────────────────────────────

export function subscribeToMatches(
  eventId: string,
  constraints: QueryConstraint[],
  cb: (matches: MatchEntry[]) => void
) {
  const q = query(matchesCol(eventId), ...constraints);
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MatchEntry));
  });
}

export async function submitMatch(eventId: string, entry: Omit<MatchEntry, 'id'>) {
  const ref = doc(matchesCol(eventId));
  await setDoc(ref, { ...entry, timestamp: serverTimestamp() });
  return ref.id;
}

export async function flagMatch(eventId: string, matchId: string, flags: MatchEntry['flags']) {
  await updateDoc(doc(matchesCol(eventId), matchId), { flags });
}

export async function deleteMatch(eventId: string, matchId: string) {
  await deleteDoc(doc(matchesCol(eventId), matchId));
}

export async function deleteAllMatches(eventId: string) {
  const snap = await getDocs(matchesCol(eventId));
  // Firestore batch limit is 500; chunk if needed
  const chunks: typeof snap.docs[] = [];
  for (let i = 0; i < snap.docs.length; i += 490) {
    chunks.push(snap.docs.slice(i, i + 490));
  }
  await Promise.all(chunks.map((chunk) => {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    return batch.commit();
  }));
}

export async function updateMatchData(
  eventId: string,
  matchId: string,
  data: Record<string, unknown>,
  notes?: string
) {
  const up: Record<string, unknown> = { data };
  if (notes !== undefined) up.notes = notes;
  await updateDoc(doc(matchesCol(eventId), matchId), up);
}

export async function updatePitEntry(
  eventId: string,
  teamNumber: number,
  updates: Partial<Pick<PitEntry, 'status' | 'data'>>
) {
  await updateDoc(doc(pitsCol(eventId), String(teamNumber)), updates);
}

export async function resetPit(eventId: string, teamNumber: number) {
  await updateDoc(doc(pitsCol(eventId), String(teamNumber)), {
    status: 'unclaimed',
    data: deleteField(),
    scoutedBy: deleteField(),
    scoutedAt: deleteField(),
    dibbedBy: deleteField(),
    dibbedByName: deleteField(),
    dibbedAt: deleteField(),
  });
}

export async function resetAllPits(eventId: string) {
  const snap = await getDocs(pitsCol(eventId));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      status: 'unclaimed',
      data: deleteField(),
      scoutedBy: deleteField(),
      scoutedAt: deleteField(),
      dibbedBy: deleteField(),
      dibbedByName: deleteField(),
      dibbedAt: deleteField(),
    });
  });
  await batch.commit();
}

// ─── Data Quality Queries ────────────────────────────────────────────────────

export function subscribeToAllMatches(eventId: string, cb: (matches: MatchEntry[]) => void) {
  // Single-field orderBy avoids needing a composite Firestore index.
  // Secondary sort by teamNumber is done client-side in the callback.
  return subscribeToMatches(eventId, [orderBy('matchNumber')], (raw) => {
    cb([...raw].sort((a, b) => a.matchNumber - b.matchNumber || a.teamNumber - b.teamNumber));
  });
}

export function subscribeToMatchesForTeam(eventId: string, teamNumber: number, cb: (matches: MatchEntry[]) => void) {
  // Filter client-side to avoid a composite index requirement.
  return subscribeToMatches(eventId, [orderBy('matchNumber')], (raw) => {
    cb(raw.filter((m) => m.teamNumber === teamNumber));
  });
}

// ─── Station Assignments ─────────────────────────────────────────────────────

const assignmentsDoc = (eventId: string) =>
  doc(db, 'events', eventId, 'meta', 'assignments');

export function subscribeToAssignments(eventId: string, cb: (a: StationAssignments) => void) {
  return onSnapshot(assignmentsDoc(eventId), (snap) => {
    cb(snap.exists() ? (snap.data() as StationAssignments) : {});
  });
}

export async function setStationAssignment(
  eventId: string,
  station: Station,
  scout: StationAssignment | null
) {
  const ref = assignmentsDoc(eventId);
  await setDoc(ref, { [station]: scout }, { merge: true });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(usersCol());
  return snap.docs.map((d) => d.data() as AppUser);
}

export function subscribeToAllUsers(cb: (users: AppUser[]) => void) {
  return onSnapshot(usersCol(), (snap) => {
    cb(snap.docs.map((d) => d.data() as AppUser));
  });
}

export async function deleteUserAccount(uid: string) {
  await deleteDoc(doc(usersCol(), uid));
}

export async function deleteUserAccountsBatch(uids: string[]) {
  if (uids.length === 0) return;
  const batch = writeBatch(db);
  uids.forEach((uid) => batch.delete(doc(usersCol(), uid)));
  await batch.commit();
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<AppUser, 'displayName' | 'photoURL' | 'teamNumber' | 'teamKey' | 'teamName' | 'isPrimaryScout' | 'role'>>
) {
  await updateDoc(doc(usersCol(), uid), updates);
}

// ─── Generated schedule ───────────────────────────────────────────────────────

const scheduleDoc = (eventId: string) => doc(db, 'events', eventId, 'meta', 'schedule');

export function subscribeToSchedule(eventId: string, cb: (s: GeneratedSchedule | null) => void) {
  return onSnapshot(scheduleDoc(eventId), (snap) => {
    cb(snap.exists() ? (snap.data() as GeneratedSchedule) : null);
  });
}

export async function saveSchedule(eventId: string, schedule: GeneratedSchedule) {
  await setDoc(scheduleDoc(eventId), schedule);
}

export async function clearSchedule(eventId: string) {
  await deleteDoc(scheduleDoc(eventId));
}

export async function patchScheduleSlot(
  eventId: string,
  matchKey: string,
  station: Station,
  slot: import('@/types/scout').ScheduledSlot | null
) {
  const path = `assignments.${matchKey}.${station}`;
  if (slot) {
    await updateDoc(scheduleDoc(eventId), { [path]: slot });
  } else {
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(scheduleDoc(eventId), { [path]: deleteField() });
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

const notificationsCol = (uid: string) => collection(db, 'users', uid, 'notifications');

export function subscribeToNotifications(uid: string, cb: (n: ScoutNotification[]) => void) {
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ScoutNotification));
  });
}

export async function sendNotification(
  toUid: string,
  notification: Omit<ScoutNotification, 'id' | 'createdAt' | 'read'>
) {
  await setDoc(doc(notificationsCol(toUid)), {
    ...notification,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function markNotificationRead(uid: string, notifId: string) {
  await updateDoc(doc(notificationsCol(uid), notifId), { read: true });
}

export async function clearNotification(uid: string, notifId: string) {
  await deleteDoc(doc(notificationsCol(uid), notifId));
}

// ─── App-level config (shared TBA key, etc.) ─────────────────────────────────

export const appConfigDoc = () => doc(db, 'config', 'app');

export function subscribeToAppConfig(cb: (cfg: Record<string, unknown>) => void) {
  return onSnapshot(appConfigDoc(), (snap) => {
    cb(snap.exists() ? snap.data() as Record<string, unknown> : {});
  });
}

export async function setGlobalDefaults(updates: { defaultEventId?: string; defaultGameYear?: number }) {
  try {
    await updateDoc(appConfigDoc(), updates);
  } catch {
    await setDoc(appConfigDoc(), updates, { merge: true });
  }
}

// ─── All events ──────────────────────────────────────────────────────────────

export function subscribeToAllEvents(cb: (events: import('@/types/scout').EventConfig[]) => void) {
  return onSnapshot(eventsCol(), (snap) => {
    cb(snap.docs.map((d) => d.data() as import('@/types/scout').EventConfig));
  });
}

export async function updateEventConfig(
  eventId: string,
  updates: Partial<import('@/types/scout').EventConfig>
) {
  await updateDoc(doc(eventsCol(), eventId), updates);
}
