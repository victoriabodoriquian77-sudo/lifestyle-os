import { useMemo } from 'react';
import {
  ArrowRight, Check, Circle, Droplets, Dumbbell, Flame, ListChecks, Plus, Sparkles, Target, TrendingUp, Utensils,
} from 'lucide-react';
import { mutateData, useAppStore } from '@/store/store';
import { navigate } from '@/lib/router';
import { useActions } from '@/components/actions/ActionsProvider';
import { useClock } from '@/components/layout/Topbar';
import { addDays, fmtDateLong, fmtTime, greeting, today, weekKey } from '@/lib/date';
import {
  dayHabitProgress, dayNutrition, dayScore, habitCountOn, habitTargetFor, habitStreak,
  lastNDates, waterDay, weeklyGoalProgress, workoutWeekStreak, sessionsInRange, taskStats,
} from '@/lib/metrics';
import { buildInsights } from '@/lib/insights';
import { addWater, toggleHabitOn, toggleTaskDone } from '@/lib/domain';
import { cn, fmtMl, fmtNum, pct } from '@/lib/utils';
import { Badge, Card, EmptyState, Meter, ProgressRing, SectionHead } from '@/components/ui/Primitives';
import { toast } from '@/components/ui/Toast';
import { habitIcon } from '@/lib/icons';

const QUOTES = [
  'La disciplina es elegir entre lo que querés ahora y lo que querés más.',
  'La constancia no se mide en días perfectos, sino en los días que volviste.',
  'El progreso es la suma de pequeñas decisiones repetidas.',
  'Entrenar es un acto de respeto hacia tu futuro.',
  'No necesitás motivación todos los días. Necesitás un sistema que funcione cuando no la tengas.',
  'Comer bien no es castigo: es energía para lo que querés hacer.',
  'El descanso también es parte del entrenamiento.',
  'Ordenar el día es ordenar la cabeza.',
  'Compararte con tu versión de ayer es la única comparación útil.',
  'Empezar es más importante que empezar perfecto.',
  'La fuerza se construye en semanas, la confianza en años.',
  'Hacé lo mínimo que puedas sostener, y sostenelo.',
  'Un hábito es una promesa que te hacés y te cumplís.',
  'La productividad sostenible no es hacer más, es elegir mejor.',
  'Tu cuerpo registra cada vez que aparecés.',
  'Avanzar lento sigue siendo avanzar.',
  'La recuperación no es debilidad, es estrategia.',
  'El mejor plan es el que podés repetir el lunes.',
];

const quoteOfDay = (): { text: string } => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return { text: QUOTES[day % QUOTES.length] };
};

