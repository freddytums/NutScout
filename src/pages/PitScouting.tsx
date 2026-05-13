import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { NutronsCelebrationOverlay } from '@/components/CelebrationOverlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormRenderer, initFormValues } from '@/components/scouting/FormRenderer';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { getGameConfig } from '@/config/games';

export function PitScouting() {
  const [params] = useSearchParams();
  const { currentEvent } = useEventStore();
  const { submitPit } = usePits();

  const gameYear = currentEvent?.activeGameYear ?? 2026;
  const game = getGameConfig(gameYear);

  const [teamNumber, setTeamNumber] = useState(params.get('team') ?? '');
  const [values, setValues] = useState(() => initFormValues(game.pit));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    if (!teamNumber) return;
    setSubmitting(true);
    try {
      await submitPit(parseInt(teamNumber), values);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setTeamNumber('');
    setValues(initFormValues(game.pit));
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <>
        <NutronsCelebrationOverlay />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--accent)/0.15)] flex items-center justify-center glow-green">
            <CheckCircle2 size={36} className="text-[hsl(var(--accent))]" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">Pit Scouted!</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Team {teamNumber}</p>
          </div>
          <Button onClick={reset} size="lg">Scout Another Pit</Button>
        </div>
      </>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Team Number</label>
          <input
            type="number"
            inputMode="numeric"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            className="h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-lg font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
            placeholder="1234"
          />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Pit Scouting — {game.name} {game.year}</CardTitle></CardHeader>
        <CardContent>
          <FormRenderer fields={game.pit} values={values} onChange={handleChange} />
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        loading={submitting}
        size="lg"
        className="w-full"
        disabled={!teamNumber}
      >
        Submit Pit Scouting
      </Button>
    </div>
  );
}
