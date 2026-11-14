/**
 * Motor de métricas. Funciones puras: reciben `AppData` y devuelven números o
 * series listas para graficar. Nada se inventa: si no hay datos, se devuelve
 * cero / lista vacía y la UI muestra un estado vacío.
 */
import type {
  AppData, Habit, ISODate, Meal, WorkoutSession, WorkoutSession as Session,
  Task, Checkin, Pomodoro, TimeBlock,
} from '@/types';
import { addDays, diffDays, eachDay, isoDate, localDayFromISO, parseDate, startOfWeek, today as todayFn, weekday } from './date';
import { avg, clamp, pct, sum } from './utils';

export type RangeKey = '7' | '30' | '90' | '180' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = {
  '7': 'Últimos 7 días',
  '30': 'Últimos 30 días',
  '90': 'Últimos 90 días',
  '180': 'Últimos 6 meses',
  all: 'Todo el historial',
};

export const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7': 7, '30': 30, '90': 90, '180': 180 };

/** Fecha del registro más antiguo presente en la app. */
export const dataStartDate = (data: AppData): ISODate => {
  const dates: string[] = [
    ...data.sessions.map((s) => s.date),
    ...data.meals.map((m) => m.date),
    ...data.habitLogs.map((l) => l.date),
    ...data.tasks.map((t) => localDayFromISO(t.createdAt)),
    ...data.water.map((w) => w.date),
    ...data.checkins.map((c) => c.date),
    ...data.pomodoros.map((p) => localDayFromISO(p.startedAt)),
  ].filter(Boolean);
  if (!dates.length) return todayFn();
  return dates.sort()[0];
};

export const rangeBounds = (key: RangeKey, t: ISODate = todayFn()): { from: ISODate; to: ISODate; days: number } => {
  if (key === 'all') {
    const from = addDays(t, -364);
    return { from, to: t, days: diffDays(from, t) + 1 };
  }
  const days = RANGE_DAYS[key];
  return { from: addDays(t, -(days - 1)), to: t, days };
};

/* ------------------------------------------------------------------ hábitos */

export interface HabitDayStatus {
  scheduled: boolean;
  count: number;
  target: number;
  done: boolean;
}

export const habitTargetFor = (habit: Habit): number => Math.max(1, habit.targetPerDay || 1);

/** ¿El hábito corresponde a ese día según su frecuencia? */
export const isHabitScheduled = (habit: Habit, date: ISODate): boolean => {
  if (habit.archived) return false;
  if (habit.frequency.type === 'daily') return true;
  if (habit.frequency.type === 'days') return habit.frequency.days.includes(weekday(date));
  return true; // semanal: cualquier día cuenta para el objetivo de la semana
};

export const habitCountOn = (data: AppData, habitId: string, date: ISODate): number => {
  const logs = data.habitLogs.filter((l) => l.habitId === habitId && l.date === date);
  return logs.length ? Math.max(...logs.map((l) => l.count)) : 0;
};

export const habitDayStatus = (data: AppData, habit: Habit, date: ISODate): HabitDayStatus => {
  const target = habitTargetFor(habit);
  const count = habitCountOn(data, habit.id, date);
  return { scheduled: isHabitScheduled(habit, date), count, target, done: count >= target };
};

/** Progreso de hábitos de un día: solo cuenta hábitos diarios o de días fijos. */
export const dayHabitProgress = (data: AppData, date: ISODate): { scheduled: number; done: number; pct: number } => {
  const scheduledHabits = data.habits.filter(
    (h) => !h.archived && (h.frequency.type === 'daily' || h.frequency.type === 'days') && isHabitScheduled(h, date),
  );
  const done = scheduledHabits.filter((h) => habitCountOn(data, h.id, date) >= habitTargetFor(h)).length;
  return { scheduled: scheduledHabits.length, done, pct: pct(done, scheduledHabits.length) };
};

