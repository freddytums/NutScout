import { useLocation, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScoutingIcon, DataIcon, PickListIcon } from './icons';

type ModeId = 'scouting' | 'data' | 'picklist';

interface ModeDef {
  id: ModeId;
  label: string;
  to: string;
  Icon: typeof ScoutingIcon;
  wip?: boolean;
}

const MODES: ModeDef[] = [
  { id: 'scouting', label: 'Scouting',  to: '/match',    Icon: ScoutingIcon },
  { id: 'data',     label: 'Data',      to: '/viewer',   Icon: DataIcon     },
  { id: 'picklist', label: 'Pick List', to: '/picklist', Icon: PickListIcon, wip: true },
];

// Routes covered by each mode. Scouting is the fallback — anything not in
// /viewer or /picklist is treated as "scouting mode".
function getActiveIndex(pathname: string): number {
  if (pathname.startsWith('/viewer'))   return 1;
  if (pathname.startsWith('/picklist')) return 2;
  return 0;
}

export function ModeSwitcher() {
  const loc = useLocation();
  const nav = useNavigate();
  const activeIdx = getActiveIndex(loc.pathname);

  // Measure segments so the thumb width/translate scales with the actual layout.
  // Using useLayoutEffect avoids a one-frame flash where the thumb is at 0/0.
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const [metrics, setMetrics] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const seg = segmentRefs.current[activeIdx];
      const container = containerRef.current;
      if (!seg || !container) return;
      const segRect = seg.getBoundingClientRect();
      const conRect = container.getBoundingClientRect();
      setMetrics({ left: segRect.left - conRect.left, width: segRect.width });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIdx]);

  return (
    <div className="flex justify-center py-2">
      <div
        ref={containerRef}
        role="tablist"
        aria-label="App mode"
        className="relative flex items-stretch rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--primary)/0.7)] backdrop-blur-md p-1 shadow-lg"
      >
        {/* Sliding thumb */}
        {metrics && (
          <div
            aria-hidden
            className="mode-thumb absolute top-1 bottom-1 rounded-full bg-[hsl(var(--accent)/0.16)] border border-[hsl(var(--accent)/0.7)] glow-green pointer-events-none"
            style={{
              transform: `translateX(${metrics.left - 4}px)`, // -4 to offset container padding (p-1 = 4px)
              width: metrics.width,
            }}
          />
        )}

        {MODES.map(({ id, label, to, Icon, wip }, idx) => {
          const isActive = activeIdx === idx;
          return (
            <button
              key={id}
              ref={(el) => { segmentRefs.current[idx] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              aria-label={wip ? `${label} — work in progress` : label}
              onClick={() => nav(to)}
              className={cn(
                'relative z-10 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-9 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--primary))]',
                isActive
                  ? 'text-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <span className={cn(
                'flex items-center justify-center w-[18px] h-[18px] shrink-0 transition-transform duration-200',
                isActive && 'scale-110'
              )}>
                <Icon active={isActive} />
              </span>
              <span className={cn(
                'text-[11px] sm:text-xs font-semibold tracking-wide uppercase whitespace-nowrap transition-all',
                isActive ? 'font-[Orbitron] tracking-widest' : ''
              )}>
                {label}
              </span>
              {wip && (
                <span
                  className={cn(
                    'text-[8px] font-bold uppercase tracking-widest px-1 py-px rounded',
                    'border border-amber-500/50 text-amber-400 bg-amber-500/10'
                  )}
                  aria-hidden
                >
                  WIP
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
