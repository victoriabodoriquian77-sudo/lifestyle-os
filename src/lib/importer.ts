/**
 * Importador de rutinas desde Excel (.xlsx / .xls) y CSV.
 *
 * No depende del formato exacto: busca la fila de encabezados por sinónimos en
 * español/inglés, respeta hojas, detecta secciones por día y, si no encuentra
 * encabezados, interpreta las filas numéricas en el orden habitual
 * (ejercicio · series · repeticiones · peso).
 *
 * El parseo es una propuesta editable: la UI muestra la vista previa y el
 * usuario confirma antes de crear las rutinas.
 */
import * as XLSX from 'xlsx';
import type { RoutineExercise } from '@/types';
import { guessMuscleGroup } from './muscle';

export { guessMuscleGroup };
import { WEEKDAY_LONG, weekday } from './date';
import { uid } from './utils';

export interface ExerciseDraft {
  name: string;
  muscleGroup: string;
  sets: number;
  repsTarget: string;
  restSec: number;
  notes: string;
}

export interface RoutineDraft {
  tempId: string;
  name: string;
  description: string;
  weekday: number | null;
  muscleGroups: string[];
  exercises: ExerciseDraft[];
  source: string;
}

export interface SheetReport {
  sheet: string;
  rows: number;
  exercises: number;
  chunks: number;
  headerRow: number | null;
  notes: string[];
}

export interface ImportResult {
  routines: RoutineDraft[];
  sheets: SheetReport[];
  warnings: string[];
  fileName: string;
}

/* ------------------------------------------------------------------ helpers */

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%#/.-]+/g, ' ')
    .trim();

const HEADER_SYNONYMS = {
  name: ['ejercicio', 'ejercicios', 'exercise', 'movimiento', 'movimientos', 'nombre del ejercicio', 'nombre', 'item', 'trabajo'],
  sets: ['series', 'serie', 'sets', 'set', 'n series', 'n° series', 'cant series', 'cantidad de series', '# series', 'x series'],
  reps: ['reps', 'rep', 'repetencias', 'repeticiones', 'rep target', 'objetivo reps', 'rango de reps', 'repeticiones objetivo', 'reps objetivo'],
  weight: ['peso', 'carga', 'kg', 'kgs', 'weight', 'peso kg', 'carga kg', 'peso (kg)', 'carga (kg)', 'kilos'],
  rest: ['descanso', 'desc', 'rest', 'descanso seg', 'descanso s', 'descanso (s)', 'rest sec', 'seg descanso', 'pausa'],
  notes: ['observaciones', 'obs', 'notas', 'nota', 'comments', 'comentarios', 'detalle', 'indicaciones'],
  muscle: ['musculo', 'grupo', 'grupo muscular', 'muscle', 'muscle group', 'zona', 'region'],
  day: ['dia', 'day', 'rutina', 'sesion', 'entrenamiento', 'bloque'],
  week: ['semana', 'week', 'microciclo'],
} as const;

type HeaderField = keyof typeof HEADER_SYNONYMS;

interface ColumnMap {
  name: number;
  sets: number;
  reps: number;
  weight: number;
  rest: number;
  notes: number;
  muscle: number;
  day: number;
  week: number;
  headerRow: number;
}

const emptyMap = (): ColumnMap => ({ name: -1, sets: -1, reps: -1, weight: -1, rest: -1, notes: -1, muscle: -1, day: -1, week: -1, headerRow: -1 });

const matchHeader = (cell: string): HeaderField | null => {
  const n = norm(cell).replace(/[:*]/g, '').trim();
  if (!n) return null;
  for (const field of Object.keys(HEADER_SYNONYMS) as HeaderField[]) {
    const list = HEADER_SYNONYMS[field];
    if (list.some((syn) => n === syn)) return field;
  }
  // Coincidencia parcial: "peso utilizado", "series x ejercicio"
  for (const field of Object.keys(HEADER_SYNONYMS) as HeaderField[]) {
    const list = HEADER_SYNONYMS[field];
    if (list.some((syn) => syn.length > 3 && (n.startsWith(syn + ' ') || n.endsWith(' ' + syn) || n.includes(' ' + syn + ' ')))) return field;
  }
  return null;
};

