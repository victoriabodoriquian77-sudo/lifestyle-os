import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Habit, Meal, MealCategory, Note, Routine, Task, WeighIn } from '@/types';
import type { MealTemplate } from '@/types';
import { TaskModal, NoteModal } from './TaskNoteModals';
import { HabitModal } from './HabitModal';
import { MealModal, TemplateModal } from './MealModal';
import { RoutineModal } from './RoutineModal';
import { StartWorkoutModal, CheckinModal, GoalModal, WeighInModal } from './MiscModals';

interface ActionsApi {
  openTask: (task?: Task | null) => void;
  openMeal: (opts?: { meal?: Meal | null; date?: string; category?: MealCategory }) => void;
  openHabit: (habit?: Habit | null) => void;
  openNote: (note?: Note | null) => void;
  openRoutine: (routine?: Routine | null) => void;
  startWorkout: (routineId?: string | null) => void;
  openCheckin: (date?: string) => void;
  openWeighIn: (weighIn?: WeighIn | null) => void;
  openGoal: () => void;
  openTemplate: (kind: 'favorite' | 'recipe', template?: MealTemplate | null) => void;
}

const ActionsContext = createContext<ActionsApi | null>(null);

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const [meal, setMeal] = useState<{ meal?: Meal | null; date?: string; category?: MealCategory } | null>(null);
  const [habit, setHabit] = useState<Habit | null | undefined>(undefined);
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined);
  const [workout, setWorkout] = useState<{ open: boolean; routineId?: string | null }>({ open: false });
  const [checkin, setCheckin] = useState<{ open: boolean; date?: string }>({ open: false });
  const [weighIn, setWeighIn] = useState<WeighIn | null | undefined>(undefined);
  const [goal, setGoal] = useState(false);
  const [template, setTemplate] = useState<{ kind: 'favorite' | 'recipe'; template?: MealTemplate | null } | null>(null);

  const api = useMemo<ActionsApi>(
    () => ({
      openTask: (t) => setTask(t ?? null),
      openMeal: (opts) => setMeal(opts ?? { meal: null }),
      openHabit: (h) => setHabit(h ?? null),
      openNote: (n) => setNote(n ?? null),
      openRoutine: (r) => setRoutine(r ?? null),
      startWorkout: (routineId) => setWorkout({ open: true, routineId: routineId ?? null }),
      openCheckin: (date) => setCheckin({ open: true, date }),
      openWeighIn: (w) => setWeighIn(w ?? null),
      openGoal: () => setGoal(true),
      openTemplate: (kind, tpl) => setTemplate({ kind, template: tpl ?? null }),
    }),
    [],
  );

  return (
    <ActionsContext.Provider value={api}>
      {children}
      <TaskModal open={task !== undefined} task={task} onClose={() => setTask(undefined)} />
      <NoteModal open={note !== undefined} note={note} onClose={() => setNote(undefined)} />
      <HabitModal open={habit !== undefined} habit={habit} onClose={() => setHabit(undefined)} />
      <MealModal open={meal !== null} meal={meal?.meal} defaults={meal ? { date: meal.date, category: meal.category } : undefined} onClose={() => setMeal(null)} />
      <RoutineModal open={routine !== undefined} routine={routine} onClose={() => setRoutine(undefined)} />
      <StartWorkoutModal open={workout.open} routineId={workout.routineId} onClose={() => setWorkout({ open: false })} />
      <CheckinModal open={checkin.open} date={checkin.date} onClose={() => setCheckin({ open: false })} />
      <WeighInModal open={weighIn !== undefined} weighIn={weighIn} onClose={() => setWeighIn(undefined)} />
      <GoalModal open={goal} onClose={() => setGoal(false)} />
      <TemplateModal
        open={template !== null}
        kind={template?.kind ?? 'favorite'}
        template={template?.template}
        onClose={() => setTemplate(null)}
      />
    </ActionsContext.Provider>
  );
}

export const useActions = (): ActionsApi => {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useActions debe usarse dentro de <ActionsProvider>');
  return ctx;
};
