/**
 * Estado global. Un único árbol `AppData` + acciones de mutación.
 *
 * Las páginas nunca escriben en `localStorage`: llaman a `mutate(draft => ...)`
 * sobre una copia inmutable (immer). Persist es transparente y las stats se
 * derivan de `data` con funciones puras (`lib/metrics.ts`).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import type { AppData, Settings, Profile } from '@/types';
import { appStorage, forceFlush } from './storage';

export const STORE_VERSION = 1;
export const STORE_KEY = 'plos-data-v1';

export const defaultProfile: Profile = {
  name: '',
  focus: '',
  heightCm: null,
  weightKg: null,
  units: 'metric',
  goal: '',
};

export const defaultSettings: Settings = {
  theme: 'dark',
  accent: 'lime',
  weekStartsOn: 1,
  waterGoalMl: 2500,
  sleepGoalH: 8,
  nutritionGoals: { kcal: null, protein: null, carbs: null, fat: null },
  weeklyWorkoutGoal: 4,
  restDefaultSec: 90,
  autoRest: true,
  sound: true,
  notifications: {
    enabled: false,
    restTimer: true,
    taskReminders: false,
    dailyCheckin: false,
  },
  spotify: {
    playlistId: '',
    playlistUrl: '',
    trainingPlaylistUrl: '',
  },
  quickLinks: [],
};

export const createEmptyData = (): AppData => ({
  version: STORE_VERSION,
  profile: { ...defaultProfile },
  settings: { ...defaultSettings, notifications: { ...defaultSettings.notifications }, spotify: { ...defaultSettings.spotify }, nutritionGoals: { ...defaultSettings.nutritionGoals }, quickLinks: [] },
  habits: [],
  habitLogs: [],
  routines: [],
  sessions: [],
  meals: [],
  templates: [],
  water: [],
  tasks: [],
  projects: [],
  categories: [],
  notes: [],
  timeBlocks: [],
  weeklyGoals: [],
  pomodoros: [],
  checkins: [],
  weighIns: [],
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const goalNumber = (v: unknown, max: number): number | null => typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), max) : null;

/** Sanea cualquier entrada (importación o storage viejo) al modelo actual. */
export function normalizeData(raw: unknown): AppData {
  const base = createEmptyData();
  if (!isObj(raw)) return base;
  const src = raw as Partial<AppData> & Record<string, unknown>;

  const arrays: Array<keyof AppData> = [
    'habits', 'habitLogs', 'routines', 'sessions', 'meals', 'templates', 'water',
    'tasks', 'projects', 'categories', 'notes', 'timeBlocks', 'weeklyGoals',
    'pomodoros', 'checkins', 'weighIns',
  ];
  for (const key of arrays) {
    if (Array.isArray(src[key])) (base as unknown as Record<string, unknown>)[key] = (src[key] as unknown[]).filter(isObj);
  }

  if (isObj(src.profile)) base.profile = { ...defaultProfile, ...(src.profile as object) };


  if (isObj(src.settings)) {
    const s = src.settings as Partial<Settings>;
    base.settings = {
      ...defaultSettings,
      ...s,
      notifications: { ...defaultSettings.notifications, ...(isObj(s.notifications) ? s.notifications : {}) },
      spotify: { ...defaultSettings.spotify, ...(isObj(s.spotify) ? s.spotify : {}) },
      nutritionGoals: {
        kcal: goalNumber(isObj(s.nutritionGoals) ? s.nutritionGoals.kcal : null, 10000),
        protein: goalNumber(isObj(s.nutritionGoals) ? s.nutritionGoals.protein : null, 1000),
        carbs: goalNumber(isObj(s.nutritionGoals) ? s.nutritionGoals.carbs : null, 1500),
        fat: goalNumber(isObj(s.nutritionGoals) ? s.nutritionGoals.fat : null, 1000),
      },
      quickLinks: Array.isArray(s.quickLinks) ? s.quickLinks : [],
    };
  }
  base.version = STORE_VERSION;
  return base;
}

interface StoreState {
  data: AppData;
  hydrated: boolean;
  setHydrated: () => void;
  mutate: (recipe: (draft: AppData) => void) => void;
  replaceAll: (data: AppData) => void;
  resetAll: () => void;
}

export const useAppStore = create<StoreState>()(
  persist(
    (set) => ({
      data: createEmptyData(),
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      mutate: (recipe) =>
        set((state) => ({ data: produce(state.data, (draft) => { recipe(draft); }) })),
      replaceAll: (data) => {
        set({ data: normalizeData(data) });
        forceFlush();
      },
      resetAll: () => {
        set({ data: createEmptyData() });
        forceFlush();
      },
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => appStorage),
      partialize: (state) => ({ data: state.data }),
      merge: (persisted, current) => {
        const p = persisted as { data?: unknown } | undefined;
        return { ...current, data: normalizeData(p?.data) };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('[LifestyleOS] No se pudo restaurar el estado guardado:', error);
        state?.setHydrated();
      },
    },
  ),
);

/** Acceso imperativo al estado fuera de React (temporizadores, listeners). */
export const getData = (): AppData => useAppStore.getState().data;
export const mutateData = (recipe: (draft: AppData) => void): void => useAppStore.getState().mutate(recipe);
