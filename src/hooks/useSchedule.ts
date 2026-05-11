import { useEffect, useState, useCallback } from 'react';
import { subscribeToSchedule, saveSchedule, subscribeToAllUsers, sendNotification } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { generateSchedule } from '@/lib/autoSchedule';
import type { GeneratedSchedule, AppUser, ScheduleMethod } from '@/types/scout';
import type { SortOrder } from '@/lib/autoSchedule';

export type SlotStatus = 'scouted' | 'scouted-other' | 'missed' | 'upcoming';

export function useSchedule() {
  const { currentEventId } = useEventStore();
  const { user } = useAuth();
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

  const matchCounts = new Map<string, number>();
  submittedMatches.forEach((m) => {
    matchCounts.set(m.scoutedBy, (matchCounts.get(m.scoutedBy) ?? 0) + 1);
  });

  // matchNum-teamNum → who submitted it
  const submittedBySlot = new Map<string, string>();
  submittedMatches.forEach((m) => {
    submittedBySlot.set(`${m.matchNumber}-${m.teamNumber}`, m.scoutedBy);
  });

  /**
   * Returns the status of a match slot:
   * - scouted: data exists AND submitted by the assigned scout
   * - scouted-other: data exists but a different scout submitted it
   * - missed: match was played, no data at all
   * - upcoming: match not yet played
   */
  function getSlotStatus(
    matchNumber: number,
    teamNumber: number,
    assignedUid: string | undefined,
    matchPlayed: boolean
  ): SlotStatus {
    const scoutedBy = submittedBySlot.get(`${matchNumber}-${teamNumber}`);
    if (scoutedBy) {
      return scoutedBy === assignedUid ? 'scouted' : 'scouted-other';
    }
    return matchPlayed ? 'missed' : 'upcoming';
  }

  const generate = useCallback(
    async (method: ScheduleMethod, sortOrder: SortOrder) => {
      if (!currentEventId) return;
      const generated = generateSchedule(tbaMatches, primaryScouts, { method, sortOrder, matchCounts });
      await saveSchedule(currentEventId, generated);

      // Notify all primary scouts that the schedule was updated
      if (user) {
        await Promise.allSettled(
          primaryScouts.map((scout) =>
            sendNotification(scout.uid, {
              fromUid: user.uid,
              fromName: user.displayName,
              message: `Schedule updated (${generated.method}) — check your assignments.`,
            })
          )
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentEventId, tbaMatches, primaryScouts.length, user]
  );

  return { schedule, loading, users, primaryScouts, matchCounts, generate, getSlotStatus };
}
