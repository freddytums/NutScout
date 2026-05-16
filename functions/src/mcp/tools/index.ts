import type { AnyMcpTool } from './types';
import { listEventsTool, getEventConfigTool } from './events';
import { queryMatchesTool, getMatchTool } from './matches';
import { listPitsTool, getPitEntryTool } from './pits';
import { getTeamSummaryTool } from './teams';
import { runDataQualityChecksTool } from './quality';
import { getScoutLeaderboardTool } from './scouts';
import { getScheduleTool, getAssignmentsTool } from './schedule';

export const allTools: AnyMcpTool[] = [
  listEventsTool,
  getEventConfigTool,
  queryMatchesTool,
  getMatchTool,
  listPitsTool,
  getPitEntryTool,
  getTeamSummaryTool,
  runDataQualityChecksTool,
  getScoutLeaderboardTool,
  getScheduleTool,
  getAssignmentsTool,
];

export const toolsByName: Record<string, AnyMcpTool> = Object.fromEntries(
  allTools.map((t) => [t.name, t])
);
