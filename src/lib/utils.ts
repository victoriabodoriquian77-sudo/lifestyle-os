/** Utilidades transversales de formato, identidad y matemática. */

export const uid = (prefix = ''): string => {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}${prefix ? '_' : ''}${Date.now().toString(36)}${rand}`;
};

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export const round = (n: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

export const avg = (arr: number[]): number => (arr.length ? sum(arr) / arr.length : 0);

export const pct = (part: number, total: number): number => (total <= 0 ? 0 : clamp((part / total) * 100, 0, 100));

/** Une clases condicionalmente. */
export const cn = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const fmtNum = (n: number | null | undefined, decimals: number = 0): string => {
  if (n == null || Number.isNaN(n)) return '—';
  return decimals === 1 ? nf.format(n) : nf0.format(n);
};

export const fmtCompact = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `${nf.format(n / 1_000_000)}M`;
  if (Math.abs(n) >= 10_000) return `${nf.format(n / 1000)}k`;
  return nf0.format(n);
};

export const fmtWeight = (kg: number | null | undefined, units: 'metric' | 'imperial'): string => {
  if (kg == null || Number.isNaN(kg)) return '—';
  return units === 'metric' ? `${nf.format(kg)} kg` : `${nf.format(kg * 2.2046226)} lb`;
};

export const fmtVolume = (kg: number, units: 'metric' | 'imperial'): string => {
  const value = units === 'metric' ? kg : kg * 2.2046226;
  return `${fmtCompact(value)} ${units === 'metric' ? 'kg' : 'lb'}`;
};

export const fmtHeight = (cm: number | null, units: 'metric' | 'imperial'): string => {
  if (cm == null) return '—';
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const inches = cm / 2.54;
  return `${Math.floor(inches / 12)}′ ${Math.round(inches % 12)}″`;
};

export const fmtMl = (ml: number, units: 'metric' | 'imperial'): string => {
  if (units === 'imperial') return `${nf.format(ml / 29.5735)} oz`;
  return ml >= 1000 ? `${(ml / 1000).toFixed(1).replace('.', ',')} L` : `${Math.round(ml)} ml`;
};

export const fmtDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${Math.round(seconds)} s`;
};

export const fmtClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export const fmtTimer = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-AR');
};

/** Parsea un número escrito a mano, tolerando coma decimal y separadores. */
export const parseNumber = (raw: string): number | null => {
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Interpreta un objetivo de repeticiones ("8-12", "10/8/6", "AMRAP", "12"). */
export const parseRepTarget = (target: string): { min: number | null; max: number | null; label: string } => {
  const nums = (target.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return { min: null, max: null, label: target.trim() || '—' };
  return { min: Math.min(...nums), max: Math.max(...nums), label: target.trim() };
};

export const uidList = <T extends { id: string }>(items: T[]): T[] =>
  items.map((i) => ({ ...i, id: i.id || uid() }));

export const csrfSafe = (s: string): string => s.replace(/[<>]/g, '');
