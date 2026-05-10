import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'scout' | 'team-lead' | 'lead' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isPrimaryScout?: boolean;
  teamNumber?: number;
  teamKey?: string;   // e.g. "frc254"
  teamName?: string;  // e.g. "The Cheesy Poofs"
  createdAt: Timestamp;
}

export interface ScoutNotification {
  id?: string;
  fromUid: string;
  fromName: string;
  message: string;
  matchNumber?: number;
  teamNumber?: number;
  createdAt: Timestamp;
  read: boolean;
}

export type ScheduleMethod = 'fixed' | 'rotate-1' | 'rotate-2' | 'rotate-3' | 'time-block';

export interface ScheduledSlot {
  uid: string;
  name: string;
  photoURL?: string;
  teamKey?: string;
}

export interface GeneratedSchedule {
  method: ScheduleMethod;
  generatedAt: Timestamp;
  primaryScoutCount: number;
  assignments: Record<string, Partial<Record<Station, ScheduledSlot>>>;
}

export type PitStatus = 'unclaimed' | 'dibbed' | 'scouted';

export interface PitEntry {
  teamNumber: number;
  teamName?: string;
  row: number;
  col: number;
  status: PitStatus;
  dibbedBy?: string;
  dibbedByName?: string;
  dibbedAt?: Timestamp;
  scoutedBy?: string;
  scoutedAt?: Timestamp;
  data?: Record<string, unknown>;
}

export interface MatchEntry {
  id?: string;
  teamNumber: number;
  matchNumber: number;
  matchType: 'qm' | 'qf' | 'sf' | 'f';
  alliance: 'red' | 'blue';
  alliancePosition: 1 | 2 | 3;
  scoutedBy: string;
  scoutedByName: string;
  eventKey: string;
  year: number;
  timestamp: Timestamp;
  data: Record<string, unknown>;
  flags?: {
    missingData?: boolean;
    outlier?: boolean;
    duplicate?: boolean;
    needsRescount?: boolean;
  };
  notes?: string;
}

export type Station = 'red1' | 'red2' | 'red3' | 'blue1' | 'blue2' | 'blue3';

export const STATIONS: Station[] = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

export interface StationAssignment {
  uid: string;
  name: string;
  photoURL?: string;
}

export type StationAssignments = Partial<Record<Station, StationAssignment>>;

export interface EventConfig {
  id: string;
  name: string;
  year: number;
  eventKey: string;
  pitLayout: {
    rows: number;
    cols: number;
    rowLabels?: string[];
    colLabels?: string[];
  };
  teamAssignments?: Record<string, number>;
  activeGameYear: number;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function isAtLeastTeamLead(role: UserRole): boolean {
  return role === 'team-lead' || role === 'lead' || role === 'admin';
}

export function isAtLeastLead(role: UserRole): boolean {
  return role === 'lead' || role === 'admin';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}
