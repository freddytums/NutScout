import { useMemo } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import { Trophy, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMatches } from '@/hooks/useMatches';
import { useSchedule } from '@/hooks/useSchedule';
import { cn } from '@/lib/utils';

interface ScoutStats {
  uid: string;
  name: string;
  photoURL?: string;
  matchCount: number;
  streak: number;
  accuracy: number; // % matches without flags
  isPrimary: boolean;
}

export function Leaderboard() {
  const { matches } = useMatches();
  const { users } = useSchedule();

  const stats = useMemo((): ScoutStats[] => {
    const byUid = new Map<string, ScoutStats>();

    // Build base stats from user list
    users.forEach((u) => {
      byUid.set(u.uid, {
        uid: u.uid,
        name: u.displayName,
        photoURL: u.photoURL,
        matchCount: 0,
        streak: 0,
        accuracy: 100,
        isPrimary: u.isPrimaryScout ?? false,
      });
    });

    // Count matches per scout — only for users that still have an account
    matches.forEach((m) => {
      const existing = byUid.get(m.scoutedBy);
      if (existing) existing.matchCount++;
    });

    // Calculate accuracy (% of matches without error flags)
    const flagged = new Map<string, number>();
    matches.forEach((m) => {
      if (m.flags?.outlier || m.flags?.missingData) {
        flagged.set(m.scoutedBy, (flagged.get(m.scoutedBy) ?? 0) + 1);
      }
    });
    byUid.forEach((stats, uid) => {
      if (stats.matchCount > 0) {
        const f = flagged.get(uid) ?? 0;
        stats.accuracy = Math.round(((stats.matchCount - f) / stats.matchCount) * 100);
      }
    });

    // Simple streak: consecutive matches scouted in match order
    const byUidMatches = new Map<string, number[]>();
    matches.forEach((m) => {
      if (!byUidMatches.has(m.scoutedBy)) byUidMatches.set(m.scoutedBy, []);
      byUidMatches.get(m.scoutedBy)!.push(m.matchNumber);
    });

    byUidMatches.forEach((matchNums, uid) => {
      const sorted = [...matchNums].sort((a, b) => a - b);
      let streak = 1;
      let maxStreak = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1 || sorted[i] === sorted[i - 1] + 2) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 1;
        }
      }
      const s = byUid.get(uid);
      if (s) s.streak = maxStreak;
    });

    return [...byUid.values()]
      .filter((s) => s.matchCount > 0 || s.isPrimary)
      .sort((a, b) => b.matchCount - a.matchCount || b.accuracy - a.accuracy);
  }, [matches, users]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-[hsl(var(--accent))]" />
          <h2 className="text-base font-semibold">Scout Leaderboard</h2>
        </div>
        <HelpButton content={{
          title: 'Scout Leaderboard',
          description: 'Ranks scouts by how many match entries they\'ve submitted for this event.',
          steps: [
            { heading: 'Ranking', detail: 'Scouts ordered by total match entries submitted.' },
            { heading: 'Hot streak 🔥', detail: 'Shown when a scout has submitted 3+ entries in a row recently.' },
            { heading: 'Data coverage', detail: 'More submissions = more reliable team rankings in the Data tab.' },
          ],
        }} />
      </div>

      {stats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No scouting data yet
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {stats.map((scout, idx) => (
            <Card key={scout.uid} className={cn(idx === 0 && 'border-[hsl(var(--accent)/0.4)] glow-green')}>
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {idx < 3 ? (
                    <span className="text-lg">{medals[idx]}</span>
                  ) : (
                    <span className="font-data text-sm text-[hsl(var(--muted-foreground))]">#{idx + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                {scout.photoURL ? (
                  <img src={scout.photoURL} alt="" className="w-9 h-9 rounded-full shrink-0 object-fill" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-semibold shrink-0">
                    {scout.name[0]}
                  </div>
                )}

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{scout.name}</span>
                    {scout.isPrimary && (
                      <Badge variant="default" className="text-[10px] shrink-0">primary</Badge>
                    )}
                  </div>
                  {scout.streak > 2 && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-400 mt-0.5">
                      <Flame size={11} /> {scout.streak} streak
                    </span>
                  )}
                </div>

                {/* Match count */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="font-data text-lg font-bold text-[hsl(var(--foreground))]">
                    {scout.matchCount}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">matches</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
