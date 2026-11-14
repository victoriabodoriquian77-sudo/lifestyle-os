/** Fechas locales. Se trabaja siempre con YYYY-MM-DD para evitar saltos de zona horaria. */
import type { ISODate } from '@/types';

export const isoDate = (d: Date = new Date()): ISODate => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const today = (): ISODate => isoDate(new Date());

/** Día local a partir de un timestamp ISO (evita el corrimiento UTC). */
export const localDayFromISO = (iso: string): ISODate => isoDate(new Date(iso));

export const parseDate = (iso: ISODate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
};

export const addDays = (iso: ISODate, days: number): ISODate => {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/** Diferencia en días calendario (b - a). */
export const diffDays = (a: ISODate, b: ISODate): number => {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
};

export const startOfWeek = (iso: ISODate = today(), weekStartsOn: 0 | 1 = 1): ISODate => {
  const d = parseDate(iso);
  const dow = d.getDay();
  const delta = weekStartsOn === 1 ? (dow === 0 ? -6 : 1 - dow) : -dow;
  d.setDate(d.getDate() + delta);
  return isoDate(d);
};

export const weekKey = (iso: ISODate = today()): ISODate => startOfWeek(iso, 1);

export const weekDays = (start: ISODate): ISODate[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const eachDay = (from: ISODate, to: ISODate): ISODate[] => {
  const out: ISODate[] = [];
  const len = diffDays(from, to);
  for (let i = 0; i <= len; i++) out.push(addDays(from, i));
  return out;
};

export const isFuture = (iso: ISODate): boolean => iso > today();
export const isPast = (iso: ISODate): boolean => iso < today();

export const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const WEEKDAY_MIN = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export const MONTH_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const fmtDateLong = (iso: ISODate): string => {
  const d = parseDate(iso);
  return `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} de ${MONTH_LONG[d.getMonth()].toLowerCase()}`;
};

export const fmtDateShort = (iso: ISODate): string => {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTH_LONG[d.getMonth()].slice(0, 3)}`;
};

export const fmtDateNumeric = (iso: ISODate): string => {
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const weekday = (iso: ISODate): number => parseDate(iso).getDay();

export const fmtTime = (hhmm: string): string => hhmm.slice(0, 5);

export const nowTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const friendlyDay = (iso: ISODate): string => {
  const delta = diffDays(today(), iso);
  if (delta === 0) return 'Hoy';
  if (delta === 1) return 'Mañana';
  if (delta === -1) return 'Ayer';
  if (delta > 1 && delta < 7) return WEEKDAY_LONG[weekday(iso)];
  return fmtDateShort(iso);
};

export const greeting = (date = new Date()): string => {
  const h = date.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

export const monthMatrix = (monthDate: Date, weekStartsOn: 0 | 1 = 1): ISODate[][] => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const start = parseDate(startOfWeek(isoDate(first), weekStartsOn));
  const weeks: ISODate[][] = [];
  let cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: ISODate[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(isoDate(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12);
    }
    weeks.push(week);
  }
  // Recorta la última semana si no pertenece al mes.
  while (weeks.length > 5 && weeks[weeks.length - 1].every((d) => parseDate(d).getMonth() !== monthDate.getMonth())) {
    weeks.pop();
  }
  return weeks;
};
