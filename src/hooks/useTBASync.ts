import { useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getEvent,
  getEventTeams,
  getEventMatches,
  calcGridDimensions,
  sortMatches,
} from '@/lib/tba';
import { getAvailableYears } from '@/config/games';
import { useTBAStore } from '@/store/tbaStore';
import { useEventStore } from '@/store/eventStore';
import type { EventConfig } from '@/types/scout';
import { Timestamp } from 'firebase/firestore';

export type SyncStatus = 'idle' | 'fetching' | 'writing' | 'done' | 'error';

export function useTBASync() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const { setTBAData } = useTBAStore();
  const { setCurrentEventId, setCurrentEvent } = useEventStore();

  async function sync(eventKey: string) {
    setStatus('fetching');
    setError(null);

    try {
      const [tbaEvent, teams, matches] = await Promise.all([
        getEvent(eventKey),
        getEventTeams(eventKey),
        getEventMatches(eventKey),
      ]);

      setTBAData(tbaEvent, teams, sortMatches(matches));
      setStatus('writing');

      // Auto-detect: use TBA event year if we have a config for it,
      // otherwise fall back to the latest available game year.
      const availableYears = getAvailableYears(); // sorted newest-first
      const activeGameYear = availableYears.includes(tbaEvent.year)
        ? tbaEvent.year
        : availableYears[0];

      const sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);
      const { rows, cols } = calcGridDimensions(sortedTeams.length);

      const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));
      const colLabels = Array.from({ length: cols }, (_, i) => String(i + 1));

      const teamAssignments: Record<string, number> = {};
      sortedTeams.forEach((team, idx) => {
        teamAssignments[`${Math.floor(idx / cols)}-${idx % cols}`] = team.team_number;
      });

      const eventConfig: EventConfig = {
        id: eventKey,
        name: tbaEvent.name,
        year: tbaEvent.year,
        eventKey,
        pitLayout: { rows, cols, rowLabels, colLabels },
        teamAssignments,
        activeGameYear,
      };

      await setDoc(doc(db, 'events', eventKey), eventConfig);

      const BATCH_SIZE = 400;
      for (let i = 0; i < sortedTeams.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        sortedTeams.slice(i, i + BATCH_SIZE).forEach((team, localIdx) => {
          const idx = i + localIdx;
          batch.set(
            doc(db, 'events', eventKey, 'pits', String(team.team_number)),
            {
              teamNumber: team.team_number,
              teamName: team.nickname,
              row: Math.floor(idx / cols),
              col: idx % cols,
              status: 'unclaimed',
              createdAt: Timestamp.now(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      setCurrentEventId(eventKey);
      setCurrentEvent(eventConfig);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setStatus('error');
    }
  }

  return { sync, status, error };
}