export function Overview() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const now = useClock();
  const t = today();
  const firstName = data.profile.name.trim().split(/\s+/)[0] ?? '';

  const habits = useMemo(() => data.habits.filter((h) => !h.archived), [data.habits]);
  const habitProgress = useMemo(() => dayHabitProgress(data, t), [data, t]);
  const nutrition = useMemo(() => dayNutrition(data, t), [data, t]);
  const water = useMemo(() => waterDay(data, t), [data, t]);
  const score = useMemo(() => dayScore(data, t), [data, t]);
  const streak = useMemo(() => workoutWeekStreak(data, t), [data, t]);
  const week = useMemo(() => weeklyGoalProgress(data, weekKey(t)), [data, t]);
  const insights = useMemo(() => buildInsights(data).slice(0, 2), [data]);
  const todayWorkout = useMemo(
    () => data.routines.find((r) => r.weekday === new Date().getDay()) ?? null,
    [data.routines],
  );
  const active = useMemo(() => data.sessions.find((s) => s.status === 'active') ?? null, [data.sessions]);
  const todaySessions = useMemo(() => sessionsInRange(data, t, t), [data, t]);

  const tasks = useMemo(() => {
    const open = data.tasks.filter((x) => x.status !== 'done');
    const due = open.filter((x) => x.dueDate && x.dueDate <= t);
    const overdue = open.filter((x) => x.dueDate && x.dueDate < t);
    return { due: due.slice(0, 5), overdue: overdue.length, open: open.length, stats: taskStats(data, addDays(t, -29), t) };
  }, [data, t]);

  const weekScores = useMemo(() => lastNDates(7, t).map((d) => ({ date: d, score: dayScore(data, d).score })), [data, t]);
  const scheduledHabits = useMemo(
    () => habits.filter((h) => h.frequency.type === 'daily' || (h.frequency.type === 'days' && h.frequency.days.includes(new Date().getDay()))),
    [habits],
  );

  const quote = quoteOfDay();

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------------------- hero */}
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-faint">
            <span>{fmtDateLong(t)}</span>
            <span className="h-1 w-1 rounded-full bg-faint/40" />
            <span className="num">{fmtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}</span>
          </div>
          <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.05rem]">
            {greeting(now)}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-2 max-w-xl text-[0.83rem] leading-relaxed text-muted">
            <span className="text-ink-soft">“{quote.text}”</span>
          </p>
          {data.profile.goal ? <p className="mt-1.5 text-[0.72rem] text-faint">Objetivo actual · {data.profile.goal}</p> : null}
          {!data.profile.name ? (
            <button className="btn btn-secondary btn-sm mt-3" onClick={() => navigate('settings')}>
              Configurar mi perfil <ArrowRight size={13} />
            </button>
          ) : null}
        </div>

        <Card className="w-full shrink-0 p-4 lg:w-[330px]">
          <div className="flex items-center gap-4">
            <ProgressRing value={score.score} size={84} stroke={6} label={<span className="metric text-[1.3rem]">{score.score}</span>} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Daily performance</p>
              <p className="mt-1 text-[0.86rem] font-semibold leading-tight text-ink">
                {score.score >= 85 ? 'Día sólido' : score.score >= 60 ? 'Buen ritmo' : score.score > 0 ? 'En marcha' : 'Todo por empezar'}
              </p>
              <p className="mt-1 text-[0.72rem] leading-snug text-faint">
                {score.components.filter((c) => c.applicable).length
                  ? `${score.components.filter((c) => c.applicable).map((c) => c.label.toLowerCase()).slice(0, 3).join(' · ')}`
                  : 'Registrá hábitos, agua o una comida para ver tu día.'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong" onClick={() => actions.openCheckin(t)}>
              <Sparkles size={13} className="text-accent" />
              <span className="text-[0.71rem] font-medium text-ink-soft">Check-in</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong"
              onClick={() => { mutateData((d) => addWater(d, 250)); toast.success('+250 ml de agua'); }}
            >
              <Droplets size={13} className="text-info" />
              <span className="text-[0.71rem] font-medium text-ink-soft">+250 ml</span>
            </button>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------ diario */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DailyMetric
          label="Hábitos"
          value={habitProgress.scheduled ? `${Math.round(habitProgress.pct)}%` : '—'}
          detail={habitProgress.scheduled ? `${habitProgress.done} de ${habitProgress.scheduled}` : 'sin hábitos'}
          icon={<ListChecks size={14} />}
          meter={habitProgress.pct}
          onClick={() => navigate('habits')}
        />
        <DailyMetric
          label="Agua"
          value={fmtMl(water, data.profile.units)}
          detail={`objetivo ${fmtMl(data.settings.waterGoalMl, data.profile.units)}`}
          icon={<Droplets size={14} />}
          meter={pct(water, data.settings.waterGoalMl)}
          onClick={() => { mutateData((d) => addWater(d, 250)); toast.success('+250 ml'); }}
        />
        <DailyMetric
          label="Entrenamiento"
          value={todaySessions.length ? 'Hecho' : todayWorkout ? 'Programado' : 'Libre'}
          detail={todaySessions.length ? `${fmtNum(todaySessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.sets.filter((y) => y.completed).length, 0), 0))} series` : todayWorkout?.name ?? 'sin rutina para hoy'}
          icon={<Dumbbell size={14} />}
          meter={todaySessions.length ? 100 : 0}
          onClick={() => navigate('gym')}
        />
        <DailyMetric
          label="Racha"
          value={`${streak}`}
          detail={streak === 1 ? 'semana entrenando' : 'semanas entrenando'}
          icon={<Flame size={14} />}
          meter={Math.min(100, streak * 20)}
          onClick={() => navigate('progress')}
        />
      </section>

      {/* -------------------------------------------------- daily performance */}
      <Card className="card-pad">
        <SectionHead
          title="Daily performance"
          subtitle="Cómo se compone tu día, según lo que registraste."
          action={<span className="chip chip-outline">{fmtDateLong(t)}</span>}
        />
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex items-center gap-4">
            <ProgressRing value={score.score} size={104} stroke={7} sublabel="score" />
            <div className="min-w-0 flex-1 space-y-1.5">
              {score.components.filter((c) => c.applicable).length === 0 ? (
                <p className="text-[0.75rem] leading-relaxed text-faint">
                  Todavía no hay nada registrado hoy. El score se arma solo con tus datos.
                </p>
              ) : (
                score.components.filter((c) => c.applicable).map((c) => (
                  <div key={c.key}>
                    <div className="mb-0.5 flex items-center justify-between text-[0.68rem]">
                      <span className="text-muted">{c.label}</span>
                      <span className="num text-faint">{Math.round(c.value)}%</span>
                    </div>
                    <Meter value={c.value} height={4} tone={c.value >= 80 ? 'accent' : c.value >= 40 ? 'warn' : 'muted'} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-panel-2/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.7rem] font-medium text-muted">Últimos 7 días</p>
                <span className="text-[0.64rem] text-faint">score diario</span>
              </div>
              <div className="flex h-[76px] items-end gap-1.5">
                {weekScores.map((d) => (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={cn('w-full rounded-t-[3px] transition-all', d.score >= 70 ? 'bg-accent/80' : d.score >= 35 ? 'bg-accent/40' : 'bg-panel-3')}
                        style={{ height: `${Math.max(4, d.score)}%` }}
                        title={`${d.date}: ${d.score}`}
                      />
                    </div>
                    <span className="text-[0.56rem] uppercase text-faint">{['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(d.date + 'T12:00:00').getDay()]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-panel-2/50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[0.7rem] font-medium text-muted">Semana actual</p>
                <span className="text-[0.64rem] text-faint">{week.done}/{week.total} objetivos</span>
              </div>
              {data.weeklyGoals.filter((g) => g.weekKey === weekKey(t)).length ? (
                <div className="mt-1 space-y-1">
                  {data.weeklyGoals.filter((g) => g.weekKey === weekKey(t)).slice(0, 3).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => mutateData((d) => { const x = d.weeklyGoals.find((y) => y.id === g.id); if (x) x.done = !x.done; })}
                      className="flex w-full items-center gap-1.5 text-left"
                    >
                      <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border', g.done ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong')}>
                        {g.done ? <Check size={9} strokeWidth={3} /> : null}
                      </span>
                      <span className={cn('truncate text-[0.72rem]', g.done ? 'checked-line' : 'text-ink-soft')}>{g.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => actions.openGoal()} className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-line px-2 py-2 text-[0.72rem] text-faint hover:border-accent-line hover:text-accent">
                  <Plus size={12} /> Agregar objetivo semanal
                </button>
              )}
              {week.total > 0 ? <Meter value={week.pct} className="mt-2.5" height={4} /> : null}
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* entrenamiento */}
        <Card className="card-pad flex flex-col">
          <SectionHead
            title="Entrenamiento"
            subtitle="Lo que toca hoy"
            action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => navigate('gym')} aria-label="Ir a Gym"><ArrowRight size={14} /></button>}
          />
          {active ? (
            <div className="rounded-xl border border-accent-line bg-accent-soft p-3">
              <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-accent"><span className="dot bg-accent animate-pulse-soft" /> Sesión en curso</p>
              <p className="mt-1 text-[0.86rem] font-medium text-ink">{active.name}</p>
              <p className="text-[0.7rem] text-muted">{active.exercises.filter((e) => e.sets.some((s) => s.completed)).length} de {active.exercises.length} ejercicios empezados</p>
              <button className="btn btn-primary btn-sm mt-2.5 w-full" onClick={() => navigate('gym')}>Retomar sesión</button>
            </div>
          ) : todaySessions.length ? (
            <div className="rounded-xl border border-line bg-panel-2 p-3">
              <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-accent"><Check size={12} /> Completado</p>
              <p className="mt-1 text-[0.86rem] font-medium text-ink">{todaySessions[0].name}</p>
              <p className="text-[0.7rem] text-faint">Buen trabajo. El descanso también suma.</p>
            </div>
          ) : todayWorkout ? (
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="rounded-xl border border-line bg-panel-2 p-3">
                <div className="mb-1 flex flex-wrap gap-1">
                  {todayWorkout.muscleGroups.slice(0, 3).map((g) => <Badge key={g} tone="outline">{g}</Badge>)}
                </div>
                <p className="text-[0.88rem] font-medium text-ink">{todayWorkout.name}</p>
                <p className="mt-0.5 text-[0.7rem] text-faint">{todayWorkout.exercises.length} ejercicios · {todayWorkout.exercises.reduce((a, e) => a + e.sets, 0)} series</p>
              </div>
              <button className="btn btn-primary w-full" onClick={() => actions.startWorkout(todayWorkout.id)}><Dumbbell size={14} /> Empezar entrenamiento</button>
            </div>
          ) : data.routines.length ? (
            <div className="flex flex-1 flex-col justify-between gap-3">
              <p className="text-[0.78rem] leading-relaxed text-muted">Hoy no hay una rutina asignada. Podés elegir una y entrenar igual.</p>
              <div className="space-y-1">
                {data.routines.slice(0, 3).map((r) => (
                  <button key={r.id} className="flex w-full items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-left hover:border-line-strong" onClick={() => actions.startWorkout(r.id)}>
                    <span className="truncate text-[0.76rem] text-ink-soft">{r.name}</span>
                    <ArrowRight size={12} className="text-faint" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState compact icon={<Dumbbell size={17} />} title="Sin rutinas todavía" description="Importá tu planilla o creá tu primera rutina." action={<button className="btn btn-primary btn-sm" onClick={() => navigate('gym')}>Configurar Gym</button>} />
          )}
        </Card>

        {/* tareas */}
        <Card className="card-pad flex flex-col">
          <SectionHead
            title="Tareas"
            subtitle={tasks.open ? `${tasks.open} abiertas${tasks.overdue ? ` · ${tasks.overdue} vencidas` : ''}` : 'Sin pendientes'}
            action={
              <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openTask()} aria-label="Nueva tarea"><Plus size={14} /></button>
            }
          />
          {tasks.due.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
              <p className="text-[0.8rem] font-medium text-ink-soft">Nada para hoy</p>
              <p className="mt-1 text-[0.72rem] text-faint">Sin vencimientos. Aprovechá para adelantar algo o descansar.</p>
              <button className="btn btn-secondary btn-sm mt-3" onClick={() => actions.openTask()}>Agregar tarea</button>
            </div>
          ) : (
            <div className="flex-1 space-y-0.5">
              {tasks.due.map((task) => (
                <div key={task.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-panel-2">
                  <button
                    className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', task.status === 'done' ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong hover:border-accent')}
                    onClick={() => { mutateData((d) => { const x = d.tasks.find((y) => y.id === task.id); if (x) toggleTaskDone(d, x); }); }}
                    aria-label="Completar tarea"
                  >
                    {task.status === 'done' ? <Check size={10} strokeWidth={3} /> : null}
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => actions.openTask(task)}>
                    <span className={cn('block truncate text-[0.79rem]', task.status === 'done' ? 'checked-line' : 'text-ink-soft')}>{task.title}</span>
                    <span className={cn('text-[0.66rem]', task.dueDate && task.dueDate < t ? 'text-danger' : 'text-faint')}>
                      {task.dueDate === t ? 'Hoy' : task.dueDate ? task.dueDate : 'sin fecha'}
                      {task.priority === 'high' ? ' · prioridad alta' : ''}
                    </span>
                  </button>
                </div>
              ))}
              {tasks.stats.overdue > 0 ? (
                <button className="mt-1 flex items-center gap-1 text-[0.7rem] font-medium text-danger hover:underline" onClick={() => navigate('productivity')}>
                  {tasks.stats.overdue} tareas vencidas <ArrowRight size={11} />
                </button>
              ) : null}
            </div>
          )}
        </Card>

        {/* nutrición */}
        <Card className="card-pad flex flex-col">
          <SectionHead
            title="Nutrición"
            subtitle={nutrition.meals ? `${nutrition.meals} comida${nutrition.meals === 1 ? '' : 's'} registrada${nutrition.meals === 1 ? '' : 's'}` : 'Sin registros hoy'}
            action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openMeal({ date: t })} aria-label="Registrar comida"><Plus size={14} /></button>}
          />
          {nutrition.meals ? (
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                <Nutrient label="kcal" value={fmtNum(nutrition.kcal)} />
                <Nutrient label="prot." value={fmtNum(nutrition.protein)} />
                <Nutrient label="carb." value={fmtNum(nutrition.carbs)} />
                <Nutrient label="grasas" value={fmtNum(nutrition.fat)} />
              </div>
              {data.settings.nutritionGoals.kcal ? (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[0.64rem] text-faint">Meta calórica</span>
                    <span className="num text-[0.62rem] text-faint">{Math.round(pct(nutrition.kcal, data.settings.nutritionGoals.kcal))}%</span>
                  </div>
                  <Meter value={pct(nutrition.kcal, data.settings.nutritionGoals.kcal)} height={4} />
                </div>
              ) : null}
              <div className="space-y-1">
                {data.meals.filter((m) => m.date === t).slice(0, 4).map((m) => (
                  <button key={m.id} onClick={() => actions.openMeal({ meal: m })} className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-panel-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Utensils size={11} className="shrink-0 text-faint" />
                      <span className="truncate text-[0.76rem] text-ink-soft">{m.category}</span>
                    </span>
                    <span className="shrink-0 text-[0.66rem] text-faint">{m.items.length} alim.</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
              <p className="text-[0.8rem] font-medium text-ink-soft">Sin comidas registradas</p>
              <p className="mt-1 text-[0.72rem] leading-snug text-faint">El registro es opcional. Si te sirve, anotá una comida para empezar.</p>
              <button className="btn btn-secondary btn-sm mt-3" onClick={() => actions.openMeal({ date: t })}>Registrar comida</button>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <Droplets size={13} className="text-info" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.7rem] text-muted">{fmtMl(water, data.profile.units)}</span>
                <span className="text-[0.64rem] text-faint">{Math.round(pct(water, data.settings.waterGoalMl))}%</span>
              </div>
              <Meter value={pct(water, data.settings.waterGoalMl)} height={4} className="mt-1" tone="info" />
            </div>
            <button className="btn btn-secondary btn-sm !min-h-[1.7rem] !px-2" onClick={() => { mutateData((d) => addWater(d, 250)); toast.success('+250 ml'); }}>+250</button>
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------------- hábitos hoy */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="card-pad">
          <SectionHead
            title="Hábitos de hoy"
            subtitle={scheduledHabits.length ? `${habitProgress.done} de ${scheduledHabits.length} completados` : 'Configurá tus hábitos para empezar'}
            action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('habits')}>Ver todos <ArrowRight size={12} /></button>}
          />
          {scheduledHabits.length === 0 ? (
            <EmptyState
              compact
              icon={<ListChecks size={17} />}
              title="Sin hábitos programados"
              description="Los hábitos sostienen el resto del sistema. Podés empezar con una lista sugerida y editarla después."
              action={<button className="btn btn-primary btn-sm" onClick={() => navigate('habits')}>Crear hábitos</button>}
            />
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {scheduledHabits.slice(0, 8).map((habit) => {
                const Icon = habitIcon(habit.icon);
                const count = habitCountOn(data, habit.id, t);
                const done = count >= habitTargetFor(habit);
                return (
                  <button
                    key={habit.id}
                    onClick={() => { let nowDone = false; mutateData((d) => { const h = d.habits.find((x) => x.id === habit.id); if (h) nowDone = toggleHabitOn(d, h, t); }); if (nowDone) toast.success('Hábito completado', habit.name); }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all',
                      done ? 'border-accent-line bg-accent-soft' : 'border-line bg-panel-2/50 hover:border-line-strong',
                    )}
                  >
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', done ? 'border-transparent bg-accent text-[var(--accent-ink)]' : 'border-line text-muted')}>
                      {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[0.78rem] font-medium', done ? 'text-ink' : 'text-ink-soft')}>{habit.name}</span>
                      <span className="block text-[0.64rem] text-faint">{done ? 'cumplido' : habit.timeOfDay ?? 'pendiente'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <SectionHead title="Próximos objetivos" subtitle="Esta semana" action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openGoal()} aria-label="Agregar objetivo"><Plus size={14} /></button>} />
          {data.weeklyGoals.filter((g) => g.weekKey === weekKey(t)).length === 0 ? (
            <EmptyState compact icon={<Target size={17} />} title="Sin objetivos esta semana" description="Definí uno o dos objetivos concretos. Menos es más." action={<button className="btn btn-secondary btn-sm" onClick={() => actions.openGoal()}>Agregar objetivo</button>} />
          ) : (
            <div className="space-y-1">
              {data.weeklyGoals.filter((g) => g.weekKey === weekKey(t)).map((g) => (
                <button key={g.id} onClick={() => mutateData((d) => { const x = d.weeklyGoals.find((y) => y.id === g.id); if (x) x.done = !x.done; })} className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-panel-2">
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', g.done ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong')}>
                    {g.done ? <Check size={10} strokeWidth={3} /> : null}
                  </span>
                  <span className={cn('text-[0.79rem]', g.done ? 'checked-line' : 'text-ink-soft')}>{g.text}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.7rem] font-medium text-muted">Consistencia de hábitos</p>
              <span className="text-[0.66rem] text-faint">28 días</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {habits.map((h) => (
                <div key={h.id} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-1" title={`${h.name}: racha ${habitStreak(data, h, t)} días`}>
                  <span className="dot" style={{ background: h.color }} />
                  <span className="max-w-[5.5rem] truncate text-[0.64rem] text-faint">{h.name}</span>
                  <span className="num text-[0.64rem] font-medium text-ink-soft">{habitStreak(data, h, t)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------------- insights */}
      <Card className="card-pad">
        <SectionHead
          title={<span className="flex items-center gap-1.5"><Sparkles size={14} className="text-accent" /> Smart Insights</span>}
          subtitle="Observaciones calculadas con tus registros reales."
          action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('insights')}>Ver todos <ArrowRight size={12} /></button>}
        />
        <div className="grid gap-2 md:grid-cols-2">
          {insights.map((ins) => (
            <div key={ins.id} className="rounded-xl border border-line bg-panel-2/50 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className={cn('dot', ins.tone === 'positive' ? 'bg-accent' : ins.tone === 'attention' ? 'bg-warn' : 'bg-faint')} />
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-faint">{ins.area}</span>
              </div>
              <p className="text-[0.82rem] font-medium text-ink">{ins.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[0.74rem] leading-relaxed text-muted">{ins.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------ footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[0.66rem] text-faint">
        <span className="flex items-center gap-1.5"><Circle size={6} className="fill-accent text-accent" /> Datos guardados en este dispositivo</span>
        <span className="flex items-center gap-1.5"><TrendingUp size={11} /> Semana {weekKey(t)}</span>
      </div>
    </div>
  );
}

function DailyMetric({
  label, value, detail, icon, meter, onClick,
}: {
  label: string; value: string; detail: string; icon: React.ReactNode; meter: number; onClick?: () => void;
}) {
  return (
    <button className="card card-pad text-left transition-colors hover:border-line-strong" onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-[0.71rem] font-medium text-muted">{label}</span>
        <span className="text-faint">{icon}</span>
      </div>
      <p className="metric mt-2 text-[1.35rem] text-ink">{value}</p>
      <p className="mt-0.5 truncate text-[0.66rem] text-faint">{detail}</p>
      <Meter value={meter} className="mt-2" height={4} />
    </button>
  );
}

function Nutrient({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-1.5 py-1.5 text-center">
      <p className="num text-[0.86rem] font-semibold text-ink">{value}</p>
      <p className="text-[0.58rem] uppercase tracking-[0.06em] text-faint">{label}</p>
    </div>
  );
}
