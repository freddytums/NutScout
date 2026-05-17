import { z } from 'zod';
import { defineTool } from './types';
import { listEvents, getEvent } from '../../lib/firestore';

export const listEventsTool = defineTool({
  name: 'list_events',
  description:
    'List all scouting events visible to the user. Returns one summary line per event with id, name, year, and event key. Use this first to find the eventId you need for other tools.',
  inputSchema: z.object({
    includeHidden: z
      .boolean()
      .optional()
      .describe('When true, include archived/hidden events. Defaults to false.'),
  }),
  async handler(_ctx, args) {
    const events = await listEvents({ includeHidden: args.includeHidden });
    return events.map((e) => ({
      id: e.id,
      name: e.name,
      year: e.year,
      eventKey: e.eventKey,
      activeGameYear: e.activeGameYear,
      locked: !!e.locked,
      hidden: !!e.hidden,
    }));
  },
});

export const getEventConfigTool = defineTool({
  name: 'get_event_config',
  description:
    'Fetch the full configuration for one event: pit layout dimensions, team-to-cell assignments, and the active game year (which determines which scouting fields are collected).',
  inputSchema: z.object({
    eventId: z.string().min(1).describe('The event id (e.g. "2026_ohcl"). From list_events.'),
  }),
  async handler(_ctx, { eventId }) {
    const event = await getEvent(eventId);
    if (!event) throw new Error(`Event "${eventId}" not found`);
    const teams = event.teamAssignments
      ? [...new Set(Object.values(event.teamAssignments))].sort((a, b) => a - b)
      : [];
    return {
      ...event,
      teamCount: teams.length,
      teamsAtEvent: teams,
    };
  },
});
