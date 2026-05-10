import type { GameField } from '@/types/game';
import { cn } from '@/lib/utils';

interface Props {
  field: GameField;
  value: string;
  onChange: (v: string) => void;
}

export function SelectField({ field, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5 p-1">
      <label className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</label>
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 min-h-[44px] cursor-pointer',
              value === opt
                ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))] glow-green'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.5)]'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
