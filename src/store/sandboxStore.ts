import { create } from 'zustand';
import type { UserRole, AppUser } from '@/types/scout';

interface SandboxState {
  sandboxRole: UserRole | null;
  sandboxUser: AppUser | null;     // full user impersonation
  setSandboxRole: (role: UserRole | null) => void;
  setSandboxUser: (user: AppUser | null) => void;
  clear: () => void;
}

export const useSandboxStore = create<SandboxState>((set) => ({
  sandboxRole: null,
  sandboxUser: null,
  setSandboxRole: (sandboxRole) => set({ sandboxRole, sandboxUser: null }),
  setSandboxUser: (sandboxUser) => set({ sandboxUser, sandboxRole: sandboxUser?.role ?? null }),
  clear: () => set({ sandboxRole: null, sandboxUser: null }),
}));
