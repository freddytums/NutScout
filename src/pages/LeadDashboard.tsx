import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMatches } from '@/hooks/useMatches';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { runAllChecks } from '@/lib/dataQuality';
import type { DataIssue } from '@/lib/dataQuality';

function IssueRow({ issue }: { issue: DataIssue }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[hsl(var(--border)/0.5)] last:border-0">
      {issue.severity === 'error' ? (
        <AlertCircle size={16} className="text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-[hsl(var(--foreground))] leading-snug">{issue.message}</span>
        <Badge variant={issue.type === 'duplicate' ? 'destructive' : issue.type === 'outlier' ? 'amber' : 'muted'} className="w-fit text-[10px]">
          {issue.type}
        </Badge>
      </div>
    </div>
  );
}

export function LeadDashboard() {
  const { currentEvent } = useEventStore();
  const { matches, loading: matchLoading } = useMatches();
  const { pits, loading: pitLoading } = usePits();

  const teams = useMemo(() => {
    const assignments = currentEvent?.teamAssignments ?? {};
    return [...new Set(Object.values(assignments))].sort((a, b) => a - b);
  }, [currentEvent]);

  const issues = useMemo(() => runAllChecks(matches, teams), [matches, teams]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const pitScouted = pits.filter((p) => p.status === 'scouted').length;
  const matchCounts = useMemo(() => {
    const counts = new Map<number, number>();
    matches.forEach((m) => counts.set(m.teamNumber, (counts.get(m.teamNumber) ?? 0) + 1));
    return counts;
  }, [matches]);

  const avgMatchesPerTeam = teams.length > 0
    ? (matches.length / teams.length).toFixed(1)
    : '0';

  const loading = matchLoading || pitLoading;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-base font-semibold">Scouting Lead Dashboard</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={32} />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--accent))] font-bold">{matches.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Match entries</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{avgMatchesPerTeam} avg/team</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--accent))] font-bold">{pitScouted}/{teams.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Pits scouted</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--destructive))] font-bold">{errors.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Errors</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-amber-400 font-bold">{warnings.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Warnings</div>
              </CardContent>
            </Card>
          </div>

          {/* Issues list */}
          {issues.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Data Issues</CardTitle></CardHeader>
              <CardContent>
                {issues.slice(0, 20).map((issue, i) => (
                  <IssueRow key={i} issue={issue} />
                ))}
                {issues.length > 20 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2">
                    +{issues.length - 20} more issues
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <CheckCircle2 size={24} className="text-[hsl(var(--accent))]" />
                <span className="text-sm text-[hsl(var(--foreground))]">No data quality issues detected</span>
              </CardContent>
            </Card>
          )}

          {/* Team coverage table */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Users size={16} className="text-[hsl(var(--accent))]" />
              <CardTitle>Team Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {teams.map((team) => {
                  const count = matchCounts.get(team) ?? 0;
                  return (
                    <div
                      key={team}
                      className={`flex flex-col items-center py-2 px-1 rounded-lg border text-center ${
                        count === 0
                          ? 'border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.08)]'
                          : count >= 3
                          ? 'border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.06)]'
                          : 'border-amber-500/40 bg-amber-500/06'
                      }`}
                    >
                      <span className="font-data text-xs font-bold text-[hsl(var(--foreground))]">{team}</span>
                      <span className={`text-xs font-data mt-0.5 ${
                        count === 0 ? 'text-[hsl(var(--destructive))]' :
                        count >= 3 ? 'text-[hsl(var(--accent))]' : 'text-amber-400'
                      }`}>{count}x</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
