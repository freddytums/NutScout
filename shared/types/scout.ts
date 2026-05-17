// Shared scout types — usable by both the browser app and Cloud Functions.
// Avoid importing from firebase/firestore here so this module stays admin/client agnostic;
// Timestamp-like fields are typed loosely so each runtime can supply its own.

export type UserRole = 'scout' | 'team-lead' | 'lead' | 'admin';

export interface TimestampLike {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isPrimaryScout?: boolean;
  teamNumber?: number;
  teamKey?: string;
  teamName?: string;
  createdAt: TimestampLike;
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
  dibbedAt?: TimestampLike;
  scoutedBy?: string;
  scoutedAt?: TimestampLike;
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
  timestamp: TimestampLike;
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
  locked?: boolean;
  hidden?: boolean;
}

export type ScheduleMethod =
  | 'fixed'
  | 'rotate-1'
  | 'rotate-2'
  | 'rotate-3'
  | 'time-block'
  | 'alt-halves'
  | 'snake';

export interface ScheduledSlot {
  uid: string;
  name: string;
  photoURL?: string;
  teamKey?: string;
}

export interface GeneratedSchedule {
  method: ScheduleMethod;
  generatedAt: TimestampLike;
  primaryScoutCount: number;
  assignments: Record<string, Partial<Record<Station, ScheduledSlot>>>;
}

export interface StationAssignment {
  uid: string;
  name: string;
  photoURL?: string;
}

export type StationAssignments = Partial<Record<Station, StationAssignment>>;

export function isAtLeastTeamLead(role: UserRole): boolean {
  return role === 'team-lead' || role === 'lead' || role === 'admin';
}

export function isAtLeastLead(role: UserRole): boolean {
  return role === 'lead' || role === 'admin';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}
