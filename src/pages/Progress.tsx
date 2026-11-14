import { useMemo, useState } from 'react';
import {
  Activity, Apple, BarChart3, CalendarCheck2, ChevronRight, Dumbbell, Flame, ListChecks, Moon, Scale, Sparkles, TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { navigate } from '@/lib/router';
import { Badge, Card, EmptyState, Meter, ProgressRing, SectionHead, Segmented } from '@/components/ui/Primitives';
import { ChartCard, ChartLegend, DonutChart, TrendChart } from '@/components/charts/Charts';
import {
  checkinAverages, completedPerDay, consistencyIndex, dayNutrition, focusPerDay, focusMinutes,
  habitCountOn, habitTargetFor, isHabitScheduled, muscleGroupVolume, overallHabitConsistency, personalRecords,
  rangeBounds, RANGE_LABELS, sessionDurationSec, sessionVolume, sessionsInRange, taskStats, weeklyGoalProgress,
  weeklyWorkouts, wellbeingSeries, waterDay,
} from '@/lib/metrics';
import type { RangeKey } from '@/lib/metrics';
import { addDays, fmtDateNumeric, fmtDateShort, startOfWeek, today, weekKey } from '@/lib/date';
import { cn, fmtCompact, fmtDuration, fmtNum, fmtWeight, pct, sum } from '@/lib/utils';

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '180', label: '6 meses' },
  { value: 'all', label: 'Todo' },
];

const fmtRange = (v: string | number): string => fmtDateNumeric(String(v));

