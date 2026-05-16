import type { MatchEntry } from './types/scout';
import type { GameField } from './types/game';

export interface DataIssue {
  type: 'missing' | 'outlier' | 'incomplete' | 'duplicate';
  severity: 'error' | 'warning';
  teamNumber?: number;
  matchNumber?: number;
  matchId?: string;
  duplicateMatchId?: string;
  field?: string;
  message: string;
  value?: number;
  expected?: string;
}

export function findDuplicates(matches: MatchEntry[]): DataIssue[] {
  const seen = new Map<string, string>();
  const issues: DataIssue[] = [];
  matches.forEach((m) => {
    const key = `${m.teamNumber}-${m.matchNumber}-${m.alliance}-${m.alliancePosition}`;
    const existingId = seen.get(key);
    if (existingId !== undefined) {
      issues.push({
        type: 'duplicate',
        severity: 'error',
        teamNumber: m.teamNumber,
        matchNumber: m.matchNumber,
        matchId: m.id,
        duplicateMatchId: existingId,
        message: `Duplicate: Team ${m.teamNumber} Q${m.matchNumber} ${m.alliance === 'red' ? 'R' : 'B'}${m.alliancePosition} has 2 entries`,
      });
    } else {
      seen.set(key, m.id ?? '');
    }
  });
  return issues;
}

export function findOutliers(
  matches: MatchEntry[],
  fieldId: string,
  label: string
): DataIssue[] {
  const values = matches
    .map((m) => ({ id: m.id!, team: m.teamNumber, match: m.matchNumber, val: m.data[fieldId] as number }))
    .filter((v) => typeof v.val === 'number');

  if (values.length < 4) return [];

  const sorted = [...values].sort((a, b) => a.val - b.val);
  const q1 = sorted[Math.floor(sorted.length * 0.25)].val;
  const q3 = sorted[Math.floor(sorted.length * 0.75)].val;
  const iqr = q3 - q1;

  if (iqr === 0) return [];

  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;

  return values
    .filter((v) => v.val < low || v.val > high)
    .map((v) => ({
      type: 'outlier' as const,
      severity: 'warning' as const,
      teamNumber: v.team,
      matchNumber: v.match,
      matchId: v.id,
      field: fieldId,
      value: v.val,
      expected: `${q1.toFixed(1)}–${q3.toFixed(1)}`,
      message: `Team ${v.team} Q${v.match}: ${label} = ${v.val} (outlier, typical ${q1.toFixed(0)}–${q3.toFixed(0)})`,
    }));
}

export function findMissingCoverage(
  matches: MatchEntry[],
  expectedTeams: number[],
  minMatches = 3
): DataIssue[] {
  const countByTeam = new Map<number, number>();
  matches.forEach((m) => {
    countByTeam.set(m.teamNumber, (countByTeam.get(m.teamNumber) ?? 0) + 1);
  });

  return expectedTeams
    .filter((team) => (countByTeam.get(team) ?? 0) < minMatches)
    .map((team) => ({
      type: 'missing' as const,
      severity: (countByTeam.get(team) ?? 0) === 0 ? ('error' as const) : ('warning' as const),
      teamNumber: team,
      message: `Team ${team} has only ${countByTeam.get(team) ?? 0}/${minMatches} matches scouted`,
    }));
}

export function runAllChecks(matches: MatchEntry[], fields: GameField[]): DataIssue[] {
  const numericFields = fields.filter((f) => f.type === 'counter' || f.type === 'rating');
  const issues: DataIssue[] = [
    ...findDuplicates(matches),
    ...numericFields.flatMap((f) => findOutliers(matches, f.id, f.label)),
  ];
  return issues.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}
