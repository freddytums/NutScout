import { useEffect, useState, useCallback } from 'react';
import { subscribeToSchedule, saveSchedule, subscribeToAllUsers } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { useMatches } from '@/hooks/useMatches';
import { generateSchedule } from '@/lib/autoSchedule';
import type { GeneratedSchedule, AppUser, ScheduleMethod } from '@/types/scout';
import type { SortOrder } from '@/lib/autoSchedule';

export function useSchedule() {
  const { currentEventId } = useEventStore();
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const { matches: tbaMatches } = useTBAStore();
  const { matches: submittedMatches } = useMatches();

  useEffect(() => {
    if (!currentEventId) return;
    setLoading(true);
    const unsub = subscribeToSchedule(currentEventId, (s) => {
      setSchedule(s);
      setLoading(false);
    });
    return unsub;
  }, [currentEventId]);

  useEffect(() => {
    return subscribeToAllUsers(setUsers);
  }, []);

  const primaryScouts = users.filter((u) => u.isPrimaryScout);

  // Map of uid -> match count from submitted data
  const matchCounts = new Map<string, number>();
  submittedMatches.forEach((m) => {
    matchCounts.set(m.scoutedBy, (matchCounts.get(m.scoutedBy) ?? 0) + 1);
  });

  const generate = useCallback(
    async (method: ScheduleMethod, sortOrder: SortOrder) => {
      if (!currentEventId) return;
      const generated = generateSchedule(
        tbaMatches,
        primaryScouts,
        { method, sortOrder, matchCounts }
      );
      await saveSchedule(currentEventId, generated);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentEventId, tbaMatches, primaryScouts.length]
  );

  // Derive status for each match slot
  const submittedKeys = new Set(
    submittedMatches.map((m) => `${m.matchNumber}-${m.teamNumber}`)
  );

  function isSlotScouted(matchNumber: number, teamNumber: number) {
    return submittedKeys.has(`${matchNumber}-${teamNumber}`);
  }

  return { schedule, loading, users, primaryScouts, matchCounts, generate, isSlotScouted };
}
