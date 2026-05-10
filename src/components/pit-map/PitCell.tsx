import { cn } from '@/lib/utils';
import type { PitEntry } from '@/types/scout';
import type { AppUser } from '@/types/scout';

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

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Team ${teamNumber} pit — ${status}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border text-center p-1.5 min-h-[60px] transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))]',
        status === 'unclaimed' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] hover:border-[hsl(var(--accent)/0.5)]',
        status === 'dibbed' && !isMyDib && 'border-amber-500/60 bg-amber-500/10 glow-amber',
        status === 'dibbed' && isMyDib && 'border-amber-400 bg-amber-400/20 glow-amber',
        status === 'scouted' && 'border-[hsl(var(--accent)/0.6)] bg-[hsl(var(--accent)/0.1)] glow-green',
      )}
    >
      <span className={cn(
        'font-data text-[11px] font-bold leading-tight',
        status === 'unclaimed' && 'text-[hsl(var(--muted-foreground))]',
        status === 'dibbed' && 'text-amber-400',
        status === 'scouted' && 'text-[hsl(var(--accent))]',
      )}>
        {teamNumber}
      </span>

      {status === 'scouted' && (
        <div className="mt-0.5 w-2 h-2 rounded-full bg-[hsl(var(--accent))]" aria-hidden />
      )}
      {status === 'dibbed' && (
        <div className="mt-0.5 text-[8px] text-amber-400 leading-none truncate max-w-full px-0.5">
          {isMyDib ? 'you' : (pit?.dibbedByName?.split(' ')[0] ?? '…')}
        </div>
      )}
    </button>
  );
}
