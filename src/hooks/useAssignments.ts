import { useEffect, useState } from 'react';
import { subscribeToAssignments, setStationAssignment, getAllUsers } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import type { Station, StationAssignments, StationAssignment } from '@/types/scout';
import type { AppUser } from '@/types/scout';

export function useAssignments() {
  const { currentEventId } = useEventStore();
  const [assignments, setAssignments] = useState<StationAssignments>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentEventId) return;
    setLoading(true);
    const unsub = subscribeToAssignments(currentEventId, (data) => {
      setAssignments(data);
      setLoading(false);
    });
    return unsub;
  }, [currentEventId]);

  async function assign(station: Station, scout: StationAssignment | null) {
    if (!currentEventId) return;
    await setStationAssignment(currentEventId, station, scout);
  }

  return { assignments, loading, assign };
}

export function useAllUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then((u) => {
      setUsers(u.sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setLoading(false);
    });
  }, []);

  return { users, loading };
}
