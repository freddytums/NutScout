import { create } from 'zustand';

interface ChatState {
  drawerOpen: boolean;
  pendingPrompt: string | null;
  openWith: (prompt?: string) => void;
  close: () => void;
  clearPendingPrompt: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  drawerOpen: false,
  pendingPrompt: null,
  openWith: (prompt) => set({ drawerOpen: true, pendingPrompt: prompt ?? null }),
  close: () => set({ drawerOpen: false }),
  clearPendingPrompt: () => set({ pendingPrompt: null }),
}));
