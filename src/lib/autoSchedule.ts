import type { AppUser, Station, ScheduleMethod, GeneratedSchedule, ScheduledSlot } from '@/types/scout';
import type { TBAMatch } from '@/lib/tba';
import { STATIONS } from '@/types/scout';
import { sortMatches } from '@/lib/tba';
import { Timestamp } from 'firebase/firestore';

export type SortOrder = 'alpha' | 'experience';

function toSlot(u: AppUser): ScheduledSlot {
  return { uid: u.uid, name: u.displayName, photoURL: u.photoURL };
}

/** Sort scouts by chosen order */
function sortScouts(scouts: AppUser[], order: SortOrder, matchCounts: Map<string, number>): AppUser[] {
  return [...scouts].sort((a, b) => {
    if (order === 'experience') {
      return (matchCounts.get(b.uid) ?? 0) - (matchCounts.get(a.uid) ?? 0);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

/** Split scouts into groups of up to 6, each group filling a full set of stations */
function buildTeams(scouts: AppUser[]): AppUser[][] {
  const teams: AppUser[][] = [];
  for (let i = 0; i < scouts.length; i += 6) {
    teams.push(scouts.slice(i, i + 6));
  }
  return teams.length > 0 ? teams : [[]];
}

/** Assign stations to a team of up to 6 scouts */
function stationMap(team: AppUser[]): Partial<Record<Station, ScheduledSlot>> {
  const result: Partial<Record<Station, ScheduledSlot>> = {};
  team.forEach((scout, i) => {
    if (i < STATIONS.length) result[STATIONS[i]] = toSlot(scout);
  });
  return result;
}

/** Group matches into ~blockMinutes windows by predicted/scheduled time */
function groupByTimeBlock(matches: TBAMatch[], blockMinutes = 30): TBAMatch[][] {
  if (matches.length === 0) return [];
  const sorted = sortMatches(matches);
  const blocks: TBAMatch[][] = [];
  let blockStart = sorted[0].predicted_time ?? sorted[0].time ?? 0;
  let current: TBAMatch[] = [];

  for (const m of sorted) {
    const t = m.predicted_time ?? m.time ?? blockStart;
    if (t - blockStart > blockMinutes * 60 && current.length > 0) {
      blocks.push(current);
      current = [];
      blockStart = t;
    }
    current.push(m);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

export interface ScheduleOptions {
  method: ScheduleMethod;
  sortOrder: SortOrder;
  matchCounts?: Map<string, number>;
  fillGaps?: boolean;
}

export function generateSchedule(
  qualMatches: TBAMatch[],
  primaryScouts: AppUser[],
  options: ScheduleOptions
): GeneratedSchedule {
  const { method, sortOrder, matchCounts = new Map() } = options;
  const sorted = sortScouts(primaryScouts, sortOrder, matchCounts);
  const teams = buildTeams(sorted);
  const qualOnly = sortMatches(qualMatches.filter((m) => m.comp_level === 'qm'));
  const assignments: GeneratedSchedule['assignments'] = {};

  const rotateN = method === 'fixed' ? 0
    : method === 'rotate-1' ? 1
    : method === 'rotate-2' ? 2
    : method === 'rotate-3' ? 3
    : 0; // time-block handled separately

  if (method === 'fixed' || teams.length === 1) {
    const map = stationMap(teams[0]);
    qualOnly.forEach((m) => { assignments[m.key] = map; });

  } else if (method.startsWith('rotate')) {
    qualOnly.forEach((m, idx) => {
      const teamIdx = Math.floor(idx / rotateN) % teams.length;
      assignments[m.key] = stationMap(teams[teamIdx]);
    });

  } else if (method === 'time-block') {
    const hasTime = qualOnly.some((m) => m.predicted_time ?? m.time);
    if (!hasTime) {
      qualOnly.forEach((m, idx) => {
        assignments[m.key] = stationMap(teams[Math.floor(idx / 3) % teams.length]);
      });
    } else {
      const blocks = groupByTimeBlock(qualOnly, 30);
      blocks.forEach((block, idx) => {
        const teamIdx = idx % teams.length;
        block.forEach((m) => { assignments[m.key] = stationMap(teams[teamIdx]); });
      });
    }

  } else if (method === 'alt-halves') {
    // Split quals into two halves — different scout group per half.
    // Great for events where you bring a morning crew and afternoon crew.
    const mid = Math.ceil(qualOnly.length / 2);
    qualOnly.forEach((m, idx) => {
      const teamIdx = idx < mid ? 0 : 1 % teams.length;
      assignments[m.key] = stationMap(teams[teamIdx]);
    });

  } else if (method === 'snake') {
    // Scouts cycle through groups in a snake pattern: A B C … C B A A B C …
    // Gives each scout a variety of match blocks without hard restarts.
    const forward = teams.map((_, i) => i);
    const backward = [...forward].reverse();
    const snake = [...forward, ...backward.slice(1, -1)]; // no duplicate endpoints
    qualOnly.forEach((m, idx) => {
      assignments[m.key] = stationMap(teams[snake[idx % snake.length]]);
    });
  }

  // Fill any unassigned stations fairly (round-robin by fewest current assignments,
  // skipping scouts already used in that match).
  if (options.fillGaps && sorted.length > 0) {
    const fillCounts = new Map<string, number>(sorted.map((s) => [s.uid, 0]));
    for (const slots of Object.values(assignments))
      for (const slot of Object.values(slots))
        if (slot) fillCounts.set(slot.uid, (fillCounts.get(slot.uid) ?? 0) + 1);

    for (const matchKey of Object.keys(assignments)) {
      const inMatch = new Set(
        Object.values(assignments[matchKey]).filter(Boolean).map((s) => s!.uid)
      );
      for (const station of STATIONS) {
        if (assignments[matchKey][station]) continue;
        const pick = [...sorted]
          .filter((s) => !inMatch.has(s.uid))
          .sort((a, b) => (fillCounts.get(a.uid) ?? 0) - (fillCounts.get(b.uid) ?? 0))[0];
        if (!pick) continue;
        assignments[matchKey][station] = toSlot(pick);
        fillCounts.set(pick.uid, (fillCounts.get(pick.uid) ?? 0) + 1);
        inMatch.add(pick.uid);
      }
    }
  }

  return {
    method,
    generatedAt: Timestamp.now(),
    primaryScoutCount: primaryScouts.length,
    assignments,
  };
}

/** Summary stats for a generated schedule */
export function scheduleStats(schedule: GeneratedSchedule) {
  const allSlots = Object.values(schedule.assignments).flatMap((m) => Object.values(m));
  const byUid = new Map<string, number>();
  allSlots.forEach((s) => {
    if (s) byUid.set(s.uid, (byUid.get(s.uid) ?? 0) + 1);
  });
  return { totalMatches: Object.keys(schedule.assignments).length, byScout: byUid };
}
