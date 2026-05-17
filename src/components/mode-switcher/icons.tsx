// Custom animated SVG glyphs for the top-of-app ModeSwitcher.
// Each icon takes an `active` flag — when active, an effect plays.

interface IconProps {
  active: boolean;
  size?: number;
}

export function ScoutingIcon({ active, size = 18 }: IconProps) {
  // A clipboard outline with a crosshair target inside.
  // Active: a green scan line sweeps top-to-bottom.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Clipboard body */}
      <rect x="4.5" y="4.5" width="15" height="17" rx="2.5"
            stroke="currentColor" strokeWidth="1.6" />
      {/* Clip at the top */}
      <rect x="9" y="2.5" width="6" height="3.5" rx="1"
            stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity={active ? 0.9 : 0.6} />
      {/* Crosshair target */}
      <circle cx="12" cy="13.5" r="3.2"
              stroke="currentColor" strokeWidth="1.4" fill="none" opacity={active ? 1 : 0.55} />
      <line x1="12" y1="9.7" x2="12" y2="11" stroke="currentColor" strokeWidth="1.4" opacity={active ? 1 : 0.55} />
      <line x1="12" y1="16" x2="12" y2="17.3" stroke="currentColor" strokeWidth="1.4" opacity={active ? 1 : 0.55} />
      <line x1="8.2" y1="13.5" x2="9.5" y2="13.5" stroke="currentColor" strokeWidth="1.4" opacity={active ? 1 : 0.55} />
      <line x1="14.5" y1="13.5" x2="15.8" y2="13.5" stroke="currentColor" strokeWidth="1.4" opacity={active ? 1 : 0.55} />
      <circle cx="12" cy="13.5" r="0.9" fill="currentColor" opacity={active ? 1 : 0.5} />
      {/* Scan line (only animates while active) */}
      {active && (
        <line x1="5.8" y1="9.5" x2="18.2" y2="9.5"
              stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round"
              className="mode-scan-line" filter="url(#scoutScanGlow)" />
      )}
      <defs>
        <filter id="scoutScanGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export function DataIcon({ active, size = 18 }: IconProps) {
  // 4 vertical bars (ascending then descending heights). Active: bars pulse.
  const bars = [
    { x: 4,  y: 14, h: 6,  cls: 'b1' },
    { x: 8.5, y: 10, h: 10, cls: 'b2' },
    { x: 13, y: 6,  h: 14, cls: 'b3' },
    { x: 17.5, y: 12, h: 8, cls: 'b4' },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Baseline */}
      <line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width="2.8"
          height={b.h}
          rx="0.6"
          fill="currentColor"
          fillOpacity={active ? 0.95 : 0.7}
          className={active ? `mode-bar ${b.cls}` : undefined}
        />
      ))}
      {/* When active: top-tip dots glow */}
      {active && bars.map((b, i) => (
        <circle
          key={`d${i}`}
          cx={b.x + 1.4}
          cy={b.y}
          r="0.9"
          fill="hsl(var(--accent))"
          opacity="0.8"
        />
      ))}
    </svg>
  );
}

export function PickListIcon({ active, size = 18 }: IconProps) {
  // Three ranked tiers (1st gold, 2nd silver, 3rd bronze). Active: they flash in sequence.
  const tiers = [
    { y: 4.5,  w: 16, fill: '#F5C545', stroke: '#F5C545', cls: 't1', label: '1' },
    { y: 10.0, w: 14, fill: '#C8CED5', stroke: '#C8CED5', cls: 't2', label: '2' },
    { y: 15.5, w: 12, fill: '#D38B5D', stroke: '#D38B5D', cls: 't3', label: '3' },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {tiers.map((t, i) => (
        <g key={i} className={active ? `mode-tier ${t.cls}` : undefined}>
          <rect
            x="3"
            y={t.y}
            width={t.w}
            height="4"
            rx="1"
            fill={t.fill}
            fillOpacity={active ? 0.9 : 0.6}
          />
          <text
            x={3 + t.w + 2.5}
            y={t.y + 3.4}
            fontSize="3.6"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            fill={t.fill}
            opacity={active ? 1 : 0.7}
          >
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
