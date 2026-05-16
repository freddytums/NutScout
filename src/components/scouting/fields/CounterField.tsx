import { useState } from 'react';
import type { GameField } from '@/types/game';
import { cn } from '@/lib/utils';

interface Props {
  field: GameField;
  value: number;
  onChange: (v: number) => void;
}

interface Popup {
  id: number;
  delta: number;
  neg: boolean;
  x: number;
  y: number;
}

const STEPS = [1, 5, 10];
let _uid = 0;

export function CounterField({ field, value, onChange }: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const min = field.min ?? 0;
  const max = field.max ?? Infinity;

  function adjust(delta: number) {
    onChange(Math.min(max, Math.max(min, value + delta)));
  }

  function spawnPopup(delta: number, neg: boolean, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = _uid++;
    setPopups((p) => [...p, { id, delta, neg, x: rect.left + rect.width / 2, y: rect.top }]);
    setTimeout(() => setPopups((p) => p.filter((pop) => pop.id !== id)), 700);
  }

  function handleIncrement(step: number, e: React.MouseEvent<HTMLButtonElement>) {
    adjust(step);
    spawnPopup(step, false, e);
  }

  function handleDecrement(step: number, e: React.MouseEvent<HTMLButtonElement>) {
    adjust(-step);
    spawnPopup(step, true, e);
  }

  return (
    <>
      <div className="flex flex-col gap-2.5 py-1.5 px-1">
        {/* Label + live value */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium text-[hsl(var(--foreground))] leading-tight">{field.label}</span>
            {field.helpText && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">{field.helpText}</p>
            )}
          </div>
          <span className="font-data text-3xl font-bold text-[hsl(var(--accent))] tabular-nums shrink-0 min-w-[2.5rem] text-right leading-none">
            {value}
          </span>
        </div>

        {/* Increment / decrement row */}
        <div className="flex gap-1">
          {/* Decrements — right to left so largest is leftmost */}
          {[...STEPS].reverse().map((step) => {
            const disabled = value - step < min;
            return (
              <button
                key={`-${step}`}
                type="button"
                onClick={(e) => handleDecrement(step, e)}
                disabled={disabled}
                aria-label={`Decrease ${field.label} by ${step}`}
                className={cn(
                  'flex-1 h-9 rounded-lg border text-sm font-data font-semibold transition-colors cursor-pointer',
                  disabled
                    ? 'border-[hsl(var(--border)/0.4)] text-[hsl(var(--muted-foreground)/0.3)] cursor-not-allowed'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--destructive)/0.5)] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.07)] active:scale-95'
                )}
              >
                −{step}
              </button>
            );
          })}

          {/* Spacer */}
          <div className="w-2 shrink-0" />

          {/* Increments */}
          {STEPS.map((step) => {
            const disabled = value + step > max;
            return (
              <button
                key={`+${step}`}
                type="button"
                onClick={(e) => handleIncrement(step, e)}
                disabled={disabled}
                aria-label={`Increase ${field.label} by ${step}`}
                className={cn(
                  'flex-1 h-9 rounded-lg border text-sm font-data font-semibold transition-colors cursor-pointer',
                  disabled
                    ? 'border-[hsl(var(--border)/0.4)] text-[hsl(var(--muted-foreground)/0.3)] cursor-not-allowed'
                    : step === 1
                    ? 'border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.16)] active:scale-95'
                    : 'border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] text-[hsl(var(--accent)/0.8)] hover:bg-[hsl(var(--accent)/0.12)] active:scale-95'
                )}
              >
                +{step}
              </button>
            );
          })}
        </div>
      </div>

      {/* Score popups — fixed to viewport, floats up (green) or falls down (red) */}
      {popups.map((popup) => (
        <div
          key={popup.id}
          className={popup.neg
            ? 'score-pop-neg fixed z-[9999] font-data font-bold text-xl text-[hsl(var(--destructive))] select-none'
            : 'score-pop fixed z-[9999] font-data font-bold text-xl text-[hsl(var(--accent))] select-none'
          }
          style={{ left: popup.x, top: popup.y }}
        >
          {popup.neg ? `−${popup.delta}` : `+${popup.delta}`}
        </div>
      ))}
    </>
  );
}