export function Progress() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const [range, setRange] = useState<RangeKey>('30');
  const t = today();
  const { from, to, days } = rangeBounds(range, t);

  const sessions = useMemo(() => sessionsInRange(data, from, to), [data, from, to]);
  const volume = useMemo(() => sum(sessions.map(sessionVolume)), [sessions]);
  const durations = sessions.map(sessionDurationSec).filter((d) => d > 0);
  const habitSeries = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const due = data.habits.filter((h) => !h.archived && h.frequency.type !== 'weekly' && isHabitScheduled(h, date));
      const done = due.filter((h) => habitCountOn(data, h.id, date) >= habitTargetFor(h)).length;
      return due.length ? { date, rate: Math.round(pct(done, due.length)), done, due: due.length } : { date, rate: null, done: 0, due: 0 };
    });
  }, [data, from, days]);

  const taskSeries = useMemo(() => completedPerDay(data, from, to), [data, from, to]);
  const focusSeries = useMemo(() => focusPerDay(data, from, to), [data, from, to]);
  const nutritionSeriesData = useMemo(
    () => Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const n = dayNutrition(data, date);
      return { date, kcal: n.meals ? Math.round(n.kcal) : null, protein: n.meals ? Math.round(n.protein) : null, meals: n.meals };
    }),
    [data, from, days],
  );
  const wellbeing = useMemo(() => wellbeingSeries(data, from, to), [data, from, to]);
  const muscle = useMemo(() => muscleGroupVolume(data, from, to), [data, from, to]);
  const weekly = useMemo(() => weeklyWorkouts(data, Math.min(16, Math.max(6, Math.ceil(days / 7))), t), [data, days, t]);
  const stats = useMemo(() => taskStats(data, from, to), [data, from, to]);
  const focusTotal = useMemo(() => focusMinutes(data, from, to), [data, from, to]);
  const habitConsistency = useMemo(() => overallHabitConsistency(data, from, to), [data, from, to]);
  const checkins = useMemo(() => checkinAverages(data, from, to), [data, from, to]);
  const consistency = useMemo(() => consistencyIndex(data, from, to), [data, from, to]);
  const prs = useMemo(() => personalRecords(data).slice(0, 5), [data]);
  const goalsWeek = weeklyGoalProgress(data, weekKey(t));

  const weightWeighIns = useMemo(() => [...data.weighIns].sort((a, b) => a.date.localeCompare(b.date)), [data.weighIns]);
  const latestWeighIn = weightWeighIns[weightWeighIns.length - 1];
  const previousWeighIn = weightWeighIns[weightWeighIns.length - 2];
  const weightDelta = latestWeighIn && previousWeighIn ? latestWeighIn.weightKg - previousWeighIn.weightKg : null;
  const thisWeekWeighIn = data.weighIns.find((w) => weekKey(w.date) === weekKey(t));
  const weightData = weightWeighIns.slice(-16).map((w) => ({ date: w.date, weight: w.weightKg }));
  const weightDeltaLabel = weightDelta == null
    ? null
    : `${weightDelta > 0 ? '+' : weightDelta < 0 ? '−' : ''}${fmtWeight(Math.abs(weightDelta), data.profile.units)}`;

  const hasTraining = sessions.length > 0;
  const hasHabits = data.habits.some((h) => !h.archived);
  const hasTasks = data.tasks.length > 0;
  const hasNutrition = nutritionSeriesData.some((d) => d.meals > 0);
  const hasWellbeing = data.checkins.some((c) => c.date >= from && c.date <= to);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Centro de estadísticas</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Tu progreso, en datos reales.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Todo se calcula con lo que registraste. Si un gráfico está vacío, es porque todavía no hay datos en ese período.
          </p>
        </div>
        <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-pad flex items-center gap-3.5">
          <ProgressRing value={consistency} size={68} stroke={5} label={<span className="metric text-[1rem]">{consistency}</span>} />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-medium text-muted">Índice de consistencia</p>
            <p className="mt-1 text-[0.78rem] font-medium text-ink">{consistency >= 70 ? 'Sostenido' : consistency >= 40 ? 'En construcción' : consistency > 0 ? 'Retomando' : 'Empezando'}</p>
            <p className="text-[0.64rem] text-faint">{RANGE_LABELS[range]}</p>
          </div>
        </Card>
        <SummaryStat icon={<Dumbbell size={14} />} label="Entrenamientos" value={String(sessions.length)} hint={`${fmtCompact(volume)} kg de volumen`} />
        <SummaryStat icon={<ListChecks size={14} />} label="Hábitos" value={`${Math.round(habitConsistency)}%`} hint="consistencia promedio" />
        <SummaryStat icon={<Sparkles size={14} />} label="Foco" value={`${fmtNum(focusTotal)} min`} hint={`${stats.completed} tareas completadas`} />
      </section>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <ChartCard
          title="Tendencia de peso"
          subtitle="Últimos 16 pesajes semanales. La línea importa más que un número aislado."
          empty={weightData.length < 2}
          emptyHint={weightData.length === 0 ? 'Registrá tu primer pesaje semanal para empezar la serie.' : 'Con dos pesajes ya podés ver la tendencia. El primero queda guardado.'}
          height={210}
          action={<button className="btn btn-secondary btn-sm" onClick={() => actions.openWeighIn(thisWeekWeighIn ?? null)}><Scale size={13} /> {thisWeekWeighIn ? 'Actualizar' : 'Pesaje'}</button>}
        >
          <TrendChart
            data={weightData}
            xKey="date"
            kind="line"
            xFormatter={(v) => fmtDateShort(String(v))}
            valueFormatter={(v) => fmtWeight(v, data.profile.units)}
            series={[{ key: 'weight', label: 'Peso', color: 'var(--accent)' }]}
          />
        </ChartCard>

        <Card className="card-pad flex flex-col">
          <SectionHead
            title="Pesaje semanal"
            subtitle="Un registro por semana, siempre que puedas."
            action={thisWeekWeighIn ? <Badge tone="accent">Al día</Badge> : <Badge>Pendiente</Badge>}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <p className="metric text-[1.8rem]">{latestWeighIn ? fmtWeight(latestWeighIn.weightKg, data.profile.units) : '—'}</p>
              <p className="mt-0.5 text-[0.67rem] text-faint">
                {latestWeighIn ? `Último pesaje · ${fmtDateShort(latestWeighIn.date)}` : 'Todavía no hay pesajes'}
              </p>
            </div>
            {weightDeltaLabel ? (
              <div className="text-right">
                <p className="num text-[0.82rem] font-medium text-ink-soft">{weightDeltaLabel}</p>
                <p className="text-[0.62rem] text-faint">vs. pesaje anterior</p>
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
            <p className="text-[0.72rem] font-medium text-ink">
              {thisWeekWeighIn ? 'Esta semana ya está registrado' : 'Falta el pesaje de esta semana'}
            </p>
            <p className="mt-0.5 text-[0.66rem] leading-snug text-faint">
              {thisWeekWeighIn ? `${fmtDateShort(thisWeekWeighIn.date)} · podés actualizarlo si cambió.` : 'Elegí un momento tranquilo y siempre parecido.'}
            </p>
            <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => actions.openWeighIn(thisWeekWeighIn ?? null)}>
              <Scale size={13} /> {thisWeekWeighIn ? 'Actualizar pesaje' : 'Registrar pesaje'}
            </button>
          </div>

          {weightWeighIns.length > 0 ? (
            <div className="mt-3">
              <p className="label">Últimos pesajes</p>
              <div className="mt-1 divide-y divide-line">
                {weightWeighIns.slice(-4).reverse().map((w) => (
                  <button
                    key={w.id}
                    onClick={() => actions.openWeighIn(w)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-panel-2"
                  >
                    <span className="text-[0.72rem] text-muted">{fmtDateShort(w.date)}</span>
                    <span className="num text-[0.75rem] font-medium text-ink">{fmtWeight(w.weightKg, data.profile.units)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
              {data.profile.weightKg != null
                ? `Tu perfil tiene ${fmtWeight(data.profile.weightKg, data.profile.units)}. El primer pesaje arranca la serie.`
                : 'El primer pesaje arranca la serie. No hace falta completar nada más.'}
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Frecuencia de entrenamiento"
          subtitle="Sesiones completadas por semana."
          empty={!hasTraining}
          emptyHint="Registrá tu primer entrenamiento desde Gym para empezar la serie."
          height={210}
        >
          <TrendChart data={weekly} xKey="label" kind="bar" valueFormatter={(v) => `${v} sesiones`} series={[{ key: 'count', label: 'Sesiones', color: 'var(--accent)' }]} reference={{ value: data.settings.weeklyWorkoutGoal }} />
        </ChartCard>
        <ChartCard
          title="Volumen por semana"
          subtitle="Peso × repeticiones completadas."
          empty={!hasTraining}
          height={210}
        >
          <TrendChart data={weekly} xKey="label" kind="area" valueFormatter={(v) => `${fmtNum(v)} kg`} series={[{ key: 'volume', label: 'Volumen', color: 'var(--info)' }]} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <ChartCard
          title="Cumplimiento de hábitos"
          subtitle="Porcentaje diario de hábitos programados cumplidos."
          empty={!hasHabits}
          emptyHint="Creá hábitos en la sección Habits para ver tu consistencia."
          height={230}
        >
          <TrendChart data={habitSeries} xKey="date" kind="area" xFormatter={fmtRange} valueFormatter={(v) => `${v}%`} yTickFormatter={(v) => `${v}%`} domain={[0, 100]} series={[{ key: 'rate', label: 'Cumplimiento', color: 'var(--accent)' }]} />
        </ChartCard>

        <Card className="card-pad">
          <SectionHead title="Reparto muscular" subtitle="Volumen por grupo en el período." />
          {muscle.length ? (
            <>
              <DonutChart
                data={muscle.slice(0, 6).map((m) => ({ name: m.group, value: Math.round(m.volume) }))}
                centerLabel="kg"
                centerValue={fmtCompact(sum(muscle.map((m) => m.volume)))}
                colors={['var(--accent)', 'var(--info)', 'var(--warn)', '#D79BB0', '#C3B1E1', 'var(--faint)']}
              />
              <div className="mt-1 space-y-1">
                {muscle.slice(0, 4).map((m, i) => (
                  <div key={m.group} className="flex items-center justify-between text-[0.7rem]">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ['var(--accent)', 'var(--info)', 'var(--warn)', '#D79BB0', '#C3B1E1', 'var(--faint)'][i % 6] }} />
                      {m.group}
                    </span>
                    <span className="num text-faint">{m.sets} series</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState compact title="Sin volumen registrado" description="Completá series con peso para ver el reparto por grupo muscular." />
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Tareas completadas" subtitle="Cantidad por día." empty={!hasTasks} emptyHint="Creá y completá tareas en Productivity." height={200}>
          <TrendChart data={taskSeries} xKey="date" kind="bar" xFormatter={fmtRange} valueFormatter={(v) => `${v} tareas`} series={[{ key: 'count', label: 'Tareas', color: 'var(--accent)' }]} />
        </ChartCard>
        <ChartCard title="Tiempo de concentración" subtitle="Minutos de foco registrados con Pomodoro." empty={focusTotal === 0} emptyHint="Usá el Pomodoro en Productivity; cada bloque completado se suma acá." height={200}>
          <TrendChart data={focusSeries} xKey="date" kind="area" xFormatter={fmtRange} valueFormatter={(v) => `${v} min`} series={[{ key: 'minutes', label: 'Minutos', color: 'var(--warn)' }]} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Nutrición registrada"
          subtitle="Días con comidas anotadas. Sin metas rígidas."
          empty={!hasNutrition}
          emptyHint="Registrá comidas cuando te sirva: el gráfico solo muestra esos días."
          height={200}
        >
          <TrendChart data={nutritionSeriesData} xKey="date" kind="area" xFormatter={fmtRange} valueFormatter={(v) => `${v} kcal`} series={[{ key: 'kcal', label: 'kcal', color: 'var(--accent)' }]} />
        </ChartCard>
        <ChartCard
          title="Bienestar"
          subtitle="Sueño, energía, ánimo y recuperación."
          empty={!hasWellbeing}
          emptyHint="Completá un check-in (sueño, energía, ánimo) para empezar a ver patrones."
          height={200}
          action={<button className="btn btn-ghost btn-sm !text-[0.68rem]" onClick={() => actions.openCheckin(t)}>Check-in</button>}
        >
          <TrendChart
            data={wellbeing}
            xKey="date"
            kind="line"
            xFormatter={fmtRange}
            valueFormatter={(v, key) => (key === 'sleepH' ? `${fmtNum(v, 1)} h` : `${fmtNum(v, 1)}/5`)}
            series={[
              { key: 'sleepH', label: 'Sueño', color: 'var(--info)' },
              { key: 'energy', label: 'Energía', color: 'var(--accent)' },
              { key: 'mood', label: 'Ánimo', color: '#C3B1E1' },
              { key: 'recovery', label: 'Recuperación', color: 'var(--warn)' },
            ]}
          />
          <ChartLegend items={[{ label: 'Sueño (h)', color: 'var(--info)' }, { label: 'Energía', color: 'var(--accent)' }, { label: 'Ánimo', color: '#C3B1E1' }, { label: 'Recuperación', color: 'var(--warn)' }]} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="card-pad">
          <SectionHead title="Promedios de bienestar" subtitle="Solo sobre los check-ins del período." />
          {checkins.nights ? (
            <div className="space-y-2.5">
              {[
                { label: 'Sueño', value: `${fmtNum(checkins.sleepH, 1)} h`, pct: pct(checkins.sleepH, data.settings.sleepGoalH) },
                { label: 'Energía', value: `${fmtNum(checkins.energy, 1)}/5`, pct: pct(checkins.energy, 5) },
                { label: 'Ánimo', value: `${fmtNum(checkins.mood, 1)}/5`, pct: pct(checkins.mood, 5) },
                { label: 'Recuperación', value: `${fmtNum(checkins.recovery, 1)}/5`, pct: pct(checkins.recovery, 5) },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-[0.72rem]">
                    <span className="text-muted">{row.label}</span>
                    <span className="num text-ink-soft">{row.value}</span>
                  </div>
                  <Meter value={row.pct} height={4} tone={row.pct >= 70 ? 'accent' : 'warn'} />
                </div>
              ))}
              <p className="pt-1 text-[0.65rem] text-faint">Basado en {checkins.nights} check-in{checkins.nights === 1 ? '' : 's'}.</p>
            </div>
          ) : (
            <EmptyState compact icon={<Moon size={16} />} title="Sin check-ins" description="Registrá cómo dormiste para ver tu recuperación." action={<button className="btn btn-secondary btn-sm" onClick={() => actions.openCheckin(t)}>Hacer check-in</button>} />
          )}
        </Card>

        <Card className="card-pad">
          <SectionHead title="Récords personales" subtitle="Marcas vigentes por ejercicio." action={<button className="btn btn-ghost btn-sm !text-[0.68rem]" onClick={() => navigate('gym')}>Ver todos</button>} />
          {prs.length ? (
            <div className="space-y-1">
              {prs.map((pr) => (
                <div key={pr.name} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-panel-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Flame size={11} className="shrink-0 text-accent" />
                    <span className="truncate text-[0.75rem] text-ink-soft">{pr.name}</span>
                  </span>
                  <span className="num shrink-0 text-[0.74rem] font-medium text-ink">{fmtNum(pr.bestWeight)} kg</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="Sin récords" description="Se detectan al registrar series con más peso que antes." />
          )}
        </Card>

        <Card className="card-pad">
          <SectionHead title="Resumen del período" subtitle={RANGE_LABELS[range]} />
          <div className="space-y-2">
            <RowLine label="Sesiones" value={String(sessions.length)} />
            <RowLine label="Volumen total" value={`${fmtCompact(volume)} kg`} />
            <RowLine label="Duración media" value={durations.length ? fmtDuration(avg(durations)) : '—'} />
            <RowLine label="Tareas completadas" value={String(stats.completed)} />
            <RowLine label="Foco total" value={`${fmtNum(focusTotal)} min`} />
            <RowLine label="Objetivos de esta semana" value={`${goalsWeek.done}/${goalsWeek.total}`} />
            <RowLine label="Agua (promedio diario)" value={`${fmtNum(avg(Array.from({ length: days }, (_, i) => waterDay(data, addDays(from, i)))))} ml`} />
          </div>
          {!hasTraining && !hasTasks && !hasHabits ? (
            <p className="mt-3 rounded-lg border border-dashed border-line px-2.5 py-2 text-[0.7rem] leading-relaxed text-faint">
              Todavía no hay suficiente información en este período. Empezá por lo más simple: una sesión de gym, un hábito marcado o una tarea completada.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[0.68rem] text-faint">
        <span className="flex items-center gap-1.5"><Activity size={12} /> Período: {fmtDateShort(from)} → {fmtDateShort(to)}</span>
        <div className="flex items-center gap-2">
          <Badge tone="outline">Datos locales</Badge>
          <button className="flex items-center gap-1 hover:text-ink" onClick={() => navigate('insights')}>Smart Insights <ChevronRight size={11} /></button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <p className="text-[0.69rem] font-medium text-muted">{label}</p>
        <span className="text-faint">{icon}</span>
      </div>
      <p className="metric mt-2 text-[1.35rem]">{value}</p>
      <p className="mt-0.5 truncate text-[0.65rem] text-faint">{hint}</p>
    </div>
  );
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[0.74rem]">
      <span className="text-muted">{label}</span>
      <span className="num font-medium text-ink-soft">{value}</span>
    </div>
  );
}

const avg = (arr: number[]): number => (arr.length ? sum(arr) / arr.length : 0);

void BarChart3; void TrendingUp; void CalendarCheck2; void Apple; void startOfWeek; void cn;
