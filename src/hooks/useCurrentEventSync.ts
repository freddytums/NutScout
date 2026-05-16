import { useEffect, useRef } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeToEvent } from '@/lib/firestore';
import { useEventStore } from '@/store/eventStore';
import { useAppConfigStore } from '@/store/appConfigStore';
import type { EventConfig } from '@/types/scout';

/** Keeps currentEvent in sync with Firestore for the current event ID. */
export function useCurrentEventSync() {
  const { currentEventId, setCurrentEvent } = useEventStore();

  useEffect(() => {
    if (!currentEventId) return;
    return subscribeToEvent(currentEventId, (e) => {
      if (e) setCurrentEvent(e);
    });
  }, [currentEventId, setCurrentEvent]);
}

/** If no event is selected, applies the admin-set global default once. */
export function useDefaultEvent() {
  const { currentEventId, setCurrentEventId, setCurrentEvent } = useEventStore();
  const { config, loaded } = useAppConfigStore();
  const applied = useRef(false);

  useEffect(() => {
    if (!loaded || applied.current || currentEventId || !config.defaultEventId) return;
    applied.current = true;
    getDoc(doc(db, 'events', config.defaultEventId)).then((snap) => {
      if (snap.exists()) {
        const event = snap.data() as EventConfig;
        setCurrentEventId(event.id);
        setCurrentEvent(event);
      }
    });
  }, [loaded, config.defaultEventId, currentEventId, setCurrentEventId, setCurrentEvent]);
}
