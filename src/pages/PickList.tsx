import { Construction, Trophy, Medal, Award, Sparkles } from 'lucide-react';

export function PickList() {
  return (
    <div className="min-h-[calc(100dvh-12rem)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <Construction size={36} className="text-amber-400" />
          </div>
          <Sparkles size={14} className="absolute -top-1 -right-1 text-amber-400 animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] font-[Orbitron] tracking-wide">
            Pick List
          </h1>
          <span className="inline-flex items-center self-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border border-amber-500/50 text-amber-400 bg-amber-500/10">
            Work in progress
          </span>
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mt-2">
            Alliance selection planning is coming soon. This view will let scouting leads rank teams,
            build draft tiers, and share the list with the drive coach during eliminations.
          </p>
        </div>

        <div className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-4 flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--muted-foreground))] text-left">
            Planned features
          </p>
          <div className="flex flex-col gap-2 text-left">
            <FeatureRow
              tone="gold"
              Icon={Trophy}
              title="Tiered draft board"
              body="Drag teams between First Pick, Second Pick, and Do Not Pick tiers."
            />
            <FeatureRow
              tone="silver"
              Icon={Medal}
              title="Weighted rankings"
              body="Score teams using custom weighted formulas across match averages."
            />
            <FeatureRow
              tone="bronze"
              Icon={Award}
              title="Pick predictor"
              body="Predict which teams are likely to be taken before your turn based on captain order."
            />
          </div>
        </div>

        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Have feedback or want priority on this feature? Talk to your scouting lead.
        </p>
      </div>
    </div>
  );
}

function FeatureRow({ tone, Icon, title, body }: {
  tone: 'gold' | 'silver' | 'bronze';
  Icon: typeof Trophy;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === 'gold'   ? 'text-amber-400 bg-amber-500/15 border-amber-500/40'  :
    tone === 'silver' ? 'text-slate-300 bg-slate-400/15 border-slate-400/40' :
                        'text-orange-300 bg-orange-500/15 border-orange-500/40';
  return (
    <div className="flex items-start gap-3">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center border shrink-0 ${toneClass}`}>
        <Icon size={14} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{title}</span>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">{body}</span>
      </div>
    </div>
  );
}
