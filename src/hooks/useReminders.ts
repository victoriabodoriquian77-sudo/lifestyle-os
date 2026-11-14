import { useEffect } from 'react';
import { useAppStore } from '@/store/store';
import { notify } from '@/lib/sound';
import { isTaskOverdue } from '@/lib/metrics';
import { today } from '@/lib/date';

const KEY = 'plos-reminders-v1';
const SIX_HOURS = 6 * 60 * 60 * 1000;

type ReminderState = { tasksAt?: number; checkinDate?: string };

const read = (): ReminderState => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ReminderState; } catch { return {}; }
};
const write = (state: ReminderState): void => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
};

/**
 * Recordatorios discretos al abrir la app. Nunca se programan en background:
 * el navegador solo permite notificaciones mientras la app está abierta.
 */
export function useReminders(): void {
  const hydrated = useAppStore((s) => s.hydrated);
  const data = useAppStore((s) => s.data);

  useEffect(() => {
    if (!hydrated) return;
    const n = data.settings.notifications;
    if (!n.enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const state = read();
    const now = Date.now();
    const t = today();

    const overdue = data.tasks.filter((x) => x.status !== 'done' && isTaskOverdue(x, t)).length;
    if (n.taskReminders && overdue > 0 && (!state.tasksAt || now - state.tasksAt > SIX_HOURS)) {
      notify('Tareas vencidas', `${overdue} ${overdue === 1 ? 'tarea sigue pendiente' : 'tareas siguen pendientes'}. Abrí Productivity para reorganizarlas.`);
      state.tasksAt = now;
    }

    const hasCheckinToday = data.checkins.some((c) => c.date === t);
    if (n.dailyCheckin && new Date().getHours() >= 18 && !hasCheckinToday && state.checkinDate !== t) {
      notify('Check-in de bienestar', '¿Cómo dormiste y cómo está tu energía hoy?');
      state.checkinDate = t;
    }

    write(state);
    // Solo al hidratar: no repetir en cada cambio de datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
}