/** Racha de días consecutivos cumpliendo (para hábitos diarios / por días). */
export const habitStreak = (data: AppData, habit: Habit, t: ISODate = todayFn()): number => {
  if (habit.frequency.type === 'weekly') return habitWeeklyStreak(data, habit, t);
  let streak = 0;
  let cursor = t;
  // Si hoy todavía no se cumplió, la racha se cuenta desde ayer (no se rompe).
  const todayDone = habitCountOn(data, habit.id, cursor) >= habitTargetFor(habit);
  if (!todayDone) cursor = addDays(cursor, -1);
  for (let i = 0; i < 730; i++) {
    if (!isHabitScheduled(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habitCountOn(data, habit.id, cursor) >= habitTargetFor(habit)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else break;
  }
  return streak;
};

export const habitWeeklyStreak = (data: AppData, habit: Habit, t: ISODate = todayFn()): number => {
  if (habit.frequency.type !== 'weekly') return 0;
  const target = habit.frequency.timesPerWeek;
  let weeks = 0;
  let weekStart = startOfWeek(t, 1);
  for (let i = 0; i < 104; i++) {
    const days = eachDay(weekStart, addDays(weekStart, 6));
    const hits = days.filter((d) => habitCountOn(data, habit.id, d) > 0).length;
    if (hits >= target) weeks++;
    else if (i === 0 && weekStart === startOfWeek(t, 1) && hits < target) {
      // la semana en curso aún puede completarse: no corta la racha
    } else break;
    weekStart = addDays(weekStart, -7);
  }
  return weeks;
};

export const habitRangeStats = (
  data: AppData,
  habit: Habit,
  from: ISODate,
  to: ISODate,
): { scheduled: number; completed: number; rate: number; total: number; activeDays: number } => {
  const days = eachDay(from, to);
  if (habit.frequency.type === 'weekly') {
    const target = habit.frequency.timesPerWeek;
    const weeks = new Map<string, number>();
    for (const d of days) {
      const k = startOfWeek(d, 1);
      const hits = weeks.get(k) ?? 0;
      if (habitCountOn(data, habit.id, d) > 0) weeks.set(k, hits + 1);
      else weeks.set(k, hits);
    }
    const complete = [...weeks.values()].filter((v) => v >= target).length;
    const total = weeks.size * target;
    const done = sum([...weeks.values()].map((v) => Math.min(v, target)));
    return { scheduled: weeks.size, completed: complete, rate: pct(done, total), total, activeDays: complete };
  }
  const scheduledDays = days.filter((d) => isHabitScheduled(habit, d));
  const completed = scheduledDays.filter((d) => habitCountOn(data, habit.id, d) >= habitTargetFor(habit)).length;
  return {
    scheduled: scheduledDays.length,
    completed,
    rate: pct(completed, scheduledDays.length),
    total: scheduledDays.length,
    activeDays: completed,
  };
};

/** Consistencia global de hábitos en un rango (todos los hábitos activos). */
export const overallHabitConsistency = (data: AppData, from: ISODate, to: ISODate): number => {
  const habits = data.habits.filter((h) => !h.archived);
  if (!habits.length) return 0;
  const rates = habits.map((h) => habitRangeStats(data, h, from, to).rate).filter((r) => r > 0 || true);
  return avg(rates);
};

export const habitCalendar = (data: AppData, habit: Habit, from: ISODate, to: ISODate): Array<{ date: ISODate; done: boolean; scheduled: boolean }> =>
  eachDay(from, to).map((date) => {
    const scheduled = isHabitScheduled(habit, date);
    return { date, scheduled, done: scheduled && habitCountOn(data, habit.id, date) >= habitTargetFor(habit) };
  });

/* ---------------------------------------------------------------------- gym */

export const sessionVolume = (s: Session): number =>
  s.exercises.reduce(
    (total, ex) =>
      total + ex.sets.reduce((t, set) => (set.completed && set.weightKg != null && set.reps != null ? t + set.weightKg * set.reps : t), 0),
    0,
  );

export const sessionSetCount = (s: Session): number => s.exercises.reduce((t, ex) => t + ex.sets.filter((x) => x.completed).length, 0);
export const sessionPlannedSets = (s: Session): number => s.exercises.reduce((t, ex) => t + ex.sets.length, 0);
export const sessionTopWeight = (s: Session): number =>
  Math.max(0, ...s.exercises.flatMap((ex) => ex.sets.filter((x) => x.completed).map((x) => x.weightKg ?? 0)));

/** 1RM estimado (Epley). Solo referencial, para comparar tendencia. */
export const e1rm = (weight: number, reps: number): number => (reps <= 1 ? weight : weight * (1 + reps / 30));

export const completedSessions = (data: AppData): WorkoutSession[] =>
  data.sessions.filter((s) => s.status === 'completed').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

export const sessionsInRange = (data: AppData, from: ISODate, to: ISODate): WorkoutSession[] =>
  completedSessions(data).filter((s) => s.date >= from && s.date <= to);

export const sessionDurationSec = (s: Session): number => {
  if (!s.finishedAt) return 0;
  return Math.max(0, (new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 1000);
};

export interface ExercisePoint {
  date: ISODate;
  topWeight: number;
  volume: number;
  e1rm: number;
  reps: number;
  sets: number;
}

export const exerciseSeries = (data: AppData, exerciseName: string): ExercisePoint[] => {
  const key = exerciseName.trim().toLowerCase();
  const points: ExercisePoint[] = [];
  for (const s of completedSessions(data)) {
    const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === key);
    if (!ex) continue;
    const sets = ex.sets.filter((x) => x.completed);
    if (!sets.length) continue;
    const weights = sets.map((x) => x.weightKg ?? 0).filter((w) => w > 0);
    const reps = sum(sets.map((x) => x.reps ?? 0));
    const volume = sets.reduce((t, x) => t + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
    const bestE = Math.max(0, ...sets.filter((x) => x.weightKg && x.reps).map((x) => e1rm(x.weightKg!, x.reps!)));
    points.push({
      date: s.date,
      topWeight: weights.length ? Math.max(...weights) : 0,
      volume,
      e1rm: bestE,
      reps,
      sets: sets.length,
    });
  }
  return points;
};

export const exerciseNames = (data: AppData): string[] => {
  const names = new Set<string>();
  data.routines.forEach((r) => r.exercises.forEach((e) => names.add(e.name.trim())));
  data.sessions.forEach((s) => s.exercises.forEach((e) => names.add(e.name.trim())));
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
};

export interface PersonalRecord {
  name: string;
  muscleGroup: string;
  bestWeight: number;
  bestWeightDate: ISODate | null;
  bestE1rm: number;
  bestE1rmDate: ISODate | null;
  bestSetVolume: number;
  bestSetVolumeDate: ISODate | null;
  sessions: number;
  lastDate: ISODate | null;
  lastWeight: number;
}

export const personalRecords = (data: AppData): PersonalRecord[] => {
  const map = new Map<string, PersonalRecord>();
  for (const s of completedSessions(data)) {
    for (const ex of s.exercises) {
      const name = ex.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const rec = map.get(key) ?? {
        name,
        muscleGroup: ex.muscleGroup || 'Otro',
        bestWeight: 0,
        bestWeightDate: null,
        bestE1rm: 0,
        bestE1rmDate: null,
        bestSetVolume: 0,
        bestSetVolumeDate: null,
        sessions: 0,
        lastDate: null,
        lastWeight: 0,
      };
      rec.sessions += 1;
      if (!rec.lastDate || s.date >= rec.lastDate) rec.lastDate = s.date;
      for (const set of ex.sets) {
        if (!set.completed || !set.weightKg || !set.reps) continue;
        if (set.weightKg > rec.bestWeight) {
          rec.bestWeight = set.weightKg;
          rec.bestWeightDate = s.date;
        }
        const est = e1rm(set.weightKg, set.reps);
        if (est > rec.bestE1rm) {
          rec.bestE1rm = est;
          rec.bestE1rmDate = s.date;
        }
        const vol = set.weightKg * set.reps;
        if (vol > rec.bestSetVolume) {
          rec.bestSetVolume = vol;
          rec.bestSetVolumeDate = s.date;
        }
        if (s.date >= (rec.lastDate ?? s.date)) rec.lastWeight = set.weightKg;
      }
      map.set(key, rec);
    }
  }
  return [...map.values()].sort((a, b) => b.bestWeight - a.bestWeight);
};

/** Sesiones en las que se superó el récord de peso de un ejercicio. */
export const prEventsInSession = (data: AppData, session: Session): string[] => {
  const previous = new Map<string, number>();
  for (const s of completedSessions(data)) {
    if (s.date >= session.date && s.id !== session.id) continue;
    if (s.id === session.id) continue;
    for (const ex of s.exercises) {
      const best = Math.max(0, ...ex.sets.filter((x) => x.completed).map((x) => x.weightKg ?? 0));
      const k = ex.name.trim().toLowerCase();
      previous.set(k, Math.max(previous.get(k) ?? 0, best));
    }
  }
  const prs: string[] = [];
  for (const ex of session.exercises) {
    const best = Math.max(0, ...ex.sets.filter((x) => x.completed).map((x) => x.weightKg ?? 0));
    const k = ex.name.trim().toLowerCase();
    if (best > 0 && best > (previous.get(k) ?? 0)) prs.push(ex.name);
  }
  return [...new Set(prs)];
};

export const weeklyWorkouts = (data: AppData, weeks = 6, t: ISODate = todayFn()): Array<{ weekStart: ISODate; count: number; volume: number; label: string }> => {
  const currentStart = startOfWeek(t, 1);
  const out: Array<{ weekStart: ISODate; count: number; volume: number; label: string }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(currentStart, -7 * i);
    const to = addDays(from, 6);
    const sessions = sessionsInRange(data, from, to);
    out.push({
      weekStart: from,
      count: sessions.length,
      volume: Math.round(sum(sessions.map(sessionVolume))),
      label: `${parseDate(from).getDate()}/${parseDate(from).getMonth() + 1}`,
    });
  }
  return out;
};

/** Semanas consecutivas con al menos una sesión completada. */
export const workoutWeekStreak = (data: AppData, t: ISODate = todayFn()): number => {
  let streak = 0;
  let start = startOfWeek(t, 1);
  for (let i = 0; i < 156; i++) {
    const end = addDays(start, 6);
    const count = sessionsInRange(data, start, end).length;
    const isCurrent = i === 0;
    if (count > 0) streak++;
    else if (!isCurrent) break;
    start = addDays(start, -7);
  }
  return streak;
};

export const muscleGroupVolume = (data: AppData, from: ISODate, to: ISODate): Array<{ group: string; volume: number; sets: number }> => {
  const map = new Map<string, { volume: number; sets: number }>();
  for (const s of sessionsInRange(data, from, to)) {
    for (const ex of s.exercises) {
      const g = ex.muscleGroup || 'Otro';
      const cur = map.get(g) ?? { volume: 0, sets: 0 };
      for (const set of ex.sets.filter((x) => x.completed)) {
        cur.volume += (set.weightKg ?? 0) * (set.reps ?? 0);
        cur.sets += 1;
      }
      map.set(g, cur);
    }
  }
  return [...map.entries()]
    .map(([group, v]) => ({ group, ...v }))
    .sort((a, b) => b.volume - a.volume);
};

export const lastSessionForRoutine = (data: AppData, routineId: string): Session | null => {
  const sessions = completedSessions(data).filter((s) => s.routineId === routineId);
  return sessions.length ? sessions[sessions.length - 1] : null;
};

export const lastExercisePerformance = (data: AppData, exerciseName: string): { date: ISODate; weight: number; reps: number } | null => {
  const key = exerciseName.trim().toLowerCase();
  const sessions = completedSessions(data).slice().reverse();
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === key);
    if (!ex) continue;
    const sets = ex.sets.filter((x) => x.completed && x.weightKg != null);
    if (!sets.length) continue;
    const best = sets.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a));
    return { date: s.date, weight: best.weightKg ?? 0, reps: best.reps ?? 0 };
  }
  return null;
};

