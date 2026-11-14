/** Exportación e importación de datos: JSON completo y CSV por dominio. */
import type { AppData } from '@/types';
import { isoDate } from './date';
import { fmtNum } from './utils';

const download = (content: string, filename: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportBackup = (data: AppData): string => {
  const filename = `lifestyle-os-${isoDate()}.json`;
  download(JSON.stringify(data, null, 2), filename, 'application/json');
  try { localStorage.setItem('plos-last-backup', new Date().toISOString()); } catch { /* noop */ }
  return filename;
};

export const readBackup = async (file: File): Promise<unknown> => {
  const text = await file.text();
  return JSON.parse(text) as unknown;
};

const csvCell = (value: unknown): string => {
  const s = String(value ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

export const exportWorkoutsCsv = (data: AppData): string => {
  const rows: unknown[][] = [];
  data.sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      ex.sets.forEach((set, i) => {
        rows.push([s.date, s.name, ex.name, ex.muscleGroup, i + 1, set.weightKg ?? '', set.reps ?? '', set.completed ? 'sí' : 'no', set.rpe ?? '', ex.notes]);
      });
    });
  });
  const filename = `entrenamientos-${isoDate()}.csv`;
  download(toCsv(['fecha', 'rutina', 'ejercicio', 'grupo', 'serie', 'peso_kg', 'reps', 'completada', 'rpe', 'notas'], rows), filename, 'text/csv;charset=utf-8');
  return filename;
};

export const exportMealsCsv = (data: AppData): string => {
  const rows: unknown[][] = [];
  data.meals.forEach((m) => {
    m.items.forEach((item) => {
      rows.push([m.date, m.time, m.category, item.name, item.qty, item.unit, item.kcal ?? '', item.protein ?? '', item.carbs ?? '', item.fat ?? '', m.notes]);
    });
  });
  const filename = `nutricion-${isoDate()}.csv`;
  download(toCsv(['fecha', 'hora', 'comida', 'alimento', 'cantidad', 'unidad', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasas_g', 'notas'], rows), filename, 'text/csv;charset=utf-8');
  return filename;
};

export const exportHabitsCsv = (data: AppData): string => {
  const rows: unknown[][] = [];
  data.habits.forEach((h) => {
    data.habitLogs.filter((l) => l.habitId === h.id).forEach((l) => {
      rows.push([h.name, l.date, l.count, h.frequency.type]);
    });
  });
  const filename = `habitos-${isoDate()}.csv`;
  download(toCsv(['habito', 'fecha', 'marcas', 'frecuencia'], rows), filename, 'text/csv;charset=utf-8');
  return filename;
};

export const exportWeightsCsv = (data: AppData): string => {
  const rows: unknown[][] = [];
  [...data.weighIns]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((w) => rows.push([w.date, w.weightKg, w.note]));
  const filename = `pesajes-${isoDate()}.csv`;
  download(toCsv(['fecha', 'peso_kg', 'nota'], rows), filename, 'text/csv;charset=utf-8');
  return filename;
};

export const dataSizeKb = (data: AppData): number => {
  try {
    return Math.round(new Blob([JSON.stringify(data)]).size / 1024);
  } catch {
    return 0;
  }
};

export const countRecords = (data: AppData): Array<{ label: string; value: string }> => [
  { label: 'Hábitos', value: fmtNum(data.habits.length) },
  { label: 'Marcas de hábitos', value: fmtNum(data.habitLogs.length) },
  { label: 'Rutinas', value: fmtNum(data.routines.length) },
  { label: 'Sesiones', value: fmtNum(data.sessions.length) },
  { label: 'Comidas', value: fmtNum(data.meals.length) },
  { label: 'Favoritas y recetas', value: fmtNum(data.templates.length) },
  { label: 'Tareas', value: fmtNum(data.tasks.length) },
  { label: 'Notas', value: fmtNum(data.notes.length) },
  { label: 'Check-ins', value: fmtNum(data.checkins.length) },
  { label: 'Pesajes', value: fmtNum(data.weighIns.length) },
];
