import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameField } from '@/types/game';

interface Props {
  field: GameField;
  value: number;
  onChange: (v: number) => void;
}

export function CounterField({ field, value, onChange }: Props) {
  const min = field.min ?? 0;
  const max = field.max ?? 99;

  return (
    <div className="flex items-center justify-between gap-4 p-1">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${field.label}`}
        >
          <Minus size={16} />
        </Button>
        <span className="font-data text-xl text-[hsl(var(--foreground))] min-w-[2ch] text-center">
          {value}
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${field.label}`}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
