import { z } from 'zod';
import { defineTool } from './types';
import { getEvent, listMatches } from '../../lib/firestore';
import { getGameConfig } from '@shared/games';
import type { GameField } from '@shared/types/game';
import type { MatchEntry } from '@shared/types/scout';

function aggregateNumeric(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    mean: +(sum / values.length).toFixed(2),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

function summarize(matches: MatchEntry[], fields: GameField[]) {
  const out: Record<string, ReturnType<typeof aggregateNumeric> | Record<string, number>> = {};
  for (const f of fields) {
    if (f.type === 'counter' || f.type === 'rating') {
      const values = matches
        .map((m) => m.data[f.id])
        .filter((v): v is number => typeof v === 'number');
      out[f.id] = aggregateNumeric(values);
    } else if (f.type === 'toggle') {
      const trueCount = matches.filter((m) => m.data[f.id] === true).length;
      out[f.id] = { trueCount, falseCount: matches.length - trueCount };
    } else if (f.type === 'select' && f.options) {
      const counts: Record<string, number> = {};
      for (const opt of f.options) counts[opt] = 0;
      matches.forEach((m) => {
        const v = m.data[f.id];
        if (typeof v === 'string' && v in counts) counts[v]++;
      });
      out[f.id] = counts;
    }
  }
  return out;
}

export const getTeamSummaryTool = defineTool({
  name: 'get_team_summary',
  description:
    "Aggregate stats for one team across all their match entries at an event: per-field mean/min/max/median for numeric fields, true/false counts for toggles, and option distributions for selects. Use this to compare teams or answer 'how does team X perform?'.",
  inputSchema: z.object({
    eventId: z.string().min(1),
    teamNumber: z.number().int().positive(),
  }),
  async handler(_ctx, { eventId, teamNumber }) {
    const event = await getEvent(eventId);
    if (!event) throw new Error(`Event "${eventId}" not found`);
    const all = await listMatches(eventId);
    const teamMatches = all.filter((m) => m.teamNumber === teamNumber);
    if (teamMatches.length === 0) {
      return { teamNumber, matchCount: 0, message: 'No scouting entries yet for this team.' };
    }
    const cfg = getGameConfig(event.activeGameYear);
    const fields = [...cfg.match.auto, ...cfg.match.teleop, ...cfg.match.endgame];
    return {
      teamNumber,
      matchCount: teamMatches.length,
      matchesScouted: teamMatches.map((m) => ({
        matchNumber: m.matchNumber,
        alliance: m.alliance,
        flagged: !!(m.flags?.needsRescount || m.flags?.outlier || m.flags?.duplicate),
      })),
      stats: summarize(teamMatches, fields),
    };
  },
});
