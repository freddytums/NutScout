import { z } from 'zod';
import { defineTool } from './types';
import { getEvent, listMatches } from '../../lib/firestore';
import { getGameConfig } from '@shared/games';
import { runAllChecks, findMissingCoverage } from '@shared/dataQuality';

export const runDataQualityChecksTool = defineTool({
  name: 'run_data_quality_checks',
  description:
    "Runs the same data-quality checks the Lead Dashboard does: duplicate match entries, statistical outliers on numeric fields (IQR method), and optionally low-coverage teams. Returns a list of issues, each with severity (error/warning), type, message, and offending team/match.",
  inputSchema: z.object({
    eventId: z.string().min(1),
    includeMissingCoverage: z
      .boolean()
      .optional()
      .describe('Include teams scouted fewer than minMatches times. Defaults to true.'),
    minMatches: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('Threshold for "missing coverage". Defaults to 3.'),
  }),
  async handler(_ctx, args) {
    const event = await getEvent(args.eventId);
    if (!event) throw new Error(`Event "${args.eventId}" not found`);
    const matches = await listMatches(args.eventId);
    const cfg = getGameConfig(event.activeGameYear);
    const fields = [...cfg.match.auto, ...cfg.match.teleop, ...cfg.match.endgame];
    const issues = runAllChecks(matches, fields);

    if (args.includeMissingCoverage !== false && event.teamAssignments) {
      const expected = [...new Set(Object.values(event.teamAssignments))];
      issues.push(...findMissingCoverage(matches, expected, args.minMatches ?? 3));
    }
    return {
      totalIssues: issues.length,
      errorCount: issues.filter((i) => i.severity === 'error').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      issues,
    };
  },
});
