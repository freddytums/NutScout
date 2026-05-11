import { useEffect, useState } from 'react';
import { subscribeToAllMatches, submitMatch, flagMatch, deleteMatch } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import { useAuth } from './useAuth';
import type { MatchEntry } from '@/types/scout';
import { Timestamp } from 'firebase/firestore';

export function useMatches() {
  const { currentEventId, currentEvent } = useEventStore();
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToAllMatches(currentEventId, (data) => {
      setMatches(data);
      setLoading(false);
    });
    return unsub;
  }, [currentEventId]);

  async function submit(data: Record<string, unknown>, meta: {
    teamNumber: number;
    matchNumber: number;
    matchType: MatchEntry['matchType'];
    alliance: MatchEntry['alliance'];
    alliancePosition: MatchEntry['alliancePosition'];
    notes?: string;
  }) {
    if (!currentEventId || !user || !currentEvent) return;
    await submitMatch(currentEventId, {
      ...meta,
      scoutedBy: user.uid,
      scoutedByName: user.displayName,
      eventKey: currentEvent.eventKey,
      year: currentEvent.year,
      timestamp: Timestamp.now(),
      data,
    });
  }

  async function flag(matchId: string, flags: MatchEntry['flags']) {
    if (!currentEventId) return;
    await flagMatch(currentEventId, matchId, flags);
  }

  async function deleteEntry(matchId: string) {
    if (!currentEventId) return;
    await deleteMatch(currentEventId, matchId);
  }

  return { matches, loading, submit, flag, deleteEntry };
}
