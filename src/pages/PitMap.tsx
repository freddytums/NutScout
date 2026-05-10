import { useState } from 'react';
import { X, CheckCircle2, Hand, ClipboardList, Loader2 } from 'lucide-react';
import { PitCell } from '@/components/pit-map/PitCell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePits } from '@/hooks/usePits';
import { useAuth } from '@/hooks/useAuth';
import { useEventStore } from '@/store/eventStore';
import { useNavigate } from 'react-router-dom';
import type { PitEntry } from '@/types/scout';

export function PitMap() {
  const { currentEvent } = useEventStore();
  const { pits, pitMap, loading, claim, unclaim } = usePits();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PitEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!user) return null;

  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <p className="text-[hsl(var(--muted-foreground))]">No event selected.</p>
        <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
      </div>
    );
  }

  const { rows, cols, rowLabels, colLabels } = currentEvent.pitLayout;
  const teams = currentEvent.teamAssignments ?? {};

  // Build grid cells
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const key = `${r}-${c}`;
      const teamNumber = teams[key];
      const pit = teamNumber ? pitMap.get(teamNumber) : undefined;
      return { r, c, key, teamNumber, pit };
    })
  );

  // Summary stats
  const total = pits.length;
  const scouted = pits.filter((p) => p.status === 'scouted').length;
  const dibbed = pits.filter((p) => p.status === 'dibbed').length;

  async function handleClaim() {
    if (!selected?.teamNumber) return;
    setActionLoading(true);
    try {
      await claim(selected.teamNumber);
      setSelected((prev) => prev ? { ...prev, status: 'dibbed', dibbedBy: user!.uid, dibbedByName: user!.displayName } : null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnclaim() {
    if (!selected?.teamNumber) return;
    setActionLoading(true);
    try {
      await unclaim(selected.teamNumber);
      setSelected((prev) => prev ? { ...prev, status: 'unclaimed', dibbedBy: undefined } : null);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Pit Map</h2>
        <div className="flex gap-2">
          <Badge variant="default">{scouted}/{total} done</Badge>
          {dibbed > 0 && <Badge variant="amber">{dibbed} claimed</Badge>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[hsl(var(--muted))] border border-[hsl(var(--border))]" />Unclaimed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/60" />Claimed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.6)]" />Scouted</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={32} />
        </div>
      ) : (
        <>
          {/* Column labels */}
          {colLabels && (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {colLabels.map((label) => (
                <div key={label} className="text-center text-xs text-[hsl(var(--muted-foreground))] font-medium">
                  {label}
                </div>
              ))}
            </div>
          )}

          {/* Pit grid */}
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-1.5 min-w-max">
              {cells.map((row, r) => (
                <div key={r} className="flex items-center gap-1.5">
                  {rowLabels && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] font-medium w-6 text-right shrink-0">
                      {rowLabels[r]}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {row.map(({ key, teamNumber, pit }) =>
                      teamNumber ? (
                        <div key={key} style={{ width: 64 }}>
                          <PitCell
                            pit={pit}
                            teamNumber={teamNumber}
                            row={r}
                            col={parseInt(key.split('-')[1])}
                            currentUser={user}
                            onClick={() =>
                              setSelected(pit ?? {
                                teamNumber,
                                row: r,
                                col: parseInt(key.split('-')[1]),
                                status: 'unclaimed',
                              })
                            }
                          />
                        </div>
                      ) : (
                        <div key={key} style={{ width: 64 }} className="h-[60px] rounded-lg border border-dashed border-[hsl(var(--border)/0.3)]" />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Pit detail panel */}
      {selected && (
        <Card className="border-[hsl(var(--accent)/0.3)]">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Team {selected.teamNumber}</CardTitle>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  selected.status === 'scouted' ? 'default' :
                  selected.status === 'dibbed' ? 'amber' : 'muted'
                }
              >
                {selected.status === 'scouted' ? 'Scouted' :
                 selected.status === 'dibbed' ? `Claimed by ${selected.dibbedByName ?? 'someone'}` :
                 'Unclaimed'}
              </Badge>
            </div>

            <div className="flex gap-2">
              {selected.status === 'unclaimed' && (
                <Button
                  onClick={handleClaim}
                  loading={actionLoading}
                  className="flex-1 gap-2"
                  size="sm"
                >
                  <Hand size={14} /> Call Dibs
                </Button>
              )}
              {selected.status === 'dibbed' && selected.dibbedBy === user.uid && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleUnclaim}
                    loading={actionLoading}
                    size="sm"
                    className="flex-1"
                  >
                    Release
                  </Button>
                  <Button
                    onClick={() => navigate(`/pit?team=${selected.teamNumber}`)}
                    size="sm"
                    className="flex-1 gap-2"
                  >
                    <ClipboardList size={14} /> Scout Now
                  </Button>
                </>
              )}
              {selected.status === 'scouted' && (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--accent))]">
                  <CheckCircle2 size={16} />
                  Pit scouting complete
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
