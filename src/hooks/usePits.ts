import { useEffect, useState } from 'react';
import { subscribeToPits, claimPit, unclaimPit, submitPitScouting, updatePitEntry, resetPit, resetAllPits } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import { useAuth } from './useAuth';
import type { PitEntry, PitPhoto } from '@/types/scout';

export function usePits() {
  const { currentEventId } = useEventStore();
  const { user } = useAuth();
  const [pits, setPits] = useState<PitEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToPits(currentEventId, (data) => {
      setPits(data);
      setLoading(false);
    });
    return unsub;
  }, [currentEventId]);

  const pitMap = new Map(pits.map((p) => [p.teamNumber, p]));

  async function claim(teamNumber: number) {
    if (!currentEventId || !user) return;
    await claimPit(currentEventId, teamNumber, user.uid, user.displayName);
  }

  async function unclaim(teamNumber: number) {
    if (!currentEventId) return;
    await unclaimPit(currentEventId, teamNumber);
  }

  async function assignPit(teamNumber: number, targetUid: string, targetName: string) {
    if (!currentEventId) return;
    await claimPit(currentEventId, teamNumber, targetUid, targetName);
  }

  async function submitPit(teamNumber: number, data: Record<string, unknown>, photos?: PitPhoto[]) {
    if (!currentEventId || !user) return;
    await submitPitScouting(currentEventId, teamNumber, user.uid, data, photos);
  }

  async function editPit(
    teamNumber: number,
    status: import('@/types/scout').PitStatus,
    data: Record<string, unknown>,
    photos?: PitPhoto[]
  ) {
    if (!currentEventId) return;
    const updates: Parameters<typeof updatePitEntry>[2] = { status, data };
    if (photos !== undefined) updates.photos = photos;
    await updatePitEntry(currentEventId, teamNumber, updates);
  }

  async function reset(teamNumber: number) {
    if (!currentEventId) return;
    await resetPit(currentEventId, teamNumber);
  }

  async function resetAll() {
    if (!currentEventId) return;
    await resetAllPits(currentEventId);
  }

  return { pits, pitMap, loading, claim, unclaim, assignPit, submitPit, editPit, reset, resetAll };
}