const findHeader = (rows: string[][]): ColumnMap | null => {
  for (let r = 0; r < Math.min(rows.length, 14); r++) {
    const row = rows[r];
    if (!row) continue;
    const map = emptyMap();
    let hits = 0;
    row.forEach((cell, c) => {
      const field = matchHeader(cell);
      if (!field) return;
      if (map[field] === -1) {
        map[field] = c;
        hits++;
      }
    });
    if (map.name !== -1 && hits >= 2) {
      map.headerRow = r;
      return map;
    }
    if (hits >= 3 && map.name === -1) {
      // Encabezado sin nombre explícito: la primera columna suele ser el ejercicio.
      map.name = 0;
      map.headerRow = r;
      return map;
    }
  }
  return null;
};

const num = (value: unknown): number | null => {
  const s = String(value ?? '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const parseSets = (value: unknown, repsRaw: unknown): { sets: number; reps: string } | null => {
  const raw = norm(value);
  // Formatos "3x12", "4 x 10-12", "3×8"
  const combo = raw.match(/(\d{1,2})\s*[x×]\s*(\d{1,3}(?:\s*-\s*\d{1,3})?)/);
  if (combo) return { sets: Number(combo[1]), reps: combo[2].replace(/\s+/g, '') };
  const s = num(value);
  if (s != null && s > 0) {
    const repsText = String(repsRaw ?? '').trim();
    return { sets: Math.min(20, Math.round(s)), reps: repsText };
  }
  return null;
};

const parseReps = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const n = norm(raw);
  if (n.includes('amrap')) return 'AMRAP';
  // Si la celda de reps trae "3x12", las repeticiones son el segundo número.
  const combo = n.match(/\d{1,2}\s*[x×]\s*(\d{1,3}(?:\s*-\s*\d{1,3})?)/);
  if (combo) return combo[1].replace(/\s+/g, '');
  if (/al fallo|fallo|max/.test(n)) return 'Al fallo';
  const range = raw.match(/\d{1,3}\s*[-–/]\s*\d{1,3}/);
  if (range) return range[0].replace(/\s+/g, '');
  const single = raw.match(/\d{1,3}/);
  return single ? single[0] : raw.slice(0, 18);
};

const parseRest = (value: unknown): number | null => {
  const raw = norm(value);
  if (!raw) return null;
  const clock = raw.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m\b)/);
  if (minutes) return Math.round(Number(minutes[1].replace(',', '.')) * 60);
  const n = num(raw);
  if (n == null) return null;
  // Si el número es chico se asume segundos; si es 1-5 podría ser minutos, pero
  // "90" es inequívoco. Se deja el valor tal cual si es >= 20.
  return Math.round(n <= 12 ? n * 60 : n);
};

const DAY_REGEX = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|day|dia)\b/i;

const guessWeekday = (text: string): number | null => {
  const n = norm(text);
  const idx = WEEKDAY_LONG.findIndex((d) => n.includes(norm(d)));
  if (idx >= 0) return idx;
  const dayNum = n.match(/\b(?:dia|day)\s*(\d)\b/);
  if (dayNum) {
    // Día 1 = lunes, día 7 = domingo (convención de planillas de gimnasio).
    const d = Number(dayNum[1]);
    if (d >= 1 && d <= 7) return d === 7 ? 0 : d;
  }
  return null;
};

const looksLikeExercise = (row: string[], map: ColumnMap): boolean => {
  const name = map.name >= 0 ? String(row[map.name] ?? '').trim() : '';
  if (!name || name.length < 2) return false;
  // Una fila de encabezado repetida se descarta, pero un ejercicio que empieza
  // con una palabra clave ("Peso muerto rumano") no es un encabezado.
  const headerCells = row.filter((c) => matchHeader(String(c ?? '')) != null).length;
  if (matchHeader(name) && headerCells >= 2) return false;
  const numericCells = row.filter((c) => c !== '' && num(c) != null).length;
  const hasSets = map.sets >= 0 ? String(row[map.sets] ?? '').trim() !== '' : false;
  return numericCells >= 1 || hasSets;
};

const cleanExerciseName = (raw: string): string => {
  // Quita numeración inicial: "1.", "01 -", "•", "-"
  return raw
    .replace(/^\s*(?:[•·*\-–—]|\d{1,2}[.)-])\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[:\s]+$/, '')
    .trim();
};

