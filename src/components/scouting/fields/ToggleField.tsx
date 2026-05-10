import * as Switch from '@radix-ui/react-switch';
import type { GameField } from '@/types/game';

interface Props {
  field: GameField;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleField({ field, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between p-1">
      <div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</span>
        {field.helpText && (
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)] mt-0.5">{field.helpText}</p>
        )}
      </div>
      <Switch.Root
        checked={value}
        onCheckedChange={onChange}
        aria-label={field.label}
        className="w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] data-[state=checked]:bg-[hsl(var(--accent))] data-[state=unchecked]:bg-[hsl(var(--muted))]"
      >
        <Switch.Thumb className="block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}
