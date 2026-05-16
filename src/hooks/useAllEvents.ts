import { useEffect, useState } from 'react';
import { subscribeToAllEvents } from '@/lib/firestore';
import type { EventConfig } from '@/types/scout';

export function useAllEvents() {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAllEvents((all) => {
      setEvents([...all].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name)));
      setLoading(false);
    });
  }, []);

  const visible = events.filter((e) => !e.hidden);
  return { events, visible, loading };
}