const sectionLabel = (row: string[]): string | null => {
  const nonEmpty = row.map((c) => String(c).trim()).filter(Boolean);
  if (!nonEmpty.length) return null;
  if (nonEmpty.length > 2) return null;
  const text = nonEmpty.join(' ').trim();
  if (text.length > 60) return null;
  if (matchHeader(text)) return null;
  // Una sección no suele traer números sueltos.
  if (/^\d+$/.test(text)) return null;
  if (DAY_REGEX.test(text) || guessMuscleGroup(text) || /^(rutina|entrenamiento|sesion|sesión|bloque|upper|lower|push|pull|legs?)\b/i.test(text)) {
    return text;
  }
  return null;
};

/* -------------------------------------------------------------------- core */

interface Chunk {
  label: string;
  exercises: ExerciseDraft[];
}

export function parseSheet(name: string, rows: string[][]): { chunks: Chunk[]; report: SheetReport } {
  const cleanRows = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []));
  const map = findHeader(cleanRows);
  const report: SheetReport = { sheet: name, rows: cleanRows.length, exercises: 0, chunks: 0, headerRow: map?.headerRow ?? null, notes: [] };

  // Sin encabezado: interpretación posicional.
  const effective: ColumnMap = map ?? { ...emptyMap(), name: 0, sets: 1, reps: 2, weight: 3, rest: 4, notes: 5, muscle: -1, day: -1, week: -1, headerRow: -1 };
  if (!map) {
    report.notes.push('No se encontró una fila de encabezados: se interpretó por posición (ejercicio, series, reps, peso, descanso, notas).');
  }

  const chunks: Chunk[] = [];
  let current: Chunk = { label: name, exercises: [] };
  chunks.push(current);
  let usedDayColumn = false;

  for (let r = (map ? map.headerRow + 1 : 0); r < cleanRows.length; r++) {
    const row = cleanRows[r] ?? [];
    if (!row.some((c) => c !== '')) continue;

    // Fila con columna "día": agrupa por valor.
    if (effective.day >= 0) {
      const dayValue = String(row[effective.day] ?? '').trim();
      if (dayValue && !matchHeader(dayValue)) {
        usedDayColumn = true;
        const label = dayValue;
        let target = chunks.find((c) => c.label.toLowerCase() === label.toLowerCase());
        if (!target) {
          target = { label, exercises: [] };
          chunks.push(target);
        }
        current = target;
      }
    }

    const section = map ? sectionLabel(row) : null;
    if (section && !looksLikeExercise(row, effective)) {
      current = { label: section, exercises: [] };
      chunks.push(current);
      continue;
    }

    if (!looksLikeExercise(row, effective)) continue;

    const rawName = String(row[effective.name] ?? '').trim();
    const nameClean = cleanExerciseName(rawName);
    if (!nameClean) continue;

    const setsParsed = map
      ? parseSets(row[effective.sets] ?? '', row[effective.reps] ?? '')
      : parseSets(row[1] ?? '', row[2] ?? '');
    let sets = setsParsed?.sets ?? 3;
    let reps = parseReps(setsParsed?.reps || (effective.reps >= 0 ? row[effective.reps] : ''));
    if (!reps) reps = '10';
    if (sets > 15) sets = 3; // valores absurdos suelen ser kilos mal ubicados

    const weightRaw = effective.weight >= 0 ? row[effective.weight] : '';
    const weightNum = num(weightRaw);
    let notes = effective.notes >= 0 ? String(row[effective.notes] ?? '').trim() : '';
    if (weightNum != null && weightNum > 0 && !notes) notes = '';

    const restSec = effective.rest >= 0 ? parseRest(row[effective.rest]) : null;
    const muscleCell = effective.muscle >= 0 ? String(row[effective.muscle] ?? '').trim() : '';
    const muscleGroup =
      guessMuscleGroup(muscleCell) ?? guessMuscleGroup(nameClean) ?? guessMuscleGroup(current.label) ?? guessMuscleGroup(name) ?? 'Otro';

    current.exercises.push({
      name: nameClean,
      muscleGroup,
      sets,
      repsTarget: reps,
      restSec: restSec ?? 90,
      notes: notes.slice(0, 200),
    });
    if (weightNum != null && weightNum > 0) {
      current.exercises[current.exercises.length - 1].notes =
        `${notes ? notes + ' · ' : ''}Peso de referencia: ${weightNum} kg`.slice(0, 200);
    }
  }

  const filtered = chunks.filter((c) => c.exercises.length > 0);
  // Deduplica encabezados repetidos de la misma sección.
  if (usedDayColumn) {
    const merged = new Map<string, Chunk>();
    for (const c of filtered) {
      const k = c.label.toLowerCase();
      const prev = merged.get(k);
      if (prev) prev.exercises.push(...c.exercises);
      else merged.set(k, { ...c, exercises: [...c.exercises] });
    }
    chunks.length = 0;
    chunks.push(...merged.values());
  }

  const finalChunks = chunks.filter((c) => c.exercises.length > 0);
  report.exercises = finalChunks.reduce((t, c) => t + c.exercises.length, 0);
  report.chunks = finalChunks.length;
  return { chunks: finalChunks, report };
}

