// Server-side Firestore reads used by the MCP tools. Each function is a
// thin wrapper around firebase-admin's Firestore client that mirrors the
// client-side collection layout in src/lib/firestore.ts so both sides agree
// on document shapes. All operations are READ-only — writes happen from the
// client via Firebase Auth + security rules.

import { db } from './admin';
import type {
  EventConfig,
  GeneratedSchedule,
  MatchEntry,
  PitEntry,
  StationAssignments,
} from '@shared/types/scout';

// ─── Events ────────────────────────────────────────────────────────────────

export async function listEvents(opts: { includeHidden?: boolean } = {}): Promise<EventConfig[]> {
  const snap = await db.collection('events').get();
  const all = snap.docs.map((d) => d.data() as EventConfig);
  return opts.includeHidden ? all : all.filter((e) => !e.hidden);
}

export async function getEvent(eventId: string): Promise<EventConfig | null> {
  const snap = await db.collection('events').doc(eventId).get();
  return snap.exists ? (snap.data() as EventConfig) : null;
}

// ─── Matches ───────────────────────────────────────────────────────────────

export async function listMatches(eventId: string): Promise<MatchEntry[]> {
  const snap = await db.collection('events').doc(eventId).collection('matches').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchEntry));
}

export async function getMatch(eventId: string, matchId: string): Promise<MatchEntry | null> {
  const snap = await db.collection('events').doc(eventId).collection('matches').doc(matchId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as MatchEntry;
}

// ─── Pits ──────────────────────────────────────────────────────────────────

export async function listPits(eventId: string): Promise<PitEntry[]> {
  const snap = await db.collection('events').doc(eventId).collection('pits').get();
  return snap.docs.map((d) => d.data() as PitEntry);
}

export async function getPit(eventId: string, teamNumber: number): Promise<PitEntry | null> {
  const snap = await db
    .collection('events').doc(eventId)
    .collection('pits').doc(String(teamNumber))
    .get();
  return snap.exists ? (snap.data() as PitEntry) : null;
}

// ─── Meta (schedule + station assignments) ─────────────────────────────────

export async function getSchedule(eventId: string): Promise<GeneratedSchedule | null> {
  const snap = await db
    .collection('events').doc(eventId)
    .collection('meta').doc('schedule')
    .get();
  return snap.exists ? (snap.data() as GeneratedSchedule) : null;
}

export async function getAssignments(eventId: string): Promise<StationAssignments> {
  const snap = await db
    .collection('events').doc(eventId)
    .collection('meta').doc('assignments')
    .get();
  return snap.exists ? (snap.data() as StationAssignments) : {};
}
