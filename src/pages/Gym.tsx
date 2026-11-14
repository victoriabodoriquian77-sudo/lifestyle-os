import { useMemo, useState } from 'react';
import {
  ArrowUpRight, BarChart3, CalendarDays, ChevronDown, Clock, Copy, Dumbbell, History, Pencil, Play,
  Plus, Sparkles, Trash2, Trophy, Upload,
} from 'lucide-react';
import type { Routine, WorkoutSession } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { useUI } from '@/store/ui';
import { ImportModal } from '@/components/gym/ImportModal';
import { useConfirm, Modal } from '@/components/ui/Modal';
import { Badge, Card, EmptyState, Field, Meter, SectionHead, Select } from '@/components/ui/Primitives';
import { ChartCard, TrendChart } from '@/components/charts/Charts';
import { useToast } from '@/components/ui/Toast';
import { duplicateRoutine } from '@/lib/domain';
import {
  exerciseSeries, lastExercisePerformance, lastSessionForRoutine, personalRecords, sessionDurationSec,
  sessionVolume, sessionsInRange, workoutWeekStreak,
} from '@/lib/metrics';
import type { RangeKey } from '@/lib/metrics';
import { addDays, fmtDateLong, fmtDateNumeric, fmtDateShort, today, WEEKDAY_MIN, weekday } from '@/lib/date';
import { cn, fmtClock, fmtCompact, fmtDuration, fmtNum, sum } from '@/lib/utils';

type Tab = 'rutinas' | 'historial' | 'progresion' | 'records';

const TABS: Array<{ id: Tab; label: string; icon: typeof Dumbbell }> = [
  { id: 'rutinas', label: 'Rutinas', icon: Dumbbell },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'progresion', label: 'Progresión', icon: BarChart3 },
  { id: 'records', label: 'Récords', icon: Trophy },
];

export function Gym() {
  const [tab, setTab] = useState<Tab>('rutinas');
  const [importOpen, setImportOpen] = useState(false);
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const openWorkout = useUI((s) => s.openWorkout);
  const confirm = useConfirm();
  const t = today();

  const weekVolume = useMemo(
    () => sum(sessionsInRange(data, addDays(t, -6), t).map(sessionVolume)),
    [data, t],
  );
  const weekSessions = useMemo(() => sessionsInRange(data, addDays(t, -6), t), [data, t]);
  const streak = useMemo(() => workoutWeekStreak(data, t), [data, t]);
  const active = useMemo(() => data.sessions.find((s) => s.status === 'active') ?? null, [data.sessions]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Sistema de entrenamiento</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Entrená con un plan, no con memoria.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Rutinas, sesiones y progresión en un solo lugar. Cada serie que registrás alimenta tus gráficos y récords.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => setImportOpen(true)}><Upload size={14} /> Importar planilla</button>
          <button className="btn btn-secondary" onClick={() => actions.openRoutine()}><Plus size={14} /> Nueva rutina</button>
          <button className="btn btn-primary" onClick={() => actions.startWorkout()} disabled={!data.routines.length} title={data.routines.length ? undefined : 'Creá o importá una rutina para empezar'}><Play size={14} /> Entrenar</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Sesiones · 7 días" value={String(weekSessions.length)} hint={`objetivo ${data.settings.weeklyWorkoutGoal}/semana`} />
        <MiniStat label="Volumen · 7 días" value={`${fmtCompact(weekVolume)} kg`} hint="peso × reps completadas" />
        <MiniStat label="Racha" value={`${streak}`} hint={streak === 1 ? 'semana seguida' : 'semanas seguidas'} />
        <MiniStat label="Rutinas" value={String(data.routines.length)} hint={`${data.sessions.filter((s) => s.status === 'completed').length} sesiones historial`} />
      </section>

      {active ? (
        <Card className="flex flex-col items-start justify-between gap-3 border-accent-line bg-accent-soft/50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent"><Dumbbell size={16} /></span>
            <div>
              <p className="text-[0.84rem] font-medium text-ink">Sesión en curso: {active.name}</p>
              <p className="text-[0.72rem] text-muted">
                {active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0)} series registradas · empezó a las {new Date(active.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Descartar sesión en curso',
                  message: 'Se van a perder las series ya registradas. Esta acción no se puede deshacer.',
                  confirmLabel: 'Descartar',
                  tone: 'danger',
                });
                if (!ok) return;
                mutateData((d) => {
                  const s = d.sessions.find((x) => x.id === active.id);
                  if (s) { s.status = 'abandoned'; s.finishedAt = new Date().toISOString(); }
                });
              }}
            >Descartar</button>
            <button className="btn btn-primary btn-sm" onClick={() => openWorkout(active.id)}>Retomar</button>
          </div>
        </Card>
      ) : null}

      <div className="scroll-x flex gap-1 border-b border-line">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.8rem] font-medium transition-colors',
                tab === item.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink-soft',
              )}
            >
              <Icon size={14} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'rutinas' ? <RoutinesTab onImport={() => setImportOpen(true)} /> : null}
      {tab === 'historial' ? <HistoryTab /> : null}
      {tab === 'progresion' ? <ProgressionTab /> : null}
      {tab === 'records' ? <RecordsTab /> : null}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ rutinas */

