import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));

interface UIState {
  sidebarOpen: boolean;
  selectedCategory: string | null;
  searchQuery: string;
  toggleSidebar: () => void;
  setCategory: (category: string | null) => void;
  setSearch: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  selectedCategory: null,
  searchQuery: '',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCategory: (selectedCategory) => set({ selectedCategory }),
  setSearch: (searchQuery) => set({ searchQuery }),
}));