const stripSheetSuffix = (name: string): string => name.replace(/\.(xlsx|xls|csv|ods)$/i, '').trim();

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): ImportResult {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  return workbookToDrafts(wb, fileName);
}

/**
 * CSV aparte: leerlo como texto preserva UTF-8 (días con tilde) y, con
 * `raw: true`, evita que "8-10" se interprete como fecha.
 */
export function parseCsvText(text: string, fileName: string): ImportResult {
  const wb = XLSX.read(text, { type: 'string', raw: true, codepage: 65001 });
  return workbookToDrafts(wb, fileName);
}

function workbookToDrafts(wb: XLSX.WorkBook, fileName: string): ImportResult {
  const routines: RoutineDraft[] = [];
  const sheets: SheetReport[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '', blankrows: false }) as string[][];
    if (!rows.length) continue;

    const { chunks, report } = parseSheet(sheetName, rows);
    sheets.push(report);
    if (!chunks.length) {
      report.notes.push('Hoja sin ejercicios reconocibles.');
      continue;
    }

    // Una sola sección con el nombre de la hoja: la rutina se llama como la hoja.
    if (chunks.length === 1) {
      const chunk = chunks[0];
      const baseName = chunk.label && norm(chunk.label) !== norm(sheetName) ? chunk.label : sheetName;
      routines.push(buildDraft(baseName, chunk.exercises, sheetName, fileName));
      continue;
    }

    for (const chunk of chunks) {
      routines.push(buildDraft(chunk.label || sheetName, chunk.exercises, sheetName, fileName));
    }
  }

  if (!routines.length) warnings.push('No se detectaron ejercicios. Revisá que la planilla tenga columnas de ejercicio y series/reps.');

  return { routines, sheets, warnings, fileName: stripSheetSuffix(fileName) };
}

function buildDraft(label: string, exercises: ExerciseDraft[], sheet: string, fileName: string): RoutineDraft {
  const name = stripSheetSuffix(label).replace(/\s{2,}/g, ' ').trim() || sheet;
  const groups = [...new Set(exercises.map((e) => e.muscleGroup))];
  return {
    tempId: uid('draft'),
    name,
    description: `Importado de ${sheet}${fileName ? ` · ${stripSheetSuffix(fileName)}` : ''}`,
    weekday: guessWeekday(name),
    muscleGroups: groups,
    exercises,
    source: stripSheetSuffix(fileName) || sheet,
  };
}

export async function parseWorkoutFile(file: File): Promise<ImportResult> {
  if (/\.csv$/i.test(file.name)) return parseCsvText(await file.text(), file.name);
  const buffer = await file.arrayBuffer();
  return parseWorkbook(buffer, file.name);
}

/* ------------------------------------------------------- conversión a rutina */

export const draftToRoutineExercises = (draft: RoutineDraft): RoutineExercise[] =>
  draft.exercises.map((e, i) => ({
    id: uid('rex'),
    name: e.name,
    muscleGroup: e.muscleGroup,
    sets: e.sets,
    repsTarget: e.repsTarget,
    restSec: e.restSec,
    notes: e.notes,
    order: i,
  }));

export const weekdayName = (d: number | null): string => (d == null ? 'Sin día' : WEEKDAY_LONG[d] ?? 'Sin día');

export const weekdayFromISO = (iso: string): number => weekday(iso);
