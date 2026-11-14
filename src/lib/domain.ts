/**
 * Operaciones de dominio. Reciben el draft de immer (`AppData`) y lo modifican.
 * Se usan desde los modales y desde el modo entrenamiento.
 */
import type {
  AppData, Checkin, Habit, HabitLog, ID, ISODate, Meal, MealCategory, Note, Profile,
  Routine, RoutineExercise, SessionExercise, SessionSet, Task, WaterEntry, WorkoutSession, WeeklyGoal, WeighIn,
} from '@/types';
import type { RoutineDraft } from './importer';
import { today, nowTime, isoDate, addDays, parseDate } from './date';
import { uid } from './utils';

/* ------------------------------------------------------------------ pesajes */

export const newWeighIn = (date: ISODate, weightKg: number, note = ''): WeighIn => ({
  id: uid('weigh'),
  date,
  weightKg: Math.round(weightKg * 10) / 10,
  note: note.trim(),
});

/** Peso del pesaje más reciente; si no hay, mantiene el del perfil. */
export const syncProfileWeight = (d: AppData): void => {
  const latest = [...d.weighIns].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest) d.profile.weightKg = latest.weightKg;
};

/* ------------------------------------------------------------------ hábitos */

export const toggleHabitOn = (d: AppData, habit: Habit, date: ISODate = today()): boolean => {
  const target = Math.max(1, habit.targetPerDay || 1);
  const existing = d.habitLogs.find((l) => l.habitId === habit.id && l.date === date);
  const current = existing?.count ?? 0;
  // Cada clic suma una marca; al llegar al objetivo, el siguiente clic desmarca.
  const next = current >= target ? 0 : current + 1;
  if (existing) existing.count = next;
  else if (next > 0) {
    d.habitLogs.push({ id: uid('hl'), habitId: habit.id, date, count: next, at: new Date().toISOString() });
  }
  return next >= target;
};

export const incrementHabit = (d: AppData, habit: Habit, date: ISODate = today(), delta = 1): void => {
  const target = Math.max(1, habit.targetPerDay || 1);
  const existing = d.habitLogs.find((l) => l.habitId === habit.id && l.date === date);
  if (existing) existing.count = Math.max(0, Math.min(target, existing.count + delta));
  else d.habitLogs.push({ id: uid('hl'), habitId: habit.id, date, count: Math.min(target, Math.max(0, delta)), at: new Date().toISOString() });
};

export const newHabit = (input: Partial<Habit> & { name: string }): Habit => ({
  id: uid('habit'),
  name: input.name,
  description: input.description ?? '',
  icon: input.icon ?? 'Circle',
  color: input.color ?? 'var(--accent)',
  frequency: input.frequency ?? { type: 'daily' },
  timeOfDay: input.timeOfDay ?? null,
  targetPerDay: input.targetPerDay ?? 1,
  archived: input.archived ?? false,
  createdAt: input.createdAt ?? new Date().toISOString(),
  order: input.order ?? Date.now(),
});

export const SUGGESTED_HABITS: Array<Pick<Habit, 'name' | 'description' | 'icon' | 'frequency'>> = [
  { name: 'Tomar suficiente agua', description: 'Repartida durante el día', icon: 'Droplets', frequency: { type: 'daily' } },
  { name: 'Entrenar', description: 'Sesión completa o movilidad', icon: 'Dumbbell', frequency: { type: 'days', days: [1, 2, 4, 5] } },
  { name: 'Caminar', description: 'Al menos 20 minutos', icon: 'Footprints', frequency: { type: 'daily' } },
  { name: 'Leer', description: '10 páginas o 15 minutos', icon: 'BookOpen', frequency: { type: 'daily' } },
  { name: 'Skincare AM', description: 'Rutina de la mañana', icon: 'Sun', frequency: { type: 'daily' } },
  { name: 'Skincare PM', description: 'Rutina de la noche', icon: 'Moon', frequency: { type: 'daily' } },
  { name: 'Cepillado dental', description: 'Después de cada comida', icon: 'Sparkles', frequency: { type: 'daily' } },
  { name: 'Estudiar', description: 'Bloque de foco sin distracciones', icon: 'GraduationCap', frequency: { type: 'daily' } },
  { name: 'Dormir adecuadamente', description: '7 a 9 horas', icon: 'BedDouble', frequency: { type: 'daily' } },
  { name: 'Desarrollo personal', description: 'Tiempo para crecer', icon: 'Compass', frequency: { type: 'daily' } },
  { name: 'Alimentación equilibrada', description: 'Variedad y regularidad', icon: 'Salad', frequency: { type: 'daily' } },
];

/* -------------------------------------------------------------------- agua */

export const addWater = (d: AppData, ml: number, date: ISODate = today()): void => {
  const entry: WaterEntry = { id: uid('water'), date, at: new Date().toISOString(), ml };
  d.water.push(entry);
};

export const subtractWater = (d: AppData, date: ISODate = today()): void => {
  const entries = d.water.filter((w) => w.date === date).sort((a, b) => (a.at < b.at ? 1 : -1));
  if (entries.length) d.water = d.water.filter((w) => w.id !== entries[0].id);
};

/* ------------------------------------------------------------------ comidas */

export const newMeal = (input: Partial<Meal> & { category: MealCategory }): Meal => ({
  id: uid('meal'),
  date: input.date ?? today(),
  time: input.time ?? nowTime(),
  category: input.category,
  items: input.items ?? [],
  notes: input.notes ?? '',
  createdAt: input.createdAt ?? new Date().toISOString(),
});

/* ----------------------------------------------------------------- tareas */

