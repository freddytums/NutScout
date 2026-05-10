import { useAppConfigStore } from '@/store/appConfigStore';

const BASE = 'https://www.thebluealliance.com/api/v3';

function apiKey(): string {
  // Shared key from Firestore (synced into Zustand store), fall back to env var
  return useAppConfigStore.getState().config.tbaKey
    || (import.meta.env.VITE_TBA_API_KEY ?? '');
}

async function tbaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-TBA-Auth-Key': apiKey() },
  });
  if (res.status === 401) {
    // Mark key stale — lazy import avoids circular deps
    import('@/hooks/useAppConfig').then(({ markTbaKeyStale }) => markTbaKeyStale());
    throw new Error('TBA key is stale — contact your scouting lead to update it');
  }
  if (res.status === 404) throw new Error(`Not found: ${path}`);
  if (!res.ok) throw new Error(`TBA error ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TBAEvent {
  key: string;
  name: string;
  short_name: string | null;
  event_code: string;
  year: number;
  start_date: string;
  end_date: string;
  location_name: string;
  city: string;
  state_prov: string;
  country: string;
}

export interface TBATeam {
  key: string;       // "frc254"
  team_number: number;
  nickname: string;
  name: string;
  city: string | null;
  state_prov: string | null;
}

export interface TBAAlliance {
  team_keys: string[];  // ["frc254", "frc1678", "frc4414"]
  score: number;
  dq_team_keys: string[];
  surrogate_team_keys: string[];
}

export interface TBAMatch {
  key: string;         // "2026casd_qm1"
  comp_level: 'qm' | 'ef' | 'qf' | 'sf' | 'f';
  set_number: number;
  match_number: number;
  alliances: {
    red: TBAAlliance;
    blue: TBAAlliance;
  };
  time: number | null;           // unix timestamp (scheduled)
  predicted_time: number | null;
  actual_time: number | null;
  post_result_time: number | null;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export function getEvent(eventKey: string) {
  return tbaFetch<TBAEvent>(`/event/${eventKey}`);
}

export function getEventTeams(eventKey: string) {
  return tbaFetch<TBATeam[]>(`/event/${eventKey}/teams`);
}

export function getEventMatches(eventKey: string) {
  return tbaFetch<TBAMatch[]>(`/event/${eventKey}/matches`);
}

export function getTeam(teamNumber: number) {
  return tbaFetch<TBATeam>(`/team/frc${teamNumber}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function teamNumberFromKey(key: string): number {
  return parseInt(key.replace('frc', ''));
}

/** Given N teams, find a pit grid layout with roughly 2:1 col:row ratio */
export function calcGridDimensions(count: number): { rows: number; cols: number } {
  // Try common FRC pit widths first
  for (const cols of [10, 9, 8, 7, 6, 5]) {
    const rows = Math.ceil(count / cols);
    if (rows * cols >= count) return { rows, cols };
  }
  return { rows: Math.ceil(count / 5), cols: 5 };
}

/** Sort matches by scheduled time, then by match number */
export function sortMatches(matches: TBAMatch[]): TBAMatch[] {
  return [...matches].sort((a, b) => {
    const timeA = a.predicted_time ?? a.time ?? 0;
    const timeB = b.predicted_time ?? b.time ?? 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.match_number - b.match_number;
  });
}

/** Find which alliance and position a team is in for a given match */
export function findTeamSlot(
  match: TBAMatch,
  teamNumber: number
): { alliance: 'red' | 'blue'; position: 1 | 2 | 3 } | null {
  const key = `frc${teamNumber}`;
  for (const alliance of ['red', 'blue'] as const) {
    const idx = match.alliances[alliance].team_keys.indexOf(key);
    if (idx !== -1) return { alliance, position: (idx + 1) as 1 | 2 | 3 };
  }
  return null;
}

/** Comp level display label */
export function matchLabel(match: TBAMatch): string {
  const level = { qm: 'Q', qf: 'QF', sf: 'SF', f: 'F', ef: 'EF' }[match.comp_level] ?? match.comp_level.toUpperCase();
  if (match.comp_level === 'qm') return `Q${match.match_number}`;
  return `${level}${match.set_number}M${match.match_number}`;
}
