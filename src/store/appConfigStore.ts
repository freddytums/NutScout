import { create } from 'zustand';

export interface AppConfig {
  tbaKey: string;
  tbaKeyStale: boolean;
  adminName: string;   // shown in "contact X" banner
  adminEmail: string;
}

const DEFAULTS: AppConfig = {
  tbaKey: '',
  tbaKeyStale: false,
  adminName: 'James Barnes',
  adminEmail: 'jamesabarnes3216@gmail.com',
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
