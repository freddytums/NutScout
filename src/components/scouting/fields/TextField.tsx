import type { GameField } from '@/types/game';

interface Props {
  field: GameField;
  value: string;
  onChange: (v: string) => void;
}

const baseClass =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))] transition-all';

export function TextField({ field, value, onChange }: Props) {
  const isMultiline = field.type === 'textarea';

  return (
    <div className="flex flex-col gap-1.5 p-1">
      <label className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</label>
      {isMultiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${baseClass} resize-none`}
          placeholder={field.helpText ?? `Enter ${field.label.toLowerCase()}...`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          placeholder={field.helpText ?? `Enter ${field.label.toLowerCase()}...`}
        />
      )}
    </div>
  );
}
