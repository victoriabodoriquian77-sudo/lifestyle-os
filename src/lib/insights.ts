/**
 * Smart Insights. Observaciones derivadas exclusivamente de los registros
 * reales de la persona. Sin diagnósticos, sin dietas extremas, sin metas
 * inventadas: solo patrones, comparaciones y sugerencias de organización.
 */
import type { AppData, ISODate } from '@/types';
import { addDays, localDayFromISO, startOfWeek, today, WEEKDAY_LONG, weekday } from './date';
import {
  checkinAverages, completedSessions, exerciseSeries, focusMinutes, habitCountOn,
  habitRangeStats, personalRecords, sessionsInRange, sessionVolume,
  taskStats, waterDay, dayHabitProgress,
} from './metrics';
import { avg, fmtNum, pct, round, sum } from './utils';

export type InsightTone = 'positive' | 'attention' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  /** Etiqueta corta de la sección que lo origina. */
  area: 'Entrenamiento' | 'Hábitos' | 'Productividad' | 'Bienestar' | 'Nutrición';
}

export const buildInsights = (data: AppData): Insight[] => {
  const t = today();
  const out: Insight[] = [];
  const sessions = completedSessions(data);
  const last28 = sessionsInRange(data, addDays(t, -27), t);
  const prev28 = sessionsInRange(data, addDays(t, -55), addDays(t, -28));
  const last7 = sessionsInRange(data, addDays(t, -6), t);

  /* ---------------------------------------------------------- entrenamiento */
  if (sessions.length >= 4) {
    if (prev28.length >= 3 && last28.length < prev28.length) {
      const diff = prev28.length - last28.length;
      out.push({
        id: 'training-drop',
        tone: 'attention',
        area: 'Entrenamiento',
        title: 'Frecuencia de entrenamiento en descenso',
        body: `En los últimos 28 días registraste ${last28.length} sesiones, ${diff} menos que en los 28 anteriores (${prev28.length}). Si fue una pausa planificada, está bien; si no, una sesión corta esta semana alcanza para retomar el ritmo.`,
      });
    } else if (last28.length > prev28.length && prev28.length > 0) {
      out.push({
        id: 'training-up',
        tone: 'positive',
        area: 'Entrenamiento',
        title: 'Más constancia que el mes pasado',
        body: `Pasaste de ${prev28.length} a ${last28.length} sesiones en los últimos 28 días. La progresión sostenida se construye con esta regularidad.`,
      });
    }
  }

  if (sessions.length >= 6) {
    const byWeekday = new Map<number, number>();
    sessions.forEach((s) => byWeekday.set(weekday(s.date), (byWeekday.get(weekday(s.date)) ?? 0) + 1));
    const counts = [0, 1, 2, 3, 4, 5, 6].map((d) => byWeekday.get(d) ?? 0);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (max - min >= 2) {
      const least = counts.indexOf(min);
      out.push({
        id: 'training-weekday',
        tone: 'neutral',
        area: 'Entrenamiento',
        title: `Los ${WEEKDAY_LONG[least]} son tu día más flojo`,
        body: `Concentrás más sesiones entre semana y el ${WEEKDAY_LONG[least]} aparece con menos frecuencia. Mover una sesión a ese día puede distribuir mejor la carga y el descanso.`,
      });
    }
  }

  // Volumen semanal: 4 semanas recientes vs 4 anteriores.
  const weekStarts = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(t, 1), -7 * (7 - i)));
  const weeklyVolume = weekStarts.map((w) => sum(sessionsInRange(data, w, addDays(w, 6)).map(sessionVolume)));
  const recentVol = avg(weeklyVolume.slice(4));
  const olderVol = avg(weeklyVolume.slice(0, 4));
  if (olderVol > 0 && recentVol > 0) {
    const delta = Math.round(((recentVol - olderVol) / olderVol) * 100);
    if (delta >= 12) {
      out.push({
        id: 'volume-up',
        tone: 'positive',
        area: 'Entrenamiento',
        title: `Volumen semanal +${delta}%`,
        body: `Tu volumen promedio pasó de ${fmtNum(olderVol)} a ${fmtNum(recentVol)} kg por semana. Un aumento así se sostiene mejor con sueño y alimentación regulares; si notás fatiga acumulada, una semana más liviana es parte del plan.`,
      });
    } else if (delta <= -18) {
      out.push({
        id: 'volume-down',
        tone: 'attention',
        area: 'Entrenamiento',
        title: `Volumen semanal ${delta}%`,
        body: `Bajó el volumen total de entrenamiento respecto del mes anterior. Puede ser intencional (descarga) o por sesiones más cortas. Vale la pena revisar si los días de gimnasio están chocando con otras obligaciones.`,
      });
    }
  }

  // Progreso por ejercicio.
  const exerciseNames = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.name)))].filter(Boolean);
  const improvements: Array<{ name: string; delta: number; from: number; to: number }> = [];
  const stalled: string[] = [];
  for (const name of exerciseNames) {
    const points = exerciseSeries(data, name);
    if (points.length < 3) continue;
    const last = points[points.length - 1];
    const reference = points[Math.max(0, points.length - 4)];
    if (last.e1rm > 0 && reference.e1rm > 0) {
      const delta = ((last.e1rm - reference.e1rm) / reference.e1rm) * 100;
      if (delta >= 3) improvements.push({ name, delta: round(delta, 1), from: reference.e1rm, to: last.e1rm });
    }
    const tail = points.slice(-3).map((p) => p.topWeight);
    if (tail.length === 3 && tail[0] > 0 && tail.every((w) => Math.abs(w - tail[0]) < 0.01)) stalled.push(name);
  }
  improvements.sort((a, b) => b.delta - a.delta);
  if (improvements.length) {
    const top = improvements.slice(0, 2);
    out.push({
      id: 'exercise-progress',
      tone: 'positive',
      area: 'Entrenamiento',
      title: top.length === 1 ? `${top[0].name} está progresando` : 'Tus mejores progresiones',
      body: top
        .map((p) => `${p.name}: +${fmtNum(p.delta, 1)}% de fuerza estimada (${fmtNum(p.from)} → ${fmtNum(p.to)} kg e1RM).`)
        .join(' '),
    });
  }
  if (stalled.length) {
    out.push({
      id: 'exercise-stall',
      tone: 'neutral',
      area: 'Entrenamiento',
      title: 'Ejercicios estancados',
      body: `${stalled.slice(0, 3).join(', ')} mantienen el mismo peso en las últimas 3 sesiones. Podés probar una variante (más repeticiones, tempo controlado o una serie extra suave) antes de subir carga.`,
    });
  }

  const prs = personalRecords(data).filter((p) => p.bestWeightDate && p.bestWeightDate >= addDays(t, -45));
  if (prs.length) {
    const best = prs[0];
    out.push({
      id: 'pr-recent',
      tone: 'positive',
      area: 'Entrenamiento',
      title: 'Récords recientes',
      body: `En los últimos 45 días registraste marcas nuevas. La más alta: ${best.name} con ${fmtNum(best.bestWeight)} kg. Quedan guardadas en Progreso → Récords personales.`,
    });
  }

  // Desbalance de grupos musculares.
  if (last28.length >= 5) {
    const volByGroup = new Map<string, number>();
    last28.forEach((s) => s.exercises.forEach((e) => {
      const v = sum(e.sets.filter((x) => x.completed).map((x) => (x.weightKg ?? 0) * (x.reps ?? 0) || 1));
      volByGroup.set(e.muscleGroup || 'Otro', (volByGroup.get(e.muscleGroup || 'Otro') ?? 0) + v);
    }));
    const entries = [...volByGroup.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length >= 3) {
      const half = entries[0][1] / Math.max(1, sum(entries.map((e) => e[1])));
      if (half > 0.45) {
        out.push({
          id: 'muscle-imbalance',
          tone: 'neutral',
          area: 'Entrenamiento',
          title: `Carga concentrada en ${entries[0][0]}`,
          body: `${Math.round(half * 100)}% del volumen de los últimos 28 días está en ${entries[0][0]}. Repartir un poco más hacia ${entries[entries.length - 1][0]} mantiene el desarrollo equilibrado.`,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- hábitos */
  const activeHabits = data.habits.filter((h) => !h.archived);
  if (activeHabits.length) {
    const stats = activeHabits.map((h) => ({ habit: h, ...habitRangeStats(data, h, addDays(t, -27), t) }));
    const withEnough = stats.filter((s) => s.scheduled >= 4);
    const best = [...withEnough].sort((a, b) => b.rate - a.rate)[0];
    const worst = [...withEnough].sort((a, b) => a.rate - b.rate)[0];
    if (best && best.rate >= 70) {
      out.push({
        id: 'habit-best',
        tone: 'positive',
        area: 'Hábitos',
        title: `${best.habit.name} es tu hábito más sólido`,
        body: `Cumplido ${Math.round(best.rate)}% de las veces en 28 días (${best.completed} de ${best.scheduled}). Es un buen ancla: podés apoyar un hábito nuevo justo después de este.`,
      });
    }
    if (worst && worst.rate < 45 && worst.habit.id !== best?.habit.id) {
      out.push({
        id: 'habit-weak',
        tone: 'attention',
        area: 'Hábitos',
        title: `${worst.habit.name} necesita un ajuste`,
        body: `Solo ${Math.round(worst.rate)}% de cumplimiento en 28 días. Si el objetivo era demasiado ambicioso, reducirlo (por ejemplo, a la mitad) suele funcionar mejor que insistir con la versión completa.`,
      });
    }
    const todayProgress = dayHabitProgress(data, t);
    if (todayProgress.scheduled > 0 && todayProgress.done === 0) {
      out.push({
        id: 'habit-today',
        tone: 'neutral',
        area: 'Hábitos',
        title: 'Nada marcado todavía hoy',
        body: `Tenés ${todayProgress.scheduled} hábito${todayProgress.scheduled === 1 ? '' : 's'} programado${todayProgress.scheduled === 1 ? '' : 's'} para hoy. Empezar por el más corto suele destrabar el resto.`,
      });
    }
  }

  /* ----------------------------------------------------------- productividad */
  const tasks = taskStats(data, addDays(t, -29), t);
  if (data.tasks.length >= 5) {
    const open = data.tasks.filter((x) => x.status !== 'done');
    const overdue = open.filter((x) => x.dueDate && x.dueDate < t);
    if (overdue.length >= 3) {
      const oldest = overdue.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
      out.push({
        id: 'tasks-overdue',
        tone: 'attention',
        area: 'Productividad',
        title: `${overdue.length} tareas vencidas`,
        body: `La más antigua es “${oldest.title}” (${oldest.dueDate}). Reprogramar lo que ya no es prioritario también es avanzar: libera atención para lo que sí importa esta semana.`,
      });
    }
    if (tasks.completed > 0 && tasks.created > 0 && tasks.completed >= tasks.created) {
      out.push({
        id: 'tasks-flow',
        tone: 'positive',
        area: 'Productividad',
        title: 'Cerraste más de lo que abriste',
        body: `${tasks.completed} tareas completadas y ${tasks.created} creadas en los últimos 30 días. Esa relación mantiene el sistema liviano.`,
      });
    }
    const highOld = open.filter((x) => x.priority === 'high').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0];
    if (highOld && localDayFromISO(highOld.createdAt) < addDays(t, -14)) {
      out.push({
        id: 'tasks-postpone',
        tone: 'neutral',
        area: 'Productividad',
        title: 'Una prioridad alta lleva tiempo abierta',
        body: `“${highOld.title}” está marcada como alta desde hace más de dos semanas. Si no avanzó, quizá convenga dividirla en un primer paso de 15 minutos.`,
      });
    }
  }

  const focus7 = focusMinutes(data, addDays(t, -6), t);
  const focusPrev7 = focusMinutes(data, addDays(t, -13), addDays(t, -7));
  if (focus7 > 0 || focusPrev7 > 0) {
    if (focus7 < focusPrev7 * 0.6 && focusPrev7 >= 60) {
      out.push({
        id: 'focus-down',
        tone: 'neutral',
        area: 'Productividad',
        title: 'Bajó el tiempo de concentración',
        body: `Esta semana registraste ${Math.round(focus7)} min de foco contra ${Math.round(focusPrev7)} min la anterior. Un solo bloque de 25 min hoy ayuda a recuperar el hábito.`,
      });
    } else if (focus7 > focusPrev7 && focus7 >= 60) {
      out.push({
        id: 'focus-up',
        tone: 'positive',
        area: 'Productividad',
        title: 'Más foco que la semana pasada',
        body: `${Math.round(focus7)} min de concentración registrados, contra ${Math.round(focusPrev7)} min la semana anterior.`,
      });
    }
  }

  /* --------------------------------------------------------------- bienestar */
  const wb = checkinAverages(data, addDays(t, -13), t);
  if (wb.nights >= 3 && wb.sleepH > 0) {
    if (wb.sleepH < 6.5) {
      out.push({
        id: 'sleep-low',
        tone: 'attention',
        area: 'Bienestar',
        title: 'Dormiste menos de lo habitual',
        body: `Promedio de ${fmtNum(wb.sleepH, 1)} h en los últimos 14 días. Dormir es la variable que más impacta en fuerza, hambre y concentración; adelantar media hora la rutina nocturna suele ser más efectivo que sumar entrenamiento.`,
      });
    } else if (wb.sleepH >= 7.5) {
      out.push({
        id: 'sleep-good',
        tone: 'positive',
        area: 'Bienestar',
        title: 'Buen descanso sostenido',
        body: `Promedio de ${fmtNum(wb.sleepH, 1)} h por noche. Es la base para que el entrenamiento y el foco rindan.`,
      });
    }
  }
  if (last7.length >= 5 && wb.recovery > 0 && wb.recovery <= 2.6) {
    out.push({
      id: 'recovery-low',
      tone: 'attention',
      area: 'Bienestar',
      title: 'Mucha carga y recuperación baja',
      body: `Registraste ${last7.length} sesiones en 7 días con recuperación percibida de ${fmtNum(wb.recovery, 1)}/5. No es una alarma: es una señal para bajar el volumen de una sesión o sumar un día de descanso activo.`,
    });
  }

  /* --------------------------------------------------------------- nutrición */
  const nutritionDays = new Set(data.meals.map((m) => m.date)).size;
  if (nutritionDays >= 5) {
    const last14 = Array.from({ length: 14 }, (_, i) => addDays(t, -i));
    const logged = last14.filter((d) => data.meals.some((m) => m.date === d)).length;
    if (logged >= 10) {
      out.push({
        id: 'nutrition-regular',
        tone: 'positive',
        area: 'Nutrición',
        title: 'Registro alimentario constante',
        body: `Registraste comidas en ${logged} de los últimos 14 días. La regularidad del registro es lo que permite ver patrones reales sin obsesionarse con un número.`,
      });
    } else if (logged <= 4) {
      out.push({
        id: 'nutrition-sparse',
        tone: 'neutral',
        area: 'Nutrición',
        title: 'Pocos registros de comidas',
        body: 'El registro es opcional. Si te sirve, alcanza con anotar una comida al día para detectar patrones; si no, podés usarlo solo cuando quieras revisar cómo venís.',
      });
    }
    const proteinDays = last14
      .map((d) => ({
        d,
        p: sum(data.meals.filter((m) => m.date === d).flatMap((m) => m.items.map((i) => i.protein ?? 0))),
      }))
      .filter((x) => x.p > 0);
    if (proteinDays.length >= 5) {
      const pAvg = avg(proteinDays.map((x) => x.p));
      const spread = Math.max(...proteinDays.map((x) => x.p)) - Math.min(...proteinDays.map((x) => x.p));
      if (pAvg > 0 && spread / pAvg > 0.6) {
        out.push({
          id: 'nutrition-variety',
          tone: 'neutral',
          area: 'Nutrición',
          title: 'Proteína irregular entre días',
          body: `El promedio ronda ${fmtNum(pAvg)} g pero varía bastante de un día a otro. Distribuirla en las comidas principales suele ser más sostenible que compensar al final del día.`,
        });
      }
    }
  }

  const water7 = Array.from({ length: 7 }, (_, i) => waterDay(data, addDays(t, -i)));
  const waterDaysLogged = water7.filter((v) => v > 0).length;
  if (waterDaysLogged >= 3) {
    const wAvg = avg(water7);
    const ratio = wAvg / Math.max(1, data.settings.waterGoalMl);
    if (ratio < 0.6) {
      out.push({
        id: 'water-low',
        tone: 'neutral',
        area: 'Bienestar',
        title: 'Agua por debajo de tu objetivo',
        body: `Promedio de ${Math.round(wAvg)} ml por día contra una meta de ${data.settings.waterGoalMl} ml. Tener la botella a la vista y registrar al terminar suele ser más efectivo que acordarse de golpe.`,
      });
    }
  }

  if (!out.length) {
    out.push({
      id: 'need-data',
      tone: 'neutral',
      area: 'Productividad',
      title: 'Todavía no hay suficiente historial',
      body: 'Los insights aparecen a partir de tus registros. Con tres o cuatro días de hábitos, una sesión de gimnasio y algunas tareas alcanza para empezar a ver patrones reales.',
    });
  }

  return out.slice(0, 8);
};

/** % de días con al menos un registro de cualquier tipo (calidad de datos). */
export const loggingCoverage = (data: AppData, from: ISODate, to: ISODate): number => {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const active = days.filter(
    (d) =>
      data.habits.some((h) => habitCountOn(data, h.id, d) > 0) ||
      data.sessions.some((s) => s.date === d) ||
      data.meals.some((m) => m.date === d) ||
      data.water.some((w) => w.date === d) ||
      data.checkins.some((c) => c.date === d),
  ).length;
  return pct(active, days.length);
};
