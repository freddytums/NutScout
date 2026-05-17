import { useState, useEffect } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { X, CheckCircle2, Hand, ClipboardList, Loader2, UserPlus } from 'lucide-react';
import { PitCell } from '@/components/pit-map/PitCell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePits } from '@/hooks/usePits';
import { useAuth } from '@/hooks/useAuth';
import { useEventStore } from '@/store/eventStore';
import { subscribeToAllUsers } from '@/lib/firestore';
import { isAtLeastLead } from '@/types/scout';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PitEntry, AppUser } from '@/types/scout';
import { NutronsBounce } from '@/components/CelebrationOverlay';

const BEAMS = [
  { color: '#DC2626', left: '6%',  dur: 1.3, delay: '0s'    },
  { color: '#FFFFFF', left: '18%', dur: 1.7, delay: '0.28s' },
  { color: '#DC2626', left: '33%', dur: 1.4, delay: '0.12s' },
  { color: '#FFFFFF', left: '50%', dur: 1.6, delay: '0.45s' },
  { color: '#DC2626', left: '66%', dur: 1.5, delay: '0.07s' },
  { color: '#FFFFFF', left: '80%', dur: 1.8, delay: '0.35s' },
  { color: '#DC2626', left: '92%', dur: 1.3, delay: '0.55s' },
];

const BALLS = [
  { left: '12%', size: 32, dur: 2.8, rev: false },
  { left: '48%', size: 40, dur: 3.4, rev: true  },
  { left: '84%', size: 30, dur: 3.0, rev: false },
];

function DiscoOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden>

      {/* Red/white light beams from top */}
      {BEAMS.map((b, i) => (
        <div
          key={i}
          className="absolute top-0 w-10"
          style={{
            left: b.left,
            height: '55%',
            background: `linear-gradient(180deg, ${b.color}88 0%, transparent 100%)`,
            filter: 'blur(10px)',
            animation: `disco-beam ${b.dur}s ${b.delay} ease-in-out infinite`,
          }}
        />
      ))}

      {/* Hanging disco balls */}
      {BALLS.map((b, i) => (
        <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: b.left }}>
          <div
            className="w-px"
            style={{
              height: 36 + i * 14,
              background: 'hsl(var(--muted-foreground)/0.35)',
              transformOrigin: 'top center',
              animation: `disco-ball-spin ${b.dur + 1}s ease-in-out infinite${b.rev ? ' reverse' : ''}`,
            }}
          />
          <span style={{
            fontSize: b.size,
            display: 'inline-block',
            animation: `disco-ball-spin ${b.dur}s linear infinite${b.rev ? ' reverse' : ''}`,
          }}>🪩</span>
        </div>
      ))}

      {/* "Pit Scouting Done!" banner */}
      <div className="absolute left-1/2 -translate-x-1/2 top-16 flex flex-col items-center">
        <div
          className="px-5 py-2 rounded-xl border-2 font-data font-bold tracking-widest text-sm text-center whitespace-nowrap"
          style={{
            borderColor: '#DC2626',
            background: 'rgba(0,0,0,0.75)',
            animation: 'disco-shimmer 2s linear infinite',
            backdropFilter: 'blur(4px)',
          }}
        >
          🎉 PIT SCOUTING DONE! 🎉
        </div>
      </div>

      {/* Nutrons logos bouncing in zero gravity */}
      <NutronsBounce />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PitMap() {
  const { currentEvent } = useEventStore();
  const { pits, pitMap, loading, claim, unclaim, assignPit } = usePits();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PitEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [scouts, setScouts] = useState<AppUser[]>([]);

  // Load scout list when the assign picker is opened (lead/admin only)
  useEffect(() => {
    if (!assignPickerOpen) return;
    const unsub = subscribeToAllUsers((users) => {
      setScouts(users.filter((u) => u.uid !== user?.uid));
    });
    return unsub;
  }, [assignPickerOpen, user?.uid]);

  // Close assign picker whenever the selected pit changes
  useEffect(() => {
    setAssignPickerOpen(false);
  }, [selected?.teamNumber]);

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
  const isLead = isAtLeastLead(user.role);

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
  const allDone = total > 0 && scouted === total;

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

  async function handleAssign(target: AppUser) {
    if (!selected?.teamNumber) return;
    setAssignLoading(true);
    try {
      await assignPit(selected.teamNumber, target.uid, target.displayName);
      setSelected((prev) => prev ? { ...prev, status: 'dibbed', dibbedBy: target.uid, dibbedByName: target.displayName } : null);
      setAssignPickerOpen(false);
    } finally {
      setAssignLoading(false);
    }
  }

  const isMyDib = selected?.dibbedBy === user.uid;
  const canRelease = selected?.status === 'dibbed' && (isMyDib || isLead);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Pit Map</h2>
          <HelpButton content={{
            title: 'Pit Map',
            description: 'A visual grid of the pit area. Coordinate with your team so every robot gets scouted exactly once.',
            steps: [
              { heading: 'Find a team', detail: 'Each cell shows a team number at their pit location. Tap a cell to see details.' },
              { heading: 'Dib a pit', detail: 'Tap "Claim" to dib the pit — other scouts will see it\'s taken so nobody doubles up.' },
              { heading: 'Scout it', detail: 'Visit the robot and collect data in Pit Scouting, then mark the pit done.' },
              { heading: 'Color legend', detail: 'Green = scouted ✓  ·  Amber = dibbed (claimed)  ·  Dark = unclaimed.' },
            ],
            tip: 'You can only unclaim a pit you dibbed yourself. Leads can reassign from the dashboard.',
          }} />
        </div>
        <div className="flex items-center gap-2">
          <AskAiButton
            prompt={`Which pits at event ${currentEvent.id} are still unscouted? List team numbers and grid locations.`}
          />
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

      {/* My pits quick list */}
      {(() => {
        const myPits = pits.filter(
          (p) => p.dibbedBy === user.uid || p.scoutedBy === user.uid
        );
        if (myPits.length === 0) return null;
        const rowLabels = currentEvent.pitLayout.rowLabels;
        const colLabels = currentEvent.pitLayout.colLabels;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">My Pits ({myPits.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[hsl(var(--border)/0.5)]">
              {myPits.map((p) => {
                const row = rowLabels?.[p.row] ?? `R${p.row + 1}`;
                const col = colLabels?.[p.col] ?? `C${p.col + 1}`;
                const isScouted = p.status === 'scouted';
                return (
                  <button
                    key={p.teamNumber}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="flex items-center gap-3 py-2.5 -mx-4 px-4 hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer text-left"
                  >
                    <span className={cn(
                      'font-data text-base font-bold',
                      isScouted ? 'text-[hsl(var(--accent))]' : 'text-white'
                    )}>
                      {p.teamNumber}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] font-data">
                      {row}-{col}
                    </span>
                    {p.teamName && (
                      <span className="flex-1 text-xs text-[hsl(var(--muted-foreground))] truncate">
                        {p.teamName}
                      </span>
                    )}
                    <Badge variant={isScouted ? 'default' : 'amber'} className="shrink-0 text-[10px]">
                      {isScouted ? 'scouted' : 'claimed'}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

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

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {selected.status === 'unclaimed' && (
                  <>
                    <Button
                      onClick={handleClaim}
                      loading={actionLoading}
                      className="flex-1 gap-2"
                      size="sm"
                    >
                      <Hand size={14} /> Call Dibs
                    </Button>
                    {isLead && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setAssignPickerOpen((v) => !v)}
                      >
                        <UserPlus size={14} /> Assign Scout
                      </Button>
                    )}
                  </>
                )}

                {selected.status === 'dibbed' && (
                  <>
                    {canRelease && (
                      <Button
                        variant="secondary"
                        onClick={handleUnclaim}
                        loading={actionLoading}
                        size="sm"
                        className="flex-1"
                      >
                        Release
                      </Button>
                    )}
                    <Button
                      onClick={() => navigate(`/pit?team=${selected.teamNumber}`)}
                      size="sm"
                      variant={isMyDib ? 'default' : 'secondary'}
                      className="flex-1 gap-2"
                    >
                      <ClipboardList size={14} /> {isMyDib ? 'Scout Now' : 'Scout Anyway'}
                    </Button>
                    {isLead && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => setAssignPickerOpen((v) => !v)}
                      >
                        <UserPlus size={14} /> Reassign
                      </Button>
                    )}
                  </>
                )}

                {selected.status === 'scouted' && (
                  <div className="flex items-center gap-2 text-sm text-[hsl(var(--accent))]">
                    <CheckCircle2 size={16} />
                    Pit scouting complete
                  </div>
                )}
              </div>

              {/* Assign / reassign picker (lead/admin only) */}
              {assignPickerOpen && isLead && (
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border)/0.5)] font-medium uppercase tracking-wide">
                    Assign to scout
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {scouts.length === 0 ? (
                      <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-3">No scouts found</p>
                    ) : (
                      scouts.map((scout) => (
                        <button
                          key={scout.uid}
                          type="button"
                          disabled={assignLoading}
                          onClick={() => handleAssign(scout)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[hsl(var(--primary))] transition-colors text-left cursor-pointer disabled:opacity-50"
                        >
                          {scout.photoURL ? (
                            <img src={scout.photoURL} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary))] border border-[hsl(var(--border))] flex items-center justify-center text-[9px] font-semibold shrink-0">
                              {scout.displayName[0]}
                            </div>
                          )}
                          <span className="flex-1 truncate">{scout.displayName}</span>
                          <span className="text-[hsl(var(--muted-foreground))] shrink-0">{scout.role}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sprite overlay — animals walk in and dance when all pits are done */}
      <DiscoOverlay active={allDone} />
    </div>
  );
}
