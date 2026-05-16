import { z } from 'zod';
import { defineTool } from './types';
import { listMatches } from '../../lib/firestore';

export const getScoutLeaderboardTool = defineTool({
  name: 'get_scout_leaderboard',
  description:
    "Per-scout submission stats for an event: how many match entries each scout has submitted, and what fraction were flagged. Useful for answering 'who's pulling their weight?'.",
  inputSchema: z.object({
    eventId: z.string().min(1),
  }),
  async handler(_ctx, { eventId }) {
    const matches = await listMatches(eventId);
    const byScout = new Map<string, { name: string; count: number; flagged: number; lastMatch: number }>();
    for (const m of matches) {
      const entry = byScout.get(m.scoutedBy);
      const flagged = !!(m.flags?.needsRescount || m.flags?.outlier || m.flags?.duplicate);
      if (entry) {
        entry.count += 1;
        if (flagged) entry.flagged += 1;
        if (m.matchNumber > entry.lastMatch) entry.lastMatch = m.matchNumber;
      } else {
        byScout.set(m.scoutedBy, {
          name: m.scoutedByName,
          count: 1,
          flagged: flagged ? 1 : 0,
          lastMatch: m.matchNumber,
        });
      }
    }
    return [...byScout.entries()]
      .map(([uid, v]) => ({ uid, ...v }))
      .sort((a, b) => b.count - a.count);
  },
});
