/**
 * Modelo de dominio de Personal Lifestyle OS.
 *
 * Todo el estado vive en un único árbol serializable (`AppData`). La app lo
 * persiste en IndexedDB (con fallback a localStorage) a través de un adaptador
 * en `src/store/storage.ts`. Migrar a Supabase implica reemplazar ese adaptador
 * por una capa remota que guarde el mismo árbol (o tablas equivalentes): ni la
 * UI ni las estadísticas dependen del mecanismo de persistencia.
 */

export type ID = string;
/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;
/** Instante ISO 8601 completo. */
export type ISOInstant = string;

export type ThemeMode = 'dark' | 'light';
export type UnitSystem = 'metric' | 'imperial';
export type AccentTone = 'lime' | 'olive' | 'sage' | 'ice';

/* ------------------------------------------------------------------ perfil */

export interface Profile {
  name: string;
  /** Una línea sobre el foco actual ("Volumen", "Fuerza", "Recomposición"...). */
  focus: string;
  heightCm: number | null;
  weightKg: number | null;
  units: UnitSystem;
  /** Objetivo principal, en lenguaje libre. */
  goal: string;
}

export interface QuickLink {
  id: ID;
  label: string;
  url: string;
}

export interface NotificationSettings {
  enabled: boolean;
  restTimer: boolean;
  taskReminders: boolean;
  dailyCheckin: boolean;
}

export interface SpotifySettings {
  /** ID de playlist de Spotify (la parte final de open.spotify.com/playlist/<id>). */
  playlistId: string;
  /** URL completa, para abrir en la app o en el navegador. */
  playlistUrl: string;
  /** URL de una playlist personalizada para entrenar. */
  trainingPlaylistUrl: string;
}

export interface NutritionGoals {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface Settings {
  theme: ThemeMode;
  accent: AccentTone;
  weekStartsOn: 0 | 1;
  waterGoalMl: number;
  sleepGoalH: number;
  nutritionGoals: NutritionGoals;
  weeklyWorkoutGoal: number;
  restDefaultSec: number;
  autoRest: boolean;
  sound: boolean;
  notifications: NotificationSettings;
  spotify: SpotifySettings;
  quickLinks: QuickLink[];
}

/* ------------------------------------------------------------------ hábitos */

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'days'; days: number[] }
  | { type: 'weekly'; timesPerWeek: number };

export interface Habit {
  id: ID;
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  /** Hora sugerida HH:mm, opcional. */
  timeOfDay: string | null;
  /** Veces por día necesarias para considerarlo completo. */
  targetPerDay: number;
  archived: boolean;
  createdAt: ISOInstant;
  order: number;
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: ISODate;
  count: number;
  at: ISOInstant;
}

/* --------------------------------------------------------------------- gym */

export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Hombros',
  'Bíceps',
  'Tríceps',
  'Piernas',
  'Glúteos',
  'Core',
  'Cardio',
  'Cuerpo completo',
  'Otro',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface RoutineExercise {
  id: ID;
  name: string;
  muscleGroup: string;
  sets: number;
  /** Texto libre para permitir esquemas como "8-12", "10/8/6" o "AMRAP". */
  repsTarget: string;
  restSec: number;
  notes: string;
  order: number;
}

export interface Routine {
  id: ID;
  name: string;
  description: string;
  muscleGroups: string[];
  /** Día de la semana sugerido (0 = domingo). null = sin asignar. */
  weekday: number | null;
  exercises: RoutineExercise[];
  notes: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
  /** De dónde vino la rutina: "manual" o el nombre del archivo importado. */
  source: string;
}

export interface SessionSet {
  id: ID;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  rpe: number | null;
}

export interface SessionExercise {
  id: ID;
  routineExerciseId: ID | null;
  name: string;
  muscleGroup: string;
  targetSets: number;
  repsTarget: string;
  restSec: number;
  sets: SessionSet[];
  notes: string;
}

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface WorkoutSession {
  id: ID;
  routineId: ID | null;
  name: string;
  date: ISODate;
  startedAt: ISOInstant;
  finishedAt: ISOInstant | null;
  status: SessionStatus;
  exercises: SessionExercise[];
  notes: string;
}

/* --------------------------------------------------------------- nutrición */

export const MEAL_CATEGORIES = [
  'Desayuno',
  'Almuerzo',
  'Merienda',
  'Cena',
  'Snacks',
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export interface FoodItem {
  id: ID;
  name: string;
  qty: number;
  unit: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface Meal {
  id: ID;
  date: ISODate;
  time: string;
  category: MealCategory;
  items: FoodItem[];
  notes: string;
  createdAt: ISOInstant;
}

export interface MealTemplate {
  id: ID;
  name: string;
  kind: 'favorite' | 'recipe';
  items: FoodItem[];
  /** Para recetas: por cuántas porciones rinde. */
  servings: number;
  instructions: string;
  createdAt: ISOInstant;
}

export interface WaterEntry {
  id: ID;
  date: ISODate;
  at: ISOInstant;
  ml: number;
}

/* ----------------------------------------------------------- productividad */

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task {
  id: ID;
  title: string;
  notes: string;
  projectId: ID | null;
  categoryId: ID | null;
  priority: TaskPriority;
  dueDate: ISODate | null;
  status: TaskStatus;
  completedAt: ISOInstant | null;
  createdAt: ISOInstant;
  subtasks: Subtask[];
  estimatedMin: number | null;
}

export interface Project {
  id: ID;
  name: string;
  color: string;
  description: string;
  deadline: ISODate | null;
  status: 'active' | 'paused' | 'done';
}

export interface Category {
  id: ID;
  name: string;
  color: string;
}

export interface Note {
  id: ID;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export type BlockType = 'focus' | 'workout' | 'meal' | 'rest' | 'other';

export interface TimeBlock {
  id: ID;
  date: ISODate;
  start: string;
  end: string;
  label: string;
  type: BlockType;
  taskId: ID | null;
}

export interface WeeklyGoal {
  id: ID;
  /** Lunes de la semana, YYYY-MM-DD. */
  weekKey: ISODate;
  text: string;
  done: boolean;
}

export interface Pomodoro {
  id: ID;
  startedAt: ISOInstant;
  endedAt: ISOInstant;
  focusMin: number;
  mode: 'focus' | 'break' | 'long';
  taskId: ID | null;
  completed: boolean;
}

export interface WeighIn {
  id: ID;
  date: ISODate;
  weightKg: number;
  note: string;
}

export interface Checkin {
  id: ID;
  date: ISODate;
  sleepH: number | null;
  energy: number | null;
  mood: number | null;
  recovery: number | null;
  notes: string;
}

/* ------------------------------------------------------------------ estado */

export interface AppData {
  version: number;
  profile: Profile;
  settings: Settings;
  habits: Habit[];
  habitLogs: HabitLog[];
  routines: Routine[];
  sessions: WorkoutSession[];
  meals: Meal[];
  templates: MealTemplate[];
  water: WaterEntry[];
  tasks: Task[];
  projects: Project[];
  categories: Category[];
  notes: Note[];
  timeBlocks: TimeBlock[];
  weeklyGoals: WeeklyGoal[];
  pomodoros: Pomodoro[];
  checkins: Checkin[];
  weighIns: WeighIn[];
}

export type PageId =
  | 'overview'
  | 'gym'
  | 'nutrition'
  | 'habits'
  | 'productivity'
  | 'progress'
  | 'insights'
  | 'extensions'
  | 'settings';
