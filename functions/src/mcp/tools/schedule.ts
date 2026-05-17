import { z } from 'zod';
import { defineTool } from './types';
import { getAssignments, getSchedule } from '../../lib/firestore';

export const getScheduleTool = defineTool({
  name: 'get_schedule',
  description:
    'Fetch the generated scout-rotation schedule for an event. Returns the strategy used and the per-match station assignments.',
  inputSchema: z.object({
    eventId: z.string().min(1),
  }),
  async handler(_ctx, { eventId }) {
    const schedule = await getSchedule(eventId);
    if (!schedule) return { exists: false, message: 'No schedule generated for this event yet.' };
    return { exists: true, ...schedule };
  },
});

export const getAssignmentsTool = defineTool({
  name: 'get_assignments',
  description:
    'Fetch the current static station assignments (which scout is permanently assigned to which station) for an event.',
  inputSchema: z.object({
    eventId: z.string().min(1),
  }),
  async handler(_ctx, { eventId }) {
    return await getAssignments(eventId);
  },
});
