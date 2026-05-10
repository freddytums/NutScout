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
      // Fetch from TBA in parallel
      const [tbaEvent, teams, matches] = await Promise.all([
        getEvent(eventKey),
        getEventTeams(eventKey),
        getEventMatches(eventKey),
      ]);

      // Cache in TBA store
      setTBAData(tbaEvent, teams, sortMatches(matches));

      setStatus('writing');

      // Build pit layout from sorted team list
      const sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);
      const { rows, cols } = calcGridDimensions(sortedTeams.length);

      const rowLabels = Array.from({ length: rows }, (_, i) =>
        String.fromCharCode(65 + i)
      );
      const colLabels = Array.from({ length: cols }, (_, i) => String(i + 1));

      const teamAssignments: Record<string, number> = {};
      sortedTeams.forEach((team, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        teamAssignments[`${row}-${col}`] = team.team_number;
      });

      const eventConfig: EventConfig = {
        id: eventKey,
        name: tbaEvent.name,
        year: tbaEvent.year,
        eventKey,
        pitLayout: { rows, cols, rowLabels, colLabels },
        teamAssignments,
        activeGameYear: tbaEvent.year,
      };

      // Write event doc
      await setDoc(doc(db, 'events', eventKey), eventConfig);

      // Batch-write pit entries (Firestore max 500 per batch)
      const BATCH_SIZE = 400;
      for (let i = 0; i < sortedTeams.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        sortedTeams.slice(i, i + BATCH_SIZE).forEach((team, localIdx) => {
          const globalIdx = i + localIdx;
          const row = Math.floor(globalIdx / cols);
          const col = globalIdx % cols;
          batch.set(
            doc(db, 'events', eventKey, 'pits', String(team.team_number)),
            {
              teamNumber: team.team_number,
              teamName: team.nickname,
              row,
              col,
              status: 'unclaimed',
              createdAt: Timestamp.now(),
            },
            { merge: true } // don't overwrite existing scouting data on re-sync
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
