import type { GameField } from '@/types/game';
import { cn } from '@/lib/utils';

interface Props {
  field: GameField;
  value: number;
  onChange: (v: number) => void;
}

export function RatingField({ field, value, onChange }: Props) {
  const min = field.min ?? 1;
  const max = field.max ?? 5;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</span>
        <span className="font-data text-sm text-[hsl(var(--accent))]">{value === 0 ? '—' : `${value}/${max}`}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            aria-label={`Rate ${step} of ${max}`}
            className={cn(
              'flex-1 h-8 rounded transition-all duration-150 cursor-pointer min-w-[44px]',
              step <= value
                ? 'bg-[hsl(var(--accent))]'
                : 'bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent)/0.3)]'
            )}
          />
        ))}
      </div>
    </div>
  );
}
