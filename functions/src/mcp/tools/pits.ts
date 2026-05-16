import { z } from 'zod';
import { defineTool } from './types';
import { getPit, listPits } from '../../lib/firestore';

export const listPitsTool = defineTool({
  name: 'list_pits',
  description:
    'List every pit slot for an event with status (unclaimed | dibbed | scouted) and assigned team number. Useful for coverage questions like "which pits are unscouted?".',
  inputSchema: z.object({
    eventId: z.string().min(1),
    status: z
      .enum(['unclaimed', 'dibbed', 'scouted'])
      .optional()
      .describe('Filter to pits in this status.'),
  }),
  async handler(_ctx, args) {
    const pits = await listPits(args.eventId);
    const filtered = args.status ? pits.filter((p) => p.status === args.status) : pits;
    return {
      total: pits.length,
      returned: filtered.length,
      countsByStatus: {
        unclaimed: pits.filter((p) => p.status === 'unclaimed').length,
        dibbed: pits.filter((p) => p.status === 'dibbed').length,
        scouted: pits.filter((p) => p.status === 'scouted').length,
      },
      pits: filtered.map((p) => ({
        teamNumber: p.teamNumber,
        teamName: p.teamName,
        row: p.row,
        col: p.col,
        status: p.status,
        dibbedByName: p.dibbedByName,
        scoutedBy: p.scoutedBy,
      })),
    };
  },
});

export const getPitEntryTool = defineTool({
  name: 'get_pit_entry',
  description:
    'Get the full pit scouting record for one team — including the answers a scout submitted (robot dimensions, drivetrain, capabilities, etc.).',
  inputSchema: z.object({
    eventId: z.string().min(1),
    teamNumber: z.number().int().positive(),
  }),
  async handler(_ctx, { eventId, teamNumber }) {
    const pit = await getPit(eventId, teamNumber);
    if (!pit) throw new Error(`No pit entry for team ${teamNumber} at event "${eventId}"`);
    return pit;
  },
});
