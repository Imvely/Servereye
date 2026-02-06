import { create } from 'zustand';

interface SettingsState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: localStorage.getItem('darkMode') === 'true',

  toggleDarkMode: () =>
    set((state) => {
      const newValue = !state.darkMode;
      localStorage.setItem('darkMode', String(newValue));
      if (newValue) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { darkMode: newValue };
    }),

  setDarkMode: (value: boolean) => {
    localStorage.setItem('darkMode', String(value));
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: value });
  },
}));
