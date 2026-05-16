import { create } from 'zustand';

export interface AppConfig {
  tbaKey: string;
  tbaKeyStale: boolean;
  adminName: string;
  adminEmail: string;
  defaultEventId: string;      // global default event for new users
  defaultGameYear: number;     // global default game year
}

const DEFAULTS: AppConfig = {
  tbaKey: '',
  tbaKeyStale: false,
  adminName: 'James Barnes',
  adminEmail: 'jamesabarnes3216@gmail.com',
  defaultEventId: '',
  defaultGameYear: 2026,
};

interface AppConfigState {
  config: AppConfig;
  loaded: boolean;
  setConfig: (config: Partial<AppConfig>) => void;
  markTbaKeyStale: () => void;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  config: DEFAULTS,
  loaded: false,
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial }, loaded: true })),
  markTbaKeyStale: () =>
    set((s) => ({ config: { ...s.config, tbaKeyStale: true } })),
}));
