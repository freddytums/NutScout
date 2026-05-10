import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EventConfig } from '@/types/scout';

interface EventState {
  currentEventId: string | null;
  currentEvent: EventConfig | null;
  setCurrentEventId: (id: string | null) => void;
  setCurrentEvent: (event: EventConfig | null) => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      currentEventId: null,
      currentEvent: null,
      setCurrentEventId: (id) => set({ currentEventId: id }),
      setCurrentEvent: (event) => set({ currentEvent: event }),
    }),
    { name: 'nutscout-event' }
  )
);
