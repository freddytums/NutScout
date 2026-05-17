import { z } from 'zod';
import { defineTool } from './types';
import { getMatch, listMatches } from '../../lib/firestore';

const filterShape = {
  eventId: z.string().min(1).describe('Event id from list_events.'),
  teamNumber: z.number().int().positive().optional().describe('Filter to one team.'),
  matchNumber: z.number().int().positive().optional().describe('Filter to one match number (e.g. 14 for Q14).'),
  matchType: z.enum(['qm', 'qf', 'sf', 'f']).optional().describe('qm=qualification, qf/sf/f=playoffs.'),
  alliance: z.enum(['red', 'blue']).optional(),
  scoutedBy: z.string().optional().describe('Filter to a specific scout uid.'),
  limit: z.number().int().min(1).max(500).optional().describe('Max results (default 100).'),
};

export const queryMatchesTool = defineTool({
  name: 'query_matches',
  description:
    'Return individual match scouting entries with optional filters. Each entry has the raw `data` object whose keys come from the game config for that year. Default cap is 100 — narrow with filters for richer answers.',
  inputSchema: z.object(filterShape),
  async handler(_ctx, args) {
    const all = await listMatches(args.eventId);
    const filtered = all.filter((m) => {
      if (args.teamNumber !== undefined && m.teamNumber !== args.teamNumber) return false;
      if (args.matchNumber !== undefined && m.matchNumber !== args.matchNumber) return false;
      if (args.matchType && m.matchType !== args.matchType) return false;
      if (args.alliance && m.alliance !== args.alliance) return false;
      if (args.scoutedBy && m.scoutedBy !== args.scoutedBy) return false;
      return true;
    });
    const limit = args.limit ?? 100;
    return {
      total: filtered.length,
      returned: Math.min(filtered.length, limit),
      entries: filtered
        .sort((a, b) => a.matchNumber - b.matchNumber || a.teamNumber - b.teamNumber)
        .slice(0, limit),
    };
  },
});

export const getMatchTool = defineTool({
  name: 'get_match',
  description: 'Fetch a single match scouting entry by its Firestore document id.',
  inputSchema: z.object({
    eventId: z.string().min(1),
    matchId: z.string().min(1).describe('Firestore document id, not the match number.'),
  }),
  async handler(_ctx, { eventId, matchId }) {
    const match = await getMatch(eventId, matchId);
    if (!match) throw new Error(`Match "${matchId}" not found in event "${eventId}"`);
    return match;
  },
});
