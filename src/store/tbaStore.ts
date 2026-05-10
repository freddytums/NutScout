import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TBAEvent, TBATeam, TBAMatch } from '@/lib/tba';

interface TBAState {
  event: TBAEvent | null;
  teams: TBATeam[];
  matches: TBAMatch[];
  lastSynced: number | null;
  setTBAData: (event: TBAEvent, teams: TBATeam[], matches: TBAMatch[]) => void;
  clearTBAData: () => void;
}

export const useTBAStore = create<TBAState>()(
  persist(
    (set) => ({
      event: null,
      teams: [],
      matches: [],
      lastSynced: null,
      setTBAData: (event, teams, matches) =>
        set({ event, teams, matches, lastSynced: Date.now() }),
      clearTBAData: () =>
        set({ event: null, teams: [], matches: [], lastSynced: null }),
    }),
    { name: 'nutscout-tba' }
  )
);