export const newTask = (input: Partial<Task> & { title: string }): Task => ({
  id: uid('task'),
  title: input.title,
  notes: input.notes ?? '',
  projectId: input.projectId ?? null,
  categoryId: input.categoryId ?? null,
  priority: input.priority ?? 'medium',
  dueDate: input.dueDate ?? null,
  status: input.status ?? 'todo',
  completedAt: input.completedAt ?? null,
  createdAt: input.createdAt ?? new Date().toISOString(),
  subtasks: input.subtasks ?? [],
  estimatedMin: input.estimatedMin ?? null,
});

export const toggleTaskDone = (_d: AppData, task: Task): void => {
  if (task.status === 'done') {
    task.status = 'todo';
    task.completedAt = null;
  } else {
    task.status = 'done';
    task.completedAt = new Date().toISOString();
  }
};

/* ------------------------------------------------------------------- notas */

export const newNote = (input: Partial<Note> & { title: string }): Note => ({
  id: uid('note'),
  title: input.title,
  body: input.body ?? '',
  tags: input.tags ?? [],
  pinned: input.pinned ?? false,
  createdAt: input.createdAt ?? new Date().toISOString(),
  updatedAt: input.updatedAt ?? new Date().toISOString(),
});

/* ------------------------------------------------------------------- rutinas */

export const newRoutineExercise = (input: Partial<RoutineExercise> & { name: string }): RoutineExercise => ({
  id: uid('rex'),
  name: input.name,
  muscleGroup: input.muscleGroup ?? 'Otro',
  sets: input.sets ?? 3,
  repsTarget: input.repsTarget ?? '10',
  restSec: input.restSec ?? 90,
  notes: input.notes ?? '',
  order: input.order ?? 0,
});

export const routineFromDraft = (draft: RoutineDraft): Routine => {
  const now = new Date().toISOString();
  return {
    id: uid('routine'),
    name: draft.name,
    description: draft.description,
    muscleGroups: draft.muscleGroups,
    weekday: draft.weekday,
    exercises: draft.exercises.map((e, i) => newRoutineExercise({ ...e, order: i })),
    notes: '',
    createdAt: now,
    updatedAt: now,
    source: draft.source,
  };
};

export const duplicateRoutine = (routine: Routine): Routine => ({
  ...routine,
  id: uid('routine'),
  name: `${routine.name} (copia)`,
  exercises: routine.exercises.map((e) => ({ ...e, id: uid('rex') })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/* --------------------------------------------------------------- sesiones */

const emptySet = (): SessionSet => ({ id: uid('set'), weightKg: null, reps: null, completed: false, rpe: null });

export const sessionFromRoutine = (routine: Routine, date: ISODate, previous?: WorkoutSession | null): WorkoutSession => {
  const exercises: SessionExercise[] = routine.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ex) => {
      const prevEx = previous?.exercises.find((p) => p.name.trim().toLowerCase() === ex.name.trim().toLowerCase());
      const lastBest = prevEx
        ? Math.max(0, ...prevEx.sets.filter((s) => s.completed).map((s) => s.weightKg ?? 0))
        : 0;
      return {
        id: uid('sex'),
        routineExerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        targetSets: ex.sets,
        repsTarget: ex.repsTarget,
        restSec: ex.restSec,
        notes: '',
        sets: Array.from({ length: Math.max(1, ex.sets) }, () => ({
          ...emptySet(),
          weightKg: lastBest > 0 ? lastBest : null,
        })),
      };
    });
  return {
    id: uid('session'),
    routineId: routine.id,
    name: routine.name,
    date,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'active',
    exercises,
    notes: '',
  };
};

export const startSession = (d: AppData, routine: Routine, date: ISODate = today()): WorkoutSession => {
  // Solo puede haber una sesión activa a la vez.
  d.sessions.forEach((s) => {
    if (s.status === 'active') {
      s.status = 'abandoned';
      s.finishedAt = new Date().toISOString();
    }
  });
  const previous = d.sessions
    .filter((s) => s.status === 'completed' && s.routineId === routine.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .pop();
  const session = sessionFromRoutine(routine, date, previous ?? null);
  d.sessions.push(session);
  return session;
};

export const finishSession = (d: AppData, sessionId: ID): WorkoutSession | null => {
  const session = d.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  session.status = 'completed';
  session.finishedAt = new Date().toISOString();
  return session;
};

export const sessionIsEmpty = (session: WorkoutSession): boolean => session.exercises.every((e) => e.sets.every((s) => !s.completed));

/* --------------------------------------------------------------- bienestar */

export const upsertCheckin = (d: AppData, date: ISODate, patch: Partial<Checkin>): Checkin => {
  const existing = d.checkins.find((c) => c.date === date);
  if (existing) {
    Object.assign(existing, patch, { date });
    return existing;
  }
  const checkin: Checkin = {
    id: uid('checkin'), date, sleepH: null, energy: null, mood: null, recovery: null, notes: '',
    ...patch,
  };
  d.checkins.push(checkin);
  return checkin;
};

/* ------------------------------------------------------------------ perfil */

export const updateProfile = (d: AppData, patch: Partial<Profile>): void => {
  Object.assign(d.profile, patch);
};

/* --------------------------------------------------------------- objetivos */

export const newWeeklyGoal = (weekKey: ISODate, text: string): WeeklyGoal => ({
  id: uid('goal'),
  weekKey,
  text,
  done: false,
});

/* --------------------------------------------------------------- utilidades */

export const pruneOldData = (d: AppData, days = 730): void => {
  const cutoff = addDays(today(), -days);
  d.habitLogs = d.habitLogs.filter((l: HabitLog) => l.date >= cutoff);
  d.water = d.water.filter((w) => w.date >= cutoff);
};

export const isoToday = (): string => isoDate(new Date());

export const dateFromOffset = (offset: number): ISODate => addDays(today(), offset);

export const parseLocalDate = (iso: ISODate): Date => parseDate(iso);
