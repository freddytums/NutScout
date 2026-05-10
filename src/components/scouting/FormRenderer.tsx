import type { GameField } from '@/types/game';
import { CounterField } from './fields/CounterField';
import { ToggleField } from './fields/ToggleField';
import { SelectField } from './fields/SelectField';
import { RatingField } from './fields/RatingField';
import { TextField } from './fields/TextField';
import { PathTracerField } from './fields/PathTracerField';
import type { PathSegment } from './fields/PathTracerField';

interface Props {
  fields: GameField[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  fieldImageSrc?: string;
}

function getDefault(field: GameField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case 'counter': return field.min ?? 0;
    case 'toggle': return false;
    case 'select': return field.options?.[0] ?? '';
    case 'rating': return field.min ?? 0;
    case 'path': return [];
    default: return '';
  }
}

export function initFormValues(fields: GameField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.id, getDefault(f)]));
}

export function FormRenderer({ fields, values, onChange, fieldImageSrc }: Props) {
  return (
    <div className="flex flex-col divide-y divide-[hsl(var(--border)/0.5)]">
      {fields.map((field) => {
        const value = values[field.id] ?? getDefault(field);

        switch (field.type) {
          case 'counter':
            return (
              <div key={field.id} className="py-2 px-1">
                <CounterField
                  field={field}
                  value={value as number}
                  onChange={(v) => onChange(field.id, v)}
                />
              </div>
            );
          case 'toggle':
            return (
              <div key={field.id} className="py-2 px-1">
                <ToggleField
                  field={field}
                  value={value as boolean}
                  onChange={(v) => onChange(field.id, v)}
                />
              </div>
            );
          case 'select':
            return (
              <div key={field.id} className="py-2 px-1">
                <SelectField
                  field={field}
                  value={value as string}
                  onChange={(v) => onChange(field.id, v)}
                />
              </div>
            );
          case 'rating':
            return (
              <div key={field.id} className="py-2 px-1">
                <RatingField
                  field={field}
                  value={value as number}
                  onChange={(v) => onChange(field.id, v)}
                />
              </div>
            );
          case 'path':
            return (
              <div key={field.id} className="py-2 px-1">
                <PathTracerField
                  field={field}
                  value={value as PathSegment[]}
                  onChange={(v) => onChange(field.id, v)}
                  fieldImageSrc={fieldImageSrc}
                />
              </div>
            );
          case 'text':
          case 'textarea':
            return (
              <div key={field.id} className="py-2 px-1">
                <TextField
                  field={field}
                  value={value as string}
                  onChange={(v) => onChange(field.id, v)}
                />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
