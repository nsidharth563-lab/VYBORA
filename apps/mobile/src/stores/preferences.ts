import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface PreferencesState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

/** Device-local UI preferences (not synced to the account). */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'vybora.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
