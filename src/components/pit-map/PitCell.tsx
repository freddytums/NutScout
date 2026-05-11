import { cn } from '@/lib/utils';
import type { PitEntry, AppUser } from '@/types/scout';

interface Props {
  pit: PitEntry | undefined;
  teamNumber: number;
  row: number;
  col: number;
  currentUser: AppUser;
  onClick: () => void;
}

export function PitCell({ pit, teamNumber, currentUser, onClick }: Props) {
  const status = pit?.status ?? 'unclaimed';
  const isMyDib = pit?.dibbedBy === currentUser.uid;
  const isMyScouted = pit?.scoutedBy === currentUser.uid;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Team ${teamNumber} pit — ${status}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border text-center p-1.5 min-h-[60px] transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))]',
        status === 'unclaimed' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] hover:border-[hsl(var(--accent)/0.5)]',
        status === 'dibbed' && !isMyDib && 'border-amber-500/60 bg-amber-500/10 glow-amber',
        // My dibs get a brighter, high-contrast treatment
        status === 'dibbed' && isMyDib && 'border-white/70 bg-white/10 ring-1 ring-white/40',
        status === 'scouted' && !isMyScouted && 'border-[hsl(var(--accent)/0.6)] bg-[hsl(var(--accent)/0.1)] glow-green',
        status === 'scouted' && isMyScouted && 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.2)] glow-green',
      )}
    >
      <span className={cn(
        'font-data text-[11px] font-bold leading-tight',
        status === 'unclaimed' && 'text-[hsl(var(--muted-foreground))]',
        status === 'dibbed' && !isMyDib && 'text-amber-400',
        status === 'dibbed' && isMyDib && 'text-white',
        status === 'scouted' && 'text-[hsl(var(--accent))]',
      )}>
        {teamNumber}
      </span>

      {status === 'scouted' && (
        <div className="mt-0.5 w-2 h-2 rounded-full bg-[hsl(var(--accent))]" aria-hidden />
      )}
      {status === 'dibbed' && (
        <div className={cn(
          'mt-0.5 text-[8px] font-semibold leading-none truncate max-w-full px-0.5',
          isMyDib ? 'text-white' : 'text-amber-400'
        )}>
          {isMyDib ? '★ you' : (pit?.dibbedByName?.split(' ')[0] ?? '…')}
        </div>
      )}
    </button>
  );
}