/* ----------------------------------------------------------------- nutrición */

export interface NutritionTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: number;
  meals: number;
}

export const mealTotals = (meal: Meal): NutritionTotals => ({
  kcal: sum(meal.items.map((i) => i.kcal ?? 0)),
  protein: sum(meal.items.map((i) => i.protein ?? 0)),
  carbs: sum(meal.items.map((i) => i.carbs ?? 0)),
  fat: sum(meal.items.map((i) => i.fat ?? 0)),
  items: meal.items.length,
  meals: 1,
});

export const dayNutrition = (data: AppData, date: ISODate): NutritionTotals => {
  const meals = data.meals.filter((m) => m.date === date);
  return meals.reduce<NutritionTotals>(
    (acc, m) => {
      const t = mealTotals(m);
      return {
        kcal: acc.kcal + t.kcal,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
        items: acc.items + t.items,
        meals: acc.meals + 1,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, items: 0, meals: 0 },
  );
};

export interface NutritionPoint extends NutritionTotals { date: ISODate }

export const nutritionSeries = (data: AppData, from: ISODate, to: ISODate): NutritionPoint[] =>
  eachDay(from, to).map((date) => ({ date, ...dayNutrition(data, date) }));

export const waterDay = (data: AppData, date: ISODate): number => sum(data.water.filter((w) => w.date === date).map((w) => w.ml));

export const waterSeries = (data: AppData, from: ISODate, to: ISODate): Array<{ date: ISODate; ml: number }> =>
  eachDay(from, to).map((date) => ({ date, ml: waterDay(data, date) }));

/* -------------------------------------------------------------- productividad */

export const isTaskOverdue = (task: Task, t: ISODate = todayFn()): boolean =>
  task.status !== 'done' && !!task.dueDate && task.dueDate < t;

export const tasksDueOn = (data: AppData, date: ISODate): Task[] =>
  data.tasks.filter((t) => t.dueDate === date);

export const taskStats = (data: AppData, from: ISODate, to: ISODate) => {
  const completed = data.tasks.filter((t) => t.status === 'done' && t.completedAt && localDayFromISO(t.completedAt) >= from && localDayFromISO(t.completedAt) <= to);
  const created = data.tasks.filter((t) => localDayFromISO(t.createdAt) >= from && localDayFromISO(t.createdAt) <= to);
  const overdue = data.tasks.filter((t) => isTaskOverdue(t));
  const open = data.tasks.filter((t) => t.status !== 'done');
  const doneTotal = data.tasks.filter((t) => t.status === 'done').length;
  return {
    completed: completed.length,
    created: created.length,
    overdue: overdue.length,
    open: open.length,
    doneTotal,
    completionRate: pct(doneTotal, data.tasks.length),
    highPriorityOpen: open.filter((t) => t.priority === 'high').length,
  };
};

export const completedPerDay = (data: AppData, from: ISODate, to: ISODate): Array<{ date: ISODate; count: number }> => {
  const map = new Map<string, number>();
  for (const t of data.tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const d = localDayFromISO(t.completedAt);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return eachDay(from, to).map((date) => ({ date, count: map.get(date) ?? 0 }));
};

export const focusMinutes = (data: AppData, from: ISODate, to: ISODate): number =>
  sum(
    data.pomodoros
      .filter((p) => p.completed && p.mode === 'focus')
      .filter((p) => {
        const d = localDayFromISO(p.startedAt);
        return d >= from && d <= to;
      })
      .map((p) => p.focusMin),
  );

export const focusPerDay = (data: AppData, from: ISODate, to: ISODate): Array<{ date: ISODate; minutes: number }> => {
  const map = new Map<string, number>();
  for (const p of data.pomodoros) {
    if (!p.completed || p.mode !== 'focus') continue;
    const d = localDayFromISO(p.startedAt);
    map.set(d, (map.get(d) ?? 0) + p.focusMin);
  }
  return eachDay(from, to).map((date) => ({ date, minutes: map.get(date) ?? 0 }));
};

export const pomodoroSessions = (data: AppData, from: ISODate, to: ISODate): Pomodoro[] =>
  data.pomodoros.filter((p) => {
    const d = localDayFromISO(p.startedAt);
    return d >= from && d <= to && p.completed;
  });

export const weeklyGoalProgress = (data: AppData, week: ISODate): { total: number; done: number; pct: number } => {
  const goals = data.weeklyGoals.filter((g) => g.weekKey === week);
  const done = goals.filter((g) => g.done).length;
  return { total: goals.length, done, pct: pct(done, goals.length) };
};

export const blockMinutesByType = (data: AppData, from: ISODate, to: ISODate): Array<{ type: TimeBlock['type']; minutes: number }> => {
  const map = new Map<TimeBlock['type'], number>();
  for (const b of data.timeBlocks) {
    if (b.date < from || b.date > to) continue;
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    const mins = Math.max(0, toMin(b.end) - toMin(b.start));
    map.set(b.type, (map.get(b.type) ?? 0) + mins);
  }
  return [...map.entries()].map(([type, minutes]) => ({ type, minutes }));
};

/* --------------------------------------------------------------- bienestar */

export interface WellbeingPoint {
  date: ISODate;
  sleepH: number | null;
  energy: number | null;
  mood: number | null;
  recovery: number | null;
}

export const wellbeingSeries = (data: AppData, from: ISODate, to: ISODate): WellbeingPoint[] => {
  const byDate = new Map<string, Checkin>();
  data.checkins.forEach((c) => byDate.set(c.date, c));
  return eachDay(from, to).map((date) => {
    const c = byDate.get(date);
    return {
      date,
      sleepH: c?.sleepH ?? null,
      energy: c?.energy ?? null,
      mood: c?.mood ?? null,
      recovery: c?.recovery ?? null,
    };
  });
};

export const checkinAverages = (data: AppData, from: ISODate, to: ISODate) => {
  const items = data.checkins.filter((c) => c.date >= from && c.date <= to);
  const pick = (k: 'sleepH' | 'energy' | 'mood' | 'recovery') =>
    avg(items.map((c) => c[k]).filter((v): v is number => v != null));
  return {
    nights: items.length,
    sleepH: pick('sleepH'),
    energy: pick('energy'),
    mood: pick('mood'),
    recovery: pick('recovery'),
  };
};

/* ---------------------------------------------------------- score del día */

export interface DayScoreComponent {
  key: string;
  label: string;
  value: number;
  weight: number;
  applicable: boolean;
  detail: string;
}

export const dayScore = (data: AppData, date: ISODate): { score: number; components: DayScoreComponent[] } => {
  const habits = dayHabitProgress(data, date);
  const water = waterDay(data, date);
  const waterGoal = data.settings.waterGoalMl;
  const nutrition = dayNutrition(data, date);
  const dueTasks = data.tasks.filter((t) => t.dueDate === date);
  const tasksDone = dueTasks.filter((t) => t.status === 'done').length;
  const workout = data.sessions.find((s) => s.date === date && s.status === 'completed');

  const components: DayScoreComponent[] = [
    {
      key: 'habits', label: 'Hábitos', weight: 35, applicable: habits.scheduled > 0,
      value: habits.pct, detail: `${habits.done}/${habits.scheduled}`,
    },
    {
      key: 'training', label: 'Entrenamiento', weight: 25, applicable: workout != null,
      value: workout ? 100 : 0, detail: workout ? workout.name : 'sin sesión',
    },
    {
      key: 'water', label: 'Agua', weight: 15, applicable: water > 0 || waterGoal > 0,
      value: pct(water, waterGoal), detail: `${Math.round(water)}/${waterGoal} ml`,
    },
    {
      key: 'nutrition', label: 'Comidas', weight: 15, applicable: nutrition.meals > 0,
      value: pct(nutrition.meals, 3), detail: `${nutrition.meals} registradas`,
    },
    {
      key: 'tasks', label: 'Tareas', weight: 10, applicable: dueTasks.length > 0,
      value: pct(tasksDone, dueTasks.length), detail: `${tasksDone}/${dueTasks.length}`,
    },
  ];

  const active = components.filter((c) => c.applicable);
  const weightSum = sum(active.map((c) => c.weight));
  const raw = weightSum ? sum(active.map((c) => c.value * c.weight)) / weightSum : 0;
  return { score: clamp(Math.round(raw), 0, 100), components };
};

/* ------------------------------------------------------------ progreso global */

export const consistencyIndex = (data: AppData, from: ISODate, to: ISODate): number => {
  const days = Math.max(1, diffDays(from, to) + 1);
  const habit = overallHabitConsistency(data, from, to);
  const sessions = sessionsInRange(data, from, to).length;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const training = pct(sessions, weeks * data.settings.weeklyWorkoutGoal);
  const tasks = taskStats(data, from, to);
  const taskRate = pct(tasks.completed, Math.max(1, tasks.created));
  return Math.round(avg([habit, training, taskRate]));
};

export const lastNDates = (n: number, t: ISODate = todayFn()): ISODate[] => eachDay(addDays(t, -(n - 1)), t);

export const todayISO = (): ISODate => isoDate(new Date());
