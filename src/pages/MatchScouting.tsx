import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, ChevronRight, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormRenderer, initFormValues } from '@/components/scouting/FormRenderer';
import { useMatches } from '@/hooks/useMatches';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { useAssignments } from '@/hooks/useAssignments';
import { useAuth } from '@/hooks/useAuth';
import { getGameConfig } from '@/config/games';
import { matchLabel, teamNumberFromKey, sortMatches } from '@/lib/tba';
import type { MatchEntry, Station } from '@/types/scout';
import type { TBAMatch } from '@/lib/tba';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

type Step = 'meta' | 'auto' | 'teleop' | 'endgame' | 'done';
const STEPS: Step[] = ['meta', 'auto', 'teleop', 'endgame'];
const STEP_LABELS: Record<Step, string> = {
  meta: 'Match Info',
  auto: 'Autonomous',
  teleop: 'Teleoperated',
  endgame: 'Endgame',
  done: 'Submitted',
};

function MatchPicker({ onSelect }: {
  onSelect: (match: TBAMatch, teamNumber: number, alliance: 'red' | 'blue', position: 1 | 2 | 3) => void;
}) {
  const { matches } = useTBAStore();
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  const qualMatches = useMemo(
    () => matches.filter((m) => m.comp_level === 'qm'),
    [matches]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return qualMatches.filter((m) => {
      const label = matchLabel(m).toLowerCase();
      const hasTeam = !selectedTeam || m.alliances.red.team_keys.includes(`frc${selectedTeam}`) ||
        m.alliances.blue.team_keys.includes(`frc${selectedTeam}`);
      return label.includes(q) && hasTeam;
    });
  }, [qualMatches, search, selectedTeam]);

  if (matches.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Pick from TBA schedule — tap your team in a match
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search match..."
            className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
          />
        </div>
        <input
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          placeholder="Team #"
          type="number"
          inputMode="numeric"
          className="w-24 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
        />
      </div>
      <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
        {filtered.slice(0, 30).map((match) => (
          <div key={match.key} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold font-data text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border)/0.5)]">
              {matchLabel(match)}
            </div>
            <div className="grid grid-cols-2 divide-x divide-[hsl(var(--border)/0.5)]">
              {(['red', 'blue'] as const).map((alliance) => (
                <div key={alliance} className="flex flex-col gap-1 p-1.5">
                  {match.alliances[alliance].team_keys.map((key, idx) => {
                    const tn = teamNumberFromKey(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(match, tn, alliance, (idx + 1) as 1 | 2 | 3)}
                        className={cn(
                          'text-xs font-data py-1.5 px-2 rounded cursor-pointer transition-all active:scale-95 min-h-[36px]',
                          alliance === 'red'
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                            : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20'
                        )}
                      >
                        {tn}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">No matches found</p>
        )}
      </div>
    </div>
  );
}

export function MatchScouting() {
  const { currentEvent } = useEventStore();
  const { submit } = useMatches();
  const { matches: tbaMatches } = useTBAStore();
  const { assignments } = useAssignments();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('meta');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  const gameYear = currentEvent?.activeGameYear ?? 2026;
  const game = getGameConfig(gameYear);

  const hasTBASchedule = tbaMatches.length > 0;

  // Find this user's station assignment
  const myStation = useMemo(() =>
    (Object.entries(assignments) as [Station, { uid: string }][])
      .find(([, a]) => a?.uid === user?.uid)?.[0] ?? null,
    [assignments, user]
  );

  // Next unplayed match for this scout's station
  const nextMatch = useMemo(() => {
    if (!myStation || !tbaMatches.length) return null;
    const alliance = myStation.startsWith('red') ? 'red' : 'blue';
    const pos = parseInt(myStation.slice(-1)) - 1;
    return sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm'))
      .find((m) => !!m.alliances[alliance].team_keys[pos]) ?? null;
  }, [myStation, tbaMatches]);

  const [meta, setMeta] = useState(() => {
    // Pre-fill from URL params (coming from Assignments page) or next match
    const urlMatch = searchParams.get('match');
    const urlTeam = searchParams.get('team');
    const urlAlliance = searchParams.get('alliance') as MatchEntry['alliance'] | null;
    const urlPos = searchParams.get('pos');
    return {
      teamNumber: urlTeam ?? '',
      matchNumber: urlMatch ?? '',
      matchType: 'qm' as MatchEntry['matchType'],
      alliance: urlAlliance ?? ('red' as MatchEntry['alliance']),
      alliancePosition: urlPos ? (parseInt(urlPos) as MatchEntry['alliancePosition']) : (1 as MatchEntry['alliancePosition']),
      notes: '',
    };
  });

  // Auto-fill next assignment if form is blank
  useEffect(() => {
    if (nextMatch && !meta.teamNumber && !meta.matchNumber && myStation) {
      const alliance = myStation.startsWith('red') ? 'red' : 'blue';
      const pos = parseInt(myStation.slice(-1));
      const teamKey = nextMatch.alliances[alliance].team_keys[pos - 1];
      if (teamKey) {
        setMeta((m) => ({
          ...m,
          teamNumber: String(teamNumberFromKey(teamKey)),
          matchNumber: String(nextMatch.match_number),
          alliance,
          alliancePosition: pos as 1 | 2 | 3,
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextMatch, myStation]);

  const [autoValues, setAutoValues] = useState(() => initFormValues(game.match.auto));
  const [teleopValues, setTeleopValues] = useState(() => initFormValues(game.match.teleop));
  const [endgameValues, setEndgameValues] = useState(() => initFormValues(game.match.endgame));

  function handleAutoChange(id: string, value: unknown) {
    setAutoValues((prev) => ({ ...prev, [id]: value }));
  }
  function handleTeleopChange(id: string, value: unknown) {
    setTeleopValues((prev) => ({ ...prev, [id]: value }));
  }
  function handleEndgameChange(id: string, value: unknown) {
    setEndgameValues((prev) => ({ ...prev, [id]: value }));
  }

  const stepIndex = STEPS.indexOf(step);

  function next() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function back() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submit(
        { ...autoValues, ...teleopValues, ...endgameValues },
        {
          teamNumber: parseInt(meta.teamNumber),
          matchNumber: parseInt(meta.matchNumber),
          matchType: meta.matchType,
          alliance: meta.alliance,
          alliancePosition: meta.alliancePosition,
          notes: meta.notes || undefined,
        }
      );
      setSubmitted(true);
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep('meta');
    setSubmitted(false);
    setMeta({ teamNumber: '', matchNumber: '', matchType: 'qm', alliance: 'red', alliancePosition: 1, notes: '' });
    setAutoValues(initFormValues(game.match.auto));
    setTeleopValues(initFormValues(game.match.teleop));
    setEndgameValues(initFormValues(game.match.endgame));
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
        <div className="w-16 h-16 rounded-full bg-[hsl(var(--accent)/0.15)] flex items-center justify-center glow-green">
          <CheckCircle2 size={36} className="text-[hsl(var(--accent))]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Submitted!</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Team {meta.teamNumber} · Match {meta.matchNumber}
          </p>
        </div>
        <Button onClick={reset} size="lg">Scout Another Match</Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      {/* Assignment banner */}
      {myStation && nextMatch && step === 'meta' && (
        <div className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm',
          myStation.startsWith('red')
            ? 'border-red-500/40 bg-red-500/08'
            : 'border-blue-500/40 bg-blue-500/08'
        )}>
          <Zap size={15} className={myStation.startsWith('red') ? 'text-red-400 shrink-0' : 'text-blue-400 shrink-0'} />
          <div className="min-w-0">
            <span className="font-medium">Next: Q{nextMatch.match_number}</span>
            <span className="text-[hsl(var(--muted-foreground))] ml-2 font-data">
              {teamNumberFromKey(
                nextMatch.alliances[myStation.startsWith('red') ? 'red' : 'blue']
                  .team_keys[parseInt(myStation.slice(-1)) - 1]
              )}
            </span>
          </div>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto shrink-0',
            myStation.startsWith('red') ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
          )}>
            {myStation.replace('red', 'R').replace('blue', 'B')}
          </span>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= stepIndex ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--muted))]'
              }`}
            />
          </div>
        ))}
      </div>
      <h2 className="text-base font-semibold">{STEP_LABELS[step]}</h2>

      {step === 'meta' && (
        <Card>
          <CardContent className="pt-4 flex flex-col gap-4">

            {/* TBA match picker — shown when schedule is available */}
            {hasTBASchedule && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Quick-fill from schedule</span>
                  <button
                    type="button"
                    onClick={() => setShowMatchPicker((v) => !v)}
                    className="text-xs text-[hsl(var(--accent))] hover:underline cursor-pointer"
                  >
                    {showMatchPicker ? 'Hide' : 'Show schedule'}
                  </button>
                </div>
                {meta.teamNumber && meta.matchNumber && (
                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full font-data',
                      meta.alliance === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    )}>
                      {meta.alliance === 'red' ? 'Red' : 'Blue'} {meta.alliancePosition}
                    </span>
                    <span>Team {meta.teamNumber} · Q{meta.matchNumber}</span>
                  </div>
                )}
                {showMatchPicker && (
                  <MatchPicker
                    onSelect={(match, teamNumber, alliance, position) => {
                      setMeta((m) => ({
                        ...m,
                        teamNumber: String(teamNumber),
                        matchNumber: String(match.match_number),
                        matchType: match.comp_level as MatchEntry['matchType'],
                        alliance,
                        alliancePosition: position,
                      }));
                      setShowMatchPicker(false);
                    }}
                  />
                )}
                <div className="border-t border-[hsl(var(--border)/0.5)]" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Team #</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={meta.teamNumber}
                  onChange={(e) => setMeta((m) => ({ ...m, teamNumber: e.target.value }))}
                  className="h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-lg font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
                  placeholder="1234"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Match #</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={meta.matchNumber}
                  onChange={(e) => setMeta((m) => ({ ...m, matchNumber: e.target.value }))}
                  className="h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-lg font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
                  placeholder="12"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Match Type</label>
              <div className="flex gap-2">
                {(['qm', 'qf', 'sf', 'f'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMeta((m) => ({ ...m, matchType: type }))}
                    className={`flex-1 h-10 rounded-lg text-xs font-semibold uppercase border transition-all cursor-pointer ${
                      meta.matchType === type
                        ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Alliance</label>
              <div className="flex gap-2">
                {(['red', 'blue'] as const).map((alliance) => (
                  <button
                    key={alliance}
                    type="button"
                    onClick={() => setMeta((m) => ({ ...m, alliance }))}
                    className={`flex-1 h-10 rounded-lg text-sm font-semibold capitalize border transition-all cursor-pointer ${
                      meta.alliance === alliance
                        ? alliance === 'red'
                          ? 'border-red-500 bg-red-500/15 text-red-400'
                          : 'border-blue-500 bg-blue-500/15 text-blue-400'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {alliance}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Driver Station</label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setMeta((m) => ({ ...m, alliancePosition: pos }))}
                    className={`flex-1 h-10 rounded-lg text-sm font-data border transition-all cursor-pointer ${
                      meta.alliancePosition === pos
                        ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'auto' && (
        <Card>
          <CardHeader><CardTitle>Autonomous Period</CardTitle></CardHeader>
          <CardContent>
            <FormRenderer
              fields={game.match.auto}
              values={autoValues}
              onChange={handleAutoChange}
              fieldImageSrc={game.field.src}
            />
          </CardContent>
        </Card>
      )}

      {step === 'teleop' && (
        <Card>
          <CardHeader><CardTitle>Teleoperated Period</CardTitle></CardHeader>
          <CardContent>
            <FormRenderer
              fields={game.match.teleop}
              values={teleopValues}
              onChange={handleTeleopChange}
            />
          </CardContent>
        </Card>
      )}

      {step === 'endgame' && (
        <Card>
          <CardHeader><CardTitle>Endgame</CardTitle></CardHeader>
          <CardContent>
            <FormRenderer
              fields={game.match.endgame}
              values={endgameValues}
              onChange={handleEndgameChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {stepIndex > 0 && (
          <Button variant="secondary" onClick={back} className="flex-1">
            Back
          </Button>
        )}
        {step !== 'endgame' ? (
          <Button
            onClick={next}
            className="flex-1 gap-2"
            disabled={step === 'meta' && (!meta.teamNumber || !meta.matchNumber)}
          >
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting} className="flex-1">
            Submit Match
          </Button>
        )}
      </div>
    </div>
  );
}