function RoutinesTab({ onImport }: { onImport: () => void }) {
  const routines = useAppStore((s) => s.data.routines);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [detail, setDetail] = useState<Routine | null>(null);
  const t = today();
  const todayDow = weekday(t);

  if (!routines.length) {
    return (
      <Card className="card-pad">
        <EmptyState
          icon={<Dumbbell size={20} />}
          title="Tu plan de entrenamiento empieza acá"
          description="Importá tu planilla de Excel/CSV para no volver a escribir nada, o creá una rutina desde cero en un par de minutos."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={onImport}><Upload size={14} /> Importar Excel o CSV</button>
              <button className="btn btn-secondary" onClick={() => actions.openRoutine()}><Plus size={14} /> Crear rutina</button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="card-pad">
        <SectionHead title="Semana de entrenamiento" subtitle="Las rutinas con día asignado aparecen automáticamente en tu dashboard." />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const dow = (i + 1) % 7;
            const routine = routines.find((r) => r.weekday === dow);
            const isToday = dow === todayDow;
            return (
              <div key={dow} className={cn('rounded-xl border p-2 text-center', isToday ? 'border-accent-line bg-accent-soft' : 'border-line bg-panel-2/40')}>
                <p className={cn('text-[0.62rem] font-semibold uppercase tracking-[0.06em]', isToday ? 'text-accent' : 'text-faint')}>{WEEKDAY_MIN[dow]}</p>
                <p className={cn('mt-1 truncate text-[0.68rem]', routine ? 'font-medium text-ink-soft' : 'text-faint/60')} title={routine?.name}>
                  {routine ? routine.name : 'descanso'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {routines.map((routine) => {
          const last = lastSessionForRoutine(useAppStore.getState().data, routine.id);
          const totalSets = routine.exercises.reduce((a, e) => a + e.sets, 0);
          const isToday = routine.weekday === todayDow;
          return (
            <Card key={routine.id} className={cn('card-pad flex flex-col', isToday && 'border-accent-line')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {routine.weekday != null ? <Badge tone={isToday ? 'accent' : 'outline'}>{WEEKDAY_MIN[routine.weekday] === 'D' ? 'domingo' : ['D', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][routine.weekday]}</Badge> : <Badge tone="outline">sin día</Badge>}
                    {routine.muscleGroups.slice(0, 2).map((g) => <Badge key={g}>{g}</Badge>)}
                  </div>
                  <h3 className="truncate text-[0.95rem] font-semibold text-ink">{routine.name}</h3>
                  <p className="mt-0.5 text-[0.72rem] text-faint">
                    {routine.exercises.length} ejercicios · {totalSets} series
                    {last ? ` · última: ${fmtDateShort(last.date)}` : ' · sin registrar'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openRoutine(routine)} aria-label="Editar rutina"><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => { mutateData((d) => { d.routines.push(duplicateRoutine(routine)); }); toast.success('Rutina duplicada', `${routine.name} (copia)`); }} aria-label="Duplicar rutina"><Copy size={13} /></button>
                  <button
                    className="btn btn-ghost btn-icon !h-7 !w-7 hover:text-danger"
                    aria-label="Eliminar rutina"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Eliminar rutina', message: `“${routine.name}” se va a eliminar. Las sesiones ya registradas se conservan en el historial.`, confirmLabel: 'Eliminar', tone: 'danger' });
                      if (!ok) return;
                      mutateData((d) => { d.routines = d.routines.filter((r) => r.id !== routine.id); });
                      toast.success('Rutina eliminada');
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {routine.description ? <p className="mt-2 text-[0.74rem] leading-snug text-muted">{routine.description}</p> : null}

              <div className="mt-2.5 flex flex-wrap gap-1">
                {routine.exercises.slice(0, 4).map((ex) => (
                  <span key={ex.id} className="chip !text-[0.65rem]">{ex.name}</span>
                ))}
                {routine.exercises.length > 4 ? <span className="chip !text-[0.65rem]">+{routine.exercises.length - 4}</span> : null}
              </div>

              <div className="mt-auto flex gap-2 pt-3">
                <button className="btn btn-primary btn-sm flex-1" onClick={() => actions.startWorkout(routine.id)}><Play size={12} /> Entrenar</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDetail(routine)}>Detalle</button>
              </div>
            </Card>
          );
        })}
      </div>

      <RoutineDetail routine={detail} onClose={() => setDetail(null)} onStart={(r) => { setDetail(null); actions.startWorkout(r.id); }} />
    </div>
  );
}

function RoutineDetail({ routine, onClose, onStart }: { routine: Routine | null; onClose: () => void; onStart: (r: Routine) => void }) {
  if (!routine) return null;
  const sorted = routine.exercises.slice().sort((a, b) => a.order - b.order);
  return (
    <Modal
      open={!!routine}
      onClose={onClose}
      title={routine.name}
      description={`${routine.exercises.length} ejercicios · ${routine.exercises.reduce((a, e) => a + e.sets, 0)} series totales`}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => onStart(routine)}><Play size={14} /> Entrenar esta rutina</button>
        </>
      }
    >
      <div className="space-y-3">
        {routine.description ? <p className="text-[0.79rem] leading-relaxed text-muted">{routine.description}</p> : null}
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="table-base">
            <thead>
              <tr><th>Ejercicio</th><th>Grupo</th><th className="text-center">Series</th><th className="text-center">Reps</th><th className="text-right">Descanso</th></tr>
            </thead>
            <tbody>
              {sorted.map((ex) => (
                <tr key={ex.id}>
                  <td>
                    <p className="font-medium text-ink-soft">{ex.name}</p>
                    {ex.notes ? <p className="text-[0.68rem] text-faint">{ex.notes}</p> : null}
                  </td>
                  <td className="text-faint">{ex.muscleGroup}</td>
                  <td className="text-center num">{ex.sets}</td>
                  <td className="text-center num">{ex.repsTarget}</td>
                  <td className="text-right num text-faint">{ex.restSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {routine.notes ? <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-[0.75rem] leading-relaxed text-muted">{routine.notes}</p> : null}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- historial */

function HistoryTab() {
  const sessions = useAppStore((s) => s.data.sessions);
  const confirm = useConfirm();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [routineFilter, setRoutineFilter] = useState('');
  const [limit, setLimit] = useState(12);
  const routines = useAppStore((s) => s.data.routines);

  const completed = useMemo(
    () => sessions.filter((s) => s.status === 'completed').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sessions],
  );
  const list = completed.filter((s) => !routineFilter || s.routineId === routineFilter).slice(0, limit);

  if (!completed.length) {
    return <Card className="card-pad"><EmptyState icon={<History size={20} />} title="Todavía no hay entrenamientos registrados" description="Cuando termines una sesión desde el modo entrenamiento, aparece acá con sus series, volumen y duración." /></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.76rem] text-muted">{completed.length} sesiones completadas</p>
        <Select value={routineFilter} onChange={(e) => setRoutineFilter(e.target.value)} className="!w-auto !min-h-[2rem] !py-1 !text-[0.75rem]">
          <option value="">Todas las rutinas</option>
          {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </div>

      <div className="space-y-2">
        {list.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            expanded={expanded === session.id}
            onToggle={() => setExpanded(expanded === session.id ? null : session.id)}
            onDelete={async () => {
              const ok = await confirm({ title: 'Eliminar sesión', message: 'Se va a borrar esta sesión del historial. Los gráficos y récords se recalculan sin ella.', confirmLabel: 'Eliminar', tone: 'danger' });
              if (!ok) return;
              mutateData((d) => { d.sessions = d.sessions.filter((s) => s.id !== session.id); });
              toast.success('Sesión eliminada');
            }}
          />
        ))}
      </div>

      {list.length < completed.length ? (
        <button className="btn btn-secondary w-full" onClick={() => setLimit((l) => l + 12)}>Ver más sesiones</button>
      ) : null}
    </div>
  );
}

function SessionRow({ session, expanded, onToggle, onDelete }: { session: WorkoutSession; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const volume = sessionVolume(session);
  const sets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const duration = sessionDurationSec(session);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onToggle}>
          <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-panel-2">
            <span className="text-[0.66rem] font-semibold leading-none text-ink">{new Date(session.date + 'T12:00:00').getDate()}</span>
            <span className="text-[0.5rem] uppercase leading-none text-faint">{new Date(session.date + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.84rem] font-medium text-ink">{session.name}</p>
            <p className="text-[0.68rem] text-faint">
              {sets} series · {fmtNum(volume)} kg · {duration ? fmtDuration(duration) : 'sin duración'} · {session.exercises.length} ejercicios
            </p>
          </div>
          <ChevronDown size={15} className={cn('shrink-0 text-faint transition-transform', expanded && 'rotate-180')} />
        </button>
        <button className="btn btn-ghost btn-icon !h-7 !w-7 hover:text-danger" onClick={onDelete} aria-label="Eliminar sesión"><Trash2 size={13} /></button>
      </div>
      {expanded ? (
        <div className="animate-fade-in border-t border-line px-3.5 py-3">
          <div className="space-y-2.5">
            {session.exercises.map((ex) => {
              const done = ex.sets.filter((s) => s.completed);
              return (
                <div key={ex.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[0.76rem] font-medium text-ink-soft">{ex.name}</p>
                    <span className="text-[0.64rem] text-faint">{ex.muscleGroup}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {done.length ? done.map((s, i) => (
                      <span key={s.id} className="chip !text-[0.65rem] num">{i + 1}: {s.weightKg != null ? `${fmtNum(s.weightKg)}` : '—'} kg × {s.reps ?? '—'}</span>
                    )) : <span className="text-[0.68rem] text-faint">Sin series completadas</span>}
                  </div>
                  {ex.notes ? <p className="mt-1 text-[0.68rem] italic text-faint">{ex.notes}</p> : null}
                </div>
              );
            })}
          </div>
          {session.notes ? <p className="mt-3 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-[0.71rem] text-muted">{session.notes}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------------- progresión */

function ProgressionTab() {
  const data = useAppStore((s) => s.data);
  const [exercise, setExercise] = useState('');
  const [range, setRange] = useState<RangeKey>('90');
  const names = useMemo(() => {
    const set = new Set<string>();
    data.sessions.filter((s) => s.status === 'completed').forEach((s) => s.exercises.forEach((e) => { if (e.name) set.add(e.name); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [data.sessions]);

  const selected = exercise || names[0] || '';
  const series = useMemo(() => exerciseSeries(data, selected), [data, selected]);
  const days = range === 'all' ? 3650 : Number(range);
  const cutoff = addDays(today(), -days);
  const filtered = series.filter((p) => p.date >= cutoff);
  const chartData = filtered.map((p) => ({ ...p, weight: p.topWeight, est: Math.round(p.e1rm) }));

  const best = series.reduce((m, p) => Math.max(m, p.topWeight), 0);
  const last = series[series.length - 1];
  const first = filtered[0];
  const delta = first && last && first.topWeight > 0 ? ((last.topWeight - first.topWeight) / first.topWeight) * 100 : 0;
  const lastPerf = selected ? lastExercisePerformance(data, selected) : null;

  if (!names.length) {
    return <Card className="card-pad"><EmptyState icon={<BarChart3 size={20} />} title="La progresión aparece con el primer entrenamiento" description="Registrá una sesión completa. Después vas a ver la evolución de carga, reps y volumen por ejercicio." /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selected} onChange={(e) => setExercise(e.target.value)} className="!w-full sm:!w-[280px]">
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <div className="flex gap-1">
          {(['30', '90', '180', 'all'] as RangeKey[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={cn('rounded-md border px-2.5 py-1 text-[0.7rem] transition-colors', range === r ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink')}>
              {r === 'all' ? 'Todo' : `${r} d`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Mejor peso" value={`${fmtNum(best)} kg`} hint={series.find((p) => p.topWeight === best)?.date ? fmtDateShort(series.find((p) => p.topWeight === best)!.date) : ''} />
        <MiniStat label="Última sesión" value={last ? `${fmtNum(last.topWeight)} kg` : '—'} hint={last ? fmtDateShort(last.date) : 'sin datos'} />
        <MiniStat label="1RM estimado" value={last ? `${fmtNum(last.e1rm)} kg` : '—'} hint="fórmula Epley" />
        <MiniStat label="Cambio en el período" value={`${delta >= 0 ? '+' : ''}${fmtNum(delta, 1)}%`} hint={`${filtered.length} sesiones`} tone={delta > 0 ? 'accent' : 'neutral'} />
      </div>

      <ChartCard
        title={`Evolución · ${selected}`}
        subtitle="Peso máximo levantado y fuerza estimada (1RM Epley)."
        empty={chartData.length < 2}
        emptyHint="Necesitás al menos dos sesiones con este ejercicio para ver una línea de progreso."
        height={260}
      >
        <TrendChart
          data={chartData}
          xKey="date"
          kind="line"
          xFormatter={(v) => fmtDateNumeric(String(v))}
          valueFormatter={(v) => `${fmtNum(v)} kg`}
          series={[
            { key: 'weight', label: 'Peso máximo', color: 'var(--accent)' },
            { key: 'est', label: '1RM estimado', color: 'var(--info)', dashed: true },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Volumen por sesión"
        subtitle="Peso × repeticiones completadas en este ejercicio."
        empty={chartData.length < 1}
        height={190}
      >
        <TrendChart data={chartData} xKey="date" kind="bar" xFormatter={(v) => fmtDateNumeric(String(v))} valueFormatter={(v) => `${fmtNum(v)} kg`} series={[{ key: 'volume', label: 'Volumen', color: 'var(--accent)' }]} />
      </ChartCard>

      <Card className="card-pad">
        <SectionHead title="Ejercicios con historial" subtitle="Tocá uno para ver su progresión." />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {names.map((n) => {
            const pts = exerciseSeries(data, n);
            const l = pts[pts.length - 1];
            const f = pts[0];
            const d = f && l && f.topWeight > 0 ? ((l.topWeight - f.topWeight) / f.topWeight) * 100 : 0;
            return (
              <button key={n} onClick={() => setExercise(n)} className={cn('flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors', n === selected ? 'border-accent-line bg-accent-soft' : 'border-line hover:border-line-strong')}>
                <span className="min-w-0">
                  <span className="block truncate text-[0.77rem] font-medium text-ink-soft">{n}</span>
                  <span className="block text-[0.65rem] text-faint">{pts.length} sesiones · último {lastPerf && n === selected && lastPerf.weight ? `${fmtNum(lastPerf.weight)} kg` : l ? `${fmtNum(l.topWeight)} kg` : '—'}</span>
                </span>
                <span className={cn('shrink-0 num text-[0.72rem] font-medium', d > 0 ? 'text-accent' : d < 0 ? 'text-danger' : 'text-faint')}>
                  {d > 0 ? '+' : ''}{fmtNum(d, 0)}%
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ récords */

function RecordsTab() {
  const data = useAppStore((s) => s.data);
  const records = useMemo(() => personalRecords(data), [data]);
  const recent = records.filter((r) => r.bestWeightDate && r.bestWeightDate >= addDays(today(), -45));

  if (!records.length) {
    return <Card className="card-pad"><EmptyState icon={<Trophy size={20} />} title="Todavía no hay récords" description="Se detectan automáticamente cuando registrás una serie con más peso que cualquier sesión anterior." /></Card>;
  }

  return (
    <div className="space-y-4">
      {recent.length ? (
        <Card className="card-pad border-accent-line">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <p className="text-[0.84rem] font-medium text-ink">{recent.length} récord{recent.length === 1 ? '' : 's'} en los últimos 45 días</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recent.slice(0, 6).map((r) => <span key={r.name} className="chip chip-accent"><Trophy size={10} /> {r.name} · {fmtNum(r.bestWeight)} kg</span>)}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="scroll-x">
          <table className="table-base min-w-[640px]">
            <thead>
              <tr>
                <th>Ejercicio</th><th>Grupo</th><th className="text-right">Mejor peso</th><th className="text-right">1RM est.</th>
                <th className="text-right">Mejor serie</th><th className="text-right">Sesiones</th><th className="text-right">Última vez</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.name}>
                  <td className="font-medium text-ink-soft">{r.name}</td>
                  <td className="text-faint">{r.muscleGroup}</td>
                  <td className="text-right">
                    <span className="num font-medium text-ink">{fmtNum(r.bestWeight)} kg</span>
                    <span className="ml-1 text-[0.66rem] text-faint">{r.bestWeightDate ? fmtDateShort(r.bestWeightDate) : ''}</span>
                  </td>
                  <td className="num text-right text-muted">{fmtNum(r.bestE1rm)} kg</td>
                  <td className="num text-right text-muted">{fmtNum(r.bestSetVolume)} kg</td>
                  <td className="num text-right text-faint">{r.sessions}</td>
                  <td className="text-right text-[0.72rem] text-faint">{r.lastDate ? fmtDateShort(r.lastDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="px-1 text-[0.7rem] leading-relaxed text-faint">
        Los récords se recalculan con cada sesión guardada. El 1RM es una estimación matemática (Epley), útil para comparar tendencia, no una medición exacta.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- utils */

function MiniStat({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'neutral' | 'accent' }) {
  return (
    <div className="card card-pad">
      <p className="text-[0.69rem] font-medium text-muted">{label}</p>
      <p className={cn('metric mt-2 text-[1.3rem]', tone === 'accent' ? 'text-accent' : 'text-ink')}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[0.65rem] text-faint">{hint}</p> : null}
    </div>
  );
}

void Meter; void Clock; void Field; void CalendarDays; void ArrowUpRight; void fmtDateLong; void fmtClock;
