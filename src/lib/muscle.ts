/** Detección heurística de grupo muscular por nombre de ejercicio o texto. */
import { MUSCLE_GROUPS } from '@/types';

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%#/.-]+/g, ' ')
    .trim();

const MUSCLE_KEYWORDS: Array<[string, RegExp]> = [
  ['Pecho', /pecho|pectoral|bench|press banca|banca|apertura|fondos en paralela/i],
  ['Espalda', /espalda|dorsal|remo|jalon|jalón|dominada|pull|lat|pulldown|face pull/i],
  ['Hombros', /hombro|deltoid|press militar|militar|elevacion lateral|elevacion frontal|pajaros|pájaros/i],
  ['Bíceps', /biceps|bíceps|curl|bicep/i],
  ['Tríceps', /triceps|tríceps|frances|french|pushdown|extension de triceps|patada/i],
  ['Piernas', /pierna|piernas|cuadriceps|cuádriceps|femoral|isquio|sentadilla|squat|prensa|zancada|estocada|gemelo|pantorrilla|leg/i],
  ['Glúteos', /gluteo|glúteo|hip thrust|puente|patada de gluteo|bulgaro|búlgaro/i],
  ['Core', /core|abdomen|abdominal|plancha|plank|crunch|rueda|hollow|oblicuo/i],
  ['Cardio', /cardio|cinta|bici|bicicleta|remo ergometro|eliptica|elíptica|hiit|trote|caminata/i],
  ['Cuerpo completo', /full body|cuerpo completo|circuito|functional|funcional/i],
];

export const guessMuscleGroup = (text: string): string | null => {
  const clean = String(text ?? '');
  for (const [group, re] of MUSCLE_KEYWORDS) if (re.test(clean)) return group;
  const n = norm(clean);
  const exact = MUSCLE_GROUPS.find((g) => norm(g) === n);
  return exact ?? null;
};

