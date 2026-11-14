import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, ListChecks, Pencil, Plus, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import type { Habit } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { useConfirm } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge, Card, EmptyState, Meter, SectionHead, Segmented } from '@/components/ui/Primitives';
import { TrendChart } from '@/components/charts/Charts';
import { addDays, eachDay, fmtDateLong, fmtDateNumeric, fmtDateShort, localDayFromISO, monthMatrix, MONTH_LONG, startOfWeek, today, WEEKDAY_MIN } from '@/lib/date';
import { dayHabitProgress, habitCountOn, habitRangeStats, habitStreak, habitTargetFor, isHabitScheduled, overallHabitConsistency } from '@/lib/metrics';
import { SUGGESTED_HABITS, newHabit, toggleHabitOn } from '@/lib/domain';
import { habitIcon, HABIT_COLORS } from '@/lib/icons';
import { cn, pct } from '@/lib/utils';

type Filter = 'active' | 'archived';

export function Habits() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();
  const t = today();
  const [filter, setFilter] = useState<Filter>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const habits = data.habits.filter((h) => (filter === 'active' ? !h.archived : h.archived)).sort((a, b) => a.order - b.order);
  const selected = habits.find((h) => h.id === selectedId) ?? habits[0] ?? null;
  const progress = dayHabitProgress(data, t);

  const stats = useMemo(() => ({
    week: overallHabitConsistency(data, addDays(t, -6), t),
    month: overallHabitConsistency(data, addDays(t, -29), t),
    bestStreak: data.habits.reduce((best, h) => Math.max(best, habitStreak(data, h, t)), 0),
  }), [data, t]);

  const dailySeries = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => addDays(t, -29 + i));
    return days.map((date) => {
      const scheduled = data.habits.filter((h) => !h.archived && (h.frequency.type !== 'weekly'));
      const due = scheduled.filter((h) => isHabitScheduled(h, date));
      const done = due.filter((h) => habitCountOn(data, h.id, date) >= habitTargetFor(h)).length;
      return { date, rate: Math.round(pct(done, due.length)), done, due: due.length };
    });
  }, [data, t]);

  const addSuggested = async () => {
    const ok = await confirm({
      title: 'Agregar hábitos sugeridos',
      message: 'Se van a crear 11 hábitos base con frecuencia diaria o de días fijos. Después podés editar, archivar o eliminar cualquiera.',
      confirmLabel: 'Agregar',
    });
    if (!ok) return;
    mutateData((d) => {
      SUGGESTED_HABITS.forEach((h, i) => {
        d.habits.push(newHabit({ ...h, color: HABIT_COLORS[i % HABIT_COLORS.length], order: Date.now() + i }));
      });
    });
    toast.success('Hábitos agregados', 'Editalos a tu medida desde cada tarjeta.');
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Construcción de hábitos</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Menos motivación. Más sistema.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Marcá lo que cumpliste. La app calcula rachas y consistencia sin juzgar los días flojos.
          </p>
        </div>
        <div className="flex gap-2">
          {data.habits.some((h) => h.archived) ? (
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Activos' }, { value: 'archived', label: 'Archivados' }]} />
          ) : null}
          <button className="btn btn-primary" onClick={() => actions.openHabit()}><Plus size={14} /> Nuevo hábito</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HabitStat label="Hoy" value={`${progress.done}/${progress.scheduled || 0}`} sub={`${Math.round(progress.pct)}% cumplido`} icon={<Check size={14} />} />
        <HabitStat label="Últimos 7 días" value={`${Math.round(stats.week)}%`} sub="consistencia global" icon={<TrendingUp size={14} />} />
        <HabitStat label="Últimos 30 días" value={`${Math.round(stats.month)}%`} sub="consistencia global" icon={<ListChecks size={14} />} />
        <HabitStat label="Mejor racha actual" value={`${stats.bestStreak}`} sub={stats.bestStreak === 1 ? 'día seguido' : 'días seguidos'} icon={<Flame size={14} />} accent />
      </section>

      {!data.habits.length ? (
        <Card className="card-pad">
          <EmptyState
            icon={<ListChecks size={20} />}
            title="Tu primer hábito"
            description="Empezá por uno solo, pequeño y concreto. Podés usar la lista sugerida y ajustarla después."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn btn-primary" onClick={() => actions.openHabit()}><Plus size={14} /> Crear hábito</button>
                <button className="btn btn-secondary" onClick={addSuggested}><Sparkles size={14} /> Usar lista sugerida</button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-2.5">
            {habits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                selected={selected?.id === habit.id}
                onSelect={() => setSelectedId(habit.id)}
                onEdit={() => actions.openHabit(habit)}
                onToggle={() => {
                  let done = false;
                  mutateData((d) => {
                    const h = d.habits.find((x) => x.id === habit.id);
                    if (h) done = toggleHabitOn(d, h, t);
                  });
                  if (done) toast.success('Hábito completado', habit.name);
                }}
                onDelete={async () => {
                  const ok = await confirm({ title: 'Eliminar hábito', message: `“${habit.name}” y su historial se van a borrar. Si querés conservar las marcas, archivalo.`, confirmLabel: 'Eliminar', tone: 'danger' });
                  if (!ok) return;
                  mutateData((d) => {
                    d.habits = d.habits.filter((h) => h.id !== habit.id);
                    d.habitLogs = d.habitLogs.filter((l) => l.habitId !== habit.id);
                  });
                  toast.success('Hábito eliminado');
                }}
              />
            ))}
            {habits.length === 0 ? (
              <Card className="card-pad"><EmptyState compact title={filter === 'archived' ? 'No hay hábitos archivados' : 'No hay hábitos activos'} description="Podés crear uno nuevo o reactivar los archivados." /></Card>
            ) : null}

            <Card className="card-pad">
              <SectionHead title="Consistencia diaria" subtitle="Porcentaje de hábitos cumplidos por día (últimos 30 días)." />
              <div className="h-[120px]">
                <TrendChart data={dailySeries} xKey="date" kind="bar" height={120} showY={false} xFormatter={(v) => fmtDateNumeric(String(v))} valueFormatter={(v) => `${v}%`} series={[{ key: 'rate', label: 'Cumplimiento', color: 'var(--accent)' }]} />
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            {selected ? (
              <HabitDetail habit={selected} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
            ) : (
              <Card className="card-pad"><EmptyState compact title="Seleccioná un hábito" description="Vas a ver su calendario, rachas y cumplimiento." /></Card>
            )}

            <Card className="card-pad">
              <SectionHead title="Cumplimiento por hábito" subtitle="Últimos 30 días." />
              <div className="space-y-2.5">
                {data.habits.filter((h) => !h.archived).map((h) => {
                  const s = habitRangeStats(data, h, addDays(t, -29), t);
                  return (
                    <div key={h.id}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[0.72rem] text-muted">{h.name}</span>
                        <span className="num shrink-0 text-[0.68rem] text-faint">{Math.round(s.rate)}%</span>
                      </div>
                      <Meter value={s.rate} height={4} tone={s.rate >= 70 ? 'accent' : s.rate >= 40 ? 'warn' : 'muted'} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function HabitRow({ habit, selected, onSelect, onEdit, onToggle, onDelete }: {
  habit: Habit; selected: boolean; onSelect: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const data = useAppStore((s) => s.data);
  const t = today();
  const Icon = habitIcon(habit.icon);
  const count = habitCountOn(data, habit.id, t);
  const target = habitTargetFor(habit);
  const done = count >= target;
  const scheduledToday = isHabitScheduled(habit, t);
  const streak = habitStreak(data, habit, t);
  const last14 = useMemo(() => eachDay(addDays(t, -13), t), [t]);
  const stats30 = habitRangeStats(data, habit, addDays(t, -29), t);

  return (
    <Card className={cn('p-3 transition-colors', selected && 'border-accent-line/70')}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={!scheduledToday}
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all',
            done ? 'border-transparent bg-accent text-[var(--accent-ink)]' : scheduledToday ? 'border-line-strong text-muted hover:border-accent hover:text-accent' : 'border-line text-faint/50',
          )}
          aria-label={done ? 'Desmarcar hábito' : 'Marcar hábito'}
        >
          {done ? <Check size={17} strokeWidth={2.8} /> : <Icon size={16} />}
        </button>

        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={cn('text-[0.86rem] font-medium', done ? 'text-ink' : 'text-ink-soft')}>{habit.name}</p>
            {habit.frequency.type === 'weekly' ? <Badge>{habit.frequency.timesPerWeek}×/sem</Badge> : null}
            {!scheduledToday ? <Badge>hoy no toca</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-[0.7rem] text-faint">
            {habit.description || (habit.frequency.type === 'days' ? `Días: ${habit.frequency.days.map((d) => WEEKDAY_MIN[d]).join(' ')}` : 'Todos los días')}
            {target > 1 ? ` · ${count}/${target} hoy` : ''}
          </p>

          <div className="mt-2 flex items-center gap-0.5">
            {last14.map((d) => {
              const scheduled = isHabitScheduled(habit, d);
              const hit = habitCountOn(data, habit.id, d) >= target;
              return (
                <span
                  key={d}
                  title={`${fmtDateShort(d)}${scheduled ? hit ? ' · cumplido' : ' · pendiente' : ' · no programado'}`}
                  className={cn(
                    'h-3.5 flex-1 rounded-[2px]',
                    hit ? 'bg-accent' : scheduled ? 'bg-[var(--ring-track)]' : 'bg-transparent border border-line/60',
                  )}
                />
              );
            })}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-[0.7rem] font-medium text-ink-soft"><Flame size={11} className={streak > 0 ? 'text-accent' : 'text-faint'} /> {streak}</span>
          <span className="text-[0.62rem] text-faint">{Math.round(stats30.rate)}% · 30d</span>
          <div className="flex">
            <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={onEdit} aria-label="Editar hábito"><Pencil size={11} /></button>
            <button className="btn btn-ghost btn-icon !h-6 !w-6 hover:text-danger" onClick={onDelete} aria-label="Eliminar hábito"><Trash2 size={11} /></button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HabitDetail({ habit, monthOffset, setMonthOffset }: { habit: Habit; monthOffset: number; setMonthOffset: (n: number) => void }) {
  const data = useAppStore((s) => s.data);
  const toast = useToast();
  const t = today();
  const Icon = habitIcon(habit.icon);
  const [year, month] = useMemo(() => {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    return [d.getFullYear(), d.getMonth()];
  }, [monthOffset]);

  const matrix = useMemo(() => monthMatrix(new Date(year, month, 1), 1), [year, month]);
  const monthStats = useMemo(() => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
    return habitRangeStats(data, habit, from, to);
  }, [data, habit, year, month]);

  const streak = habitStreak(data, habit, t);
  const best = useMemo(() => {
    const start = localDayFromISO(habit.createdAt);
    let bestRun = 0;
    let run = 0;
    if (habit.frequency.type === 'weekly') {
      // Para hábitos semanales la racha se mide en semanas que alcanzaron el objetivo.
      for (let ws = startOfWeek(start, 1); ws <= t; ws = addDays(ws, 7)) {
        const hits = eachDay(ws, addDays(ws, 6)).filter((d) => d <= t && habitCountOn(data, habit.id, d) > 0).length;
        if (hits >= habit.frequency.timesPerWeek) {
          run += 1;
          bestRun = Math.max(bestRun, run);
        } else if (addDays(ws, 6) < t) run = 0;
      }
      return bestRun;
    }
    for (const day of eachDay(start, t)) {
      if (!isHabitScheduled(habit, day)) continue;
      if (habitCountOn(data, habit.id, day) >= habitTargetFor(habit)) {
        run += 1;
        bestRun = Math.max(bestRun, run);
      } else if (day < t) run = 0;
    }
    return bestRun;
  }, [data, habit, t]);

  return (
    <Card className="card-pad">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line" style={{ color: habit.color, background: 'var(--panel-2)' }}>
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.85rem] font-medium text-ink">{habit.name}</p>
            <p className="text-[0.66rem] text-faint">
              {habit.frequency.type === 'daily' ? 'Todos los días' : habit.frequency.type === 'days' ? `Días fijos · ${habit.frequency.days.length}/semana` : `${habit.frequency.timesPerWeek} veces por semana`}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Mes anterior"><ChevronLeft size={13} /></button>
          <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="Mes siguiente"><ChevronRight size={13} /></button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center">
          <p className="num text-[0.9rem] font-semibold text-ink">{streak}</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">racha</p>
        </div>
        <div className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center">
          <p className="num text-[0.9rem] font-semibold text-ink">{best}</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">mejor</p>
        </div>
        <div className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center">
          <p className="num text-[0.9rem] font-semibold text-accent">{Math.round(monthStats.rate)}%</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">mes</p>
        </div>
      </div>

      <p className="mt-3 mb-1.5 text-center text-[0.7rem] capitalize text-muted">{MONTH_LONG[month]} {year}</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_MIN.map((d, i) => <span key={`${d}-${i}`} className="text-center text-[0.56rem] text-faint">{d}</span>)}
        {matrix.flat().map((day) => {
          const inMonth = new Date(day + 'T12:00:00').getMonth() === month;
          const scheduled = isHabitScheduled(habit, day);
          const hit = habitCountOn(data, habit.id, day) >= habitTargetFor(habit);
          const future = day > t;
          return (
            <button
              key={day}
              disabled={future}
              onClick={() => {
                if (!scheduled) return;
                let done = false;
                mutateData((d) => {
                  const h = d.habits.find((x) => x.id === habit.id);
                  if (h) done = toggleHabitOn(d, h, day);
                });
                toast.success(done ? 'Marcado' : 'Desmarcado', `${fmtDateLong(day)} · ${habit.name}`);
              }}
              className={cn(
                'flex aspect-square items-center justify-center rounded-[5px] text-[0.6rem] transition-colors',
                !inMonth && 'opacity-25',
                future && 'cursor-default',
                hit ? 'bg-accent text-[var(--accent-ink)] font-semibold' : scheduled ? 'border border-line bg-panel-2 text-faint hover:border-accent-line' : 'text-faint/40',
              )}
              title={`${fmtDateLong(day)}${scheduled ? hit ? ' · cumplido' : ' · pendiente' : ' · no programado'}`}
            >
              {new Date(day + 'T12:00:00').getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[0.68rem] text-faint">
        <span>{monthStats.completed} de {monthStats.scheduled} cumplidos</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] bg-accent" /> cumplido</span>
      </div>
    </Card>
  );
}

function HabitStat({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <p className="text-[0.69rem] font-medium text-muted">{label}</p>
        <span className={accent ? 'text-accent' : 'text-faint'}>{icon}</span>
      </div>
      <p className={cn('metric mt-2 text-[1.35rem]', accent ? 'text-accent' : 'text-ink')}>{value}</p>
      <p className="mt-0.5 truncate text-[0.65rem] text-faint">{sub}</p>
    </div>
  );
}

