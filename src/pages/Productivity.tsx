import { useMemo, useState } from 'react';
import {
  CalendarCheck2, Check, ChevronRight, Clock, FolderKanban, ListChecks,
  NotebookPen, Pencil, Pin, Plus, Target, Trash2, X,
} from 'lucide-react';
import type { Project, Task, TaskPriority } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { useConfirm, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge, Card, EmptyState, Field, Input, Meter, SectionHead, Segmented, Select, Textarea, Toggle } from '@/components/ui/Primitives';
import { Pomodoro } from '@/components/productivity/Pomodoro';
import { WeekPlanner } from '@/components/productivity/WeekPlanner';
import { addDays, fmtDateLong, fmtDateShort, friendlyDay, isPast, today, weekKey, WEEKDAY_SHORT } from '@/lib/date';
import { completedPerDay, focusMinutes, isTaskOverdue, taskStats, weeklyGoalProgress } from '@/lib/metrics';
import { newTask, toggleTaskDone } from '@/lib/domain';
import { PROJECT_COLORS } from '@/lib/icons';
import { cn, fmtNum, relativeTime, uid } from '@/lib/utils';

type Tab = 'hoy' | 'tareas' | 'semana' | 'proyectos' | 'notas';

const TABS: Array<{ id: Tab; label: string; icon: typeof ListChecks }> = [
  { id: 'hoy', label: 'Hoy', icon: CalendarCheck2 },
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
  { id: 'semana', label: 'Semana', icon: Clock },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'notas', label: 'Notas', icon: NotebookPen },
];

const PRIORITY_META: Record<TaskPriority, { label: string; tone: 'danger' | 'warn' | 'outline'; dot: string }> = {
  high: { label: 'Alta', tone: 'danger', dot: 'var(--danger)' },
  medium: { label: 'Media', tone: 'warn', dot: 'var(--warn)' },
  low: { label: 'Baja', tone: 'outline', dot: 'var(--faint)' },
};

export function Productivity() {
  const [tab, setTab] = useState<Tab>('hoy');
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const t = today();
  const stats = useMemo(() => taskStats(data, addDays(t, -29), t), [data, t]);
  const focusWeek = useMemo(() => focusMinutes(data, addDays(t, -6), t), [data, t]);
  const activeProjects = data.projects.filter((p) => p.status === 'active').length;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Organización personal</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Un día por vez, con intención.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Tareas, proyectos, notas y bloques de tiempo. El foco se construye reservándole lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => actions.openNote()}><NotebookPen size={14} /> Nota</button>
          <button className="btn btn-primary" onClick={() => actions.openTask()}><Plus size={14} /> Nueva tarea</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Pendientes" value={String(stats.open)} hint={`${stats.highPriorityOpen} de prioridad alta`} />
        <MiniStat label="Vencidas" value={String(stats.overdue)} hint="requieren decisión" tone={stats.overdue ? 'danger' : 'neutral'} />
        <MiniStat label="Completadas · 30 d" value={String(stats.completed)} hint={`${Math.round(stats.completionRate)}% del total histórico`} />
        <MiniStat label="Foco · 7 días" value={`${fmtNum(focusWeek)} min`} hint={`${activeProjects} proyectos activos`} />
      </section>

      <div className="scroll-x flex gap-1 border-b border-line">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn('flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.8rem] font-medium transition-colors', tab === item.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink-soft')}
            >
              <Icon size={14} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'hoy' ? <TodayTab /> : null}
      {tab === 'tareas' ? <TasksTab /> : null}
      {tab === 'semana' ? <WeekPlanner /> : null}
      {tab === 'proyectos' ? <ProjectsTab /> : null}
      {tab === 'notas' ? <NotesTab /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- hoy */

function TodayTab() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const toast = useToast();
  const t = today();
  const [quick, setQuick] = useState('');
  const goals = data.weeklyGoals.filter((g) => g.weekKey === weekKey(t));
  const goalStats = weeklyGoalProgress(data, weekKey(t));

  const overdue = data.tasks.filter((x) => x.status !== 'done' && isTaskOverdue(x, t));
  const dueToday = data.tasks.filter((x) => x.status !== 'done' && x.dueDate === t && !isTaskOverdue(x, t));
  const upcoming = data.tasks
    .filter((x) => x.status !== 'done' && x.dueDate && x.dueDate > t && x.dueDate <= addDays(t, 7))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  const noDate = data.tasks.filter((x) => x.status !== 'done' && !x.dueDate);

  const addQuick = () => {
    if (!quick.trim()) return;
    mutateData((d) => { d.tasks.push(newTask({ title: quick.trim(), dueDate: t })); });
    toast.success('Tarea agregada para hoy', quick.trim());
    setQuick('');
  };

  const weekChart = completedPerDay(data, addDays(t, -6), t).map((d) => ({ ...d, date: d.date }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="flex items-center gap-2 p-2">
          <Plus size={15} className="ml-1.5 shrink-0 text-faint" />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addQuick(); }}
            placeholder="Agregar tarea para hoy y presionar Enter…"
            className="w-full bg-transparent py-1.5 text-[0.84rem] text-ink placeholder:text-faint focus:outline-none"
          />
          <button className="btn btn-primary btn-sm shrink-0" onClick={addQuick} disabled={!quick.trim()}>Agregar</button>
        </Card>

        <Card className="card-pad">
          <SectionHead title="Agenda del día" subtitle={`${fmtDateLong(t)} · ${overdue.length + dueToday.length} pendientes para hoy`} />
          <div className="space-y-3">
            {overdue.length ? <TaskGroup title="Vencidas" tasks={overdue} accent="danger" /> : null}
            <TaskGroup title="Para hoy" tasks={dueToday} emptyLabel="Nada agendado para hoy. Podés adelantar algo de la semana." />
            {upcoming.length ? <TaskGroup title="Próximos 7 días" tasks={upcoming} /> : null}
            {noDate.length ? <TaskGroup title="Sin fecha" tasks={noDate.slice(0, 5)} collapsedHint={noDate.length > 5 ? `+${noDate.length - 5} más` : undefined} /> : null}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="card-pad">
            <SectionHead title="Objetivos de la semana" subtitle={`${goalStats.done} de ${goalStats.total} cumplidos`} action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openGoal()} aria-label="Agregar objetivo"><Plus size={14} /></button>} />
            {goals.length === 0 ? (
              <EmptyState compact icon={<Target size={16} />} title="Sin objetivos" description="Uno o dos por semana alcanzan." action={<button className="btn btn-secondary btn-sm" onClick={() => actions.openGoal()}>Definir objetivo</button>} />
            ) : (
              <>
                <Meter value={goalStats.pct} height={4} className="mb-2" />
                <div className="space-y-1">
                  {goals.map((g) => (
                    <div key={g.id} className="group flex items-start gap-2">
                      <button
                        className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', g.done ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong')}
                        onClick={() => mutateData((d) => { const x = d.weeklyGoals.find((y) => y.id === g.id); if (x) x.done = !x.done; })}
                        aria-label={g.done ? 'Desmarcar' : 'Marcar'}
                      >
                        {g.done ? <Check size={10} strokeWidth={3} /> : null}
                      </button>
                      <span className={cn('flex-1 text-[0.79rem]', g.done ? 'checked-line' : 'text-ink-soft')}>{g.text}</span>
                      <button className="opacity-0 transition-opacity hover:text-danger group-hover:opacity-100" onClick={() => mutateData((d) => { d.weeklyGoals = d.weeklyGoals.filter((y) => y.id !== g.id); })} aria-label="Eliminar objetivo"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="card-pad">
            <SectionHead title="Tareas completadas" subtitle="Últimos 7 días" />
            <div className="flex h-[104px] items-end gap-1.5">
              {weekChart.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="num text-[0.6rem] text-faint">{d.count || ''}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-[3px] bg-accent/70" style={{ height: `${Math.max(3, d.count * 18)}%` }} />
                  </div>
                  <span className="text-[0.56rem] uppercase text-faint">{WEEKDAY_SHORT[new Date(d.date + 'T12:00:00').getDay()][0]}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <aside className="space-y-4">
        <Pomodoro />
        <Card className="card-pad">
          <SectionHead title="Atajos" subtitle="Lo que más usás." />
          <div className="space-y-1">
            <button className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-panel-2" onClick={() => actions.openTask()}><span className="text-[0.78rem] text-ink-soft">Nueva tarea</span><Plus size={12} className="text-faint" /></button>
            <button className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-panel-2" onClick={() => actions.openNote()}><span className="text-[0.78rem] text-ink-soft">Nota rápida</span><Plus size={12} className="text-faint" /></button>
            <button className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-panel-2" onClick={() => actions.openCheckin(t)}><span className="text-[0.78rem] text-ink-soft">Check-in de bienestar</span><ChevronRight size={12} className="text-faint" /></button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function TaskGroup({ title, tasks, emptyLabel, accent, collapsedHint }: { title: string; tasks: Task[]; emptyLabel?: string; accent?: 'danger'; collapsedHint?: string }) {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const t = today();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className={cn('text-[0.66rem] font-semibold uppercase tracking-[0.1em]', accent === 'danger' ? 'text-danger' : 'text-faint')}>{title}</p>
        <span className="num text-[0.64rem] text-faint">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-2.5 py-2 text-[0.73rem] text-faint">{emptyLabel}</p>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => {
            const project = data.projects.find((p) => p.id === task.projectId);
            return (
              <div key={task.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-panel-2">
                <button
                  className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', task.status === 'done' ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong hover:border-accent')}
                  onClick={() => mutateData((d) => { const x = d.tasks.find((y) => y.id === task.id); if (x) toggleTaskDone(d, x); })}
                  aria-label="Completar"
                >
                  {task.status === 'done' ? <Check size={10} strokeWidth={3} /> : null}
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => actions.openTask(task)}>
                  <span className={cn('block truncate text-[0.79rem]', task.status === 'done' ? 'checked-line' : 'text-ink-soft')}>{task.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[0.64rem] text-faint">
                    {project ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />{project.name}</span> : null}
                    {task.dueDate ? <span className={cn(isPast(task.dueDate) && task.dueDate < t ? 'text-danger' : '')}>{friendlyDay(task.dueDate)}</span> : null}
                    {task.estimatedMin ? <span>· {task.estimatedMin} min</span> : null}
                  </span>
                </button>
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIORITY_META[task.priority].dot }} title={PRIORITY_META[task.priority].label} />
                <button className="opacity-0 transition group-hover:opacity-100" onClick={() => mutateData((d) => { d.tasks = d.tasks.filter((x) => x.id !== task.id); })} aria-label="Eliminar tarea"><Trash2 size={12} className="text-faint hover:text-danger" /></button>
              </div>
            );
          })}
          {collapsedHint ? <p className="px-1 text-[0.66rem] text-faint">{collapsedHint} <button className="underline" onClick={() => actions.openTask()}>ver todas</button></p> : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- tareas */

function TasksTab() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [priority, setPriority] = useState('');
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const weight: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
    return data.tasks
      .filter((x) => (status === 'open' ? x.status !== 'done' : status === 'done' ? x.status === 'done' : true))
      .filter((x) => !priority || x.priority === priority)
      .filter((x) => !projectId || x.projectId === projectId)
      .filter((x) => !query || x.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return weight[a.priority] - weight[b.priority];
      });
  }, [data.tasks, status, priority, projectId, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: 'Abiertas' }, { value: 'done', label: 'Completadas' }, { value: 'all', label: 'Todas' }]} />
        <div className="flex flex-wrap gap-1.5">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="!w-full !min-h-[2.1rem] !py-1 !text-[0.76rem] sm:!w-[160px]" />
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="!w-auto !min-h-[2.1rem] !py-1 !text-[0.76rem]">
            <option value="">Prioridad</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </Select>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto !min-h-[2.1rem] !py-1 !text-[0.76rem]">
            <option value="">Proyecto</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <button className="btn btn-primary btn-sm" onClick={() => actions.openTask()}><Plus size={13} /> Tarea</button>
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="card-pad"><EmptyState icon={<ListChecks size={20} />} title="No hay tareas con estos filtros" description="Probá limpiar los filtros o crear una tarea nueva." action={<button className="btn btn-secondary btn-sm" onClick={() => actions.openTask()}>Nueva tarea</button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          {list.map((task) => {
            const project = data.projects.find((p) => p.id === task.projectId);
            const category = data.categories.find((c) => c.id === task.categoryId);
            const overdue = isTaskOverdue(task);
            return (
              <div key={task.id} className="group flex items-start gap-2.5 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-panel-2/60">
                <button
                  className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', task.status === 'done' ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong hover:border-accent')}
                  onClick={() => mutateData((d) => { const x = d.tasks.find((y) => y.id === task.id); if (x) toggleTaskDone(d, x); })}
                  aria-label="Completar"
                >
                  {task.status === 'done' ? <Check size={10} strokeWidth={3} /> : null}
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => actions.openTask(task)}>
                  <span className={cn('block text-[0.82rem]', task.status === 'done' ? 'checked-line' : 'text-ink-soft')}>{task.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.65rem] text-faint">
                    {project ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />{project.name}</span> : null}
                    {category ? <span>{category.name}</span> : null}
                    {task.dueDate ? <span className={cn(overdue && 'text-danger')}>{overdue ? 'vencida ' : ''}{fmtDateShort(task.dueDate)}</span> : <span>sin fecha</span>}
                    {task.subtasks.length ? <span>· {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} subtareas</span> : null}
                    {task.estimatedMin ? <span>· {task.estimatedMin} min</span> : null}
                  </span>
                </button>
                <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
                <button
                  className="opacity-0 transition hover:text-danger group-hover:opacity-100"
                  aria-label="Eliminar"
                  onClick={async () => {
                    const ok = await confirm({ title: 'Eliminar tarea', message: `Se va a borrar “${task.title}”.`, confirmLabel: 'Eliminar', tone: 'danger' });
                    if (!ok) return;
                    mutateData((d) => { d.tasks = d.tasks.filter((x) => x.id !== task.id); });
                    toast.success('Tarea eliminada');
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- proyectos */

function ProjectsTab() {
  const data = useAppStore((s) => s.data);
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [newCategory, setNewCategory] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHead className="!mb-0" title="Proyectos" subtitle="Agrupá tareas con un objetivo común y una fecha." />
        <button className="btn btn-primary btn-sm" onClick={() => setEditing(null)}><Plus size={13} /> Proyecto</button>
      </div>

      {data.projects.length === 0 ? (
        <Card className="card-pad"><EmptyState icon={<FolderKanban size={20} />} title="Sin proyectos" description="Un proyecto agrupa tareas: un trabajo práctico, un examen, una mudanza, un emprendimiento." action={<button className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>Crear proyecto</button>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((project) => {
            const tasks = data.tasks.filter((x) => x.projectId === project.id);
            const done = tasks.filter((x) => x.status === 'done').length;
            return (
              <Card key={project.id} className="card-pad">
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
                    <p className="truncate text-[0.88rem] font-medium text-ink">{project.name}</p>
                  </div>
                  <div className="flex shrink-0">
                    <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={() => setEditing(project)} aria-label="Editar proyecto"><Pencil size={11} /></button>
                    <button
                      className="btn btn-ghost btn-icon !h-6 !w-6 hover:text-danger"
                      aria-label="Eliminar proyecto"
                      onClick={async () => {
                        const ok = await confirm({ title: 'Eliminar proyecto', message: 'Las tareas del proyecto no se borran: quedan sin proyecto.', confirmLabel: 'Eliminar', tone: 'danger' });
                        if (!ok) return;
                        mutateData((d) => {
                          d.projects = d.projects.filter((p) => p.id !== project.id);
                          d.tasks.forEach((x) => { if (x.projectId === project.id) x.projectId = null; });
                        });
                        toast.success('Proyecto eliminado');
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {project.description ? <p className="mt-1 line-clamp-2 text-[0.72rem] leading-snug text-muted">{project.description}</p> : null}
                <div className="mt-2.5 flex items-center justify-between text-[0.66rem] text-faint">
                  <span>{done}/{tasks.length} tareas</span>
                  {project.deadline ? <span>entrega {fmtDateShort(project.deadline)}</span> : <span>sin fecha límite</span>}
                </div>
                <Meter value={tasks.length ? (done / tasks.length) * 100 : 0} className="mt-1.5" height={4} />
              </Card>
            );
          })}
        </div>
      )}

      <Card className="card-pad">
        <SectionHead title="Categorías" subtitle="Etiquetas transversales a proyectos." />
        <div className="flex flex-wrap gap-1.5">
          {data.categories.map((c) => (
            <span key={c.id} className="chip chip-outline group">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
              {c.name}
              <button className="ml-0.5 text-faint opacity-0 group-hover:opacity-100" onClick={() => mutateData((d) => { d.categories = d.categories.filter((x) => x.id !== c.id); d.tasks.forEach((t) => { if (t.categoryId === c.id) t.categoryId = null; }); })} aria-label="Eliminar categoría"><X size={10} /></button>
            </span>
          ))}
          {data.categories.length === 0 ? <span className="text-[0.72rem] text-faint">Sin categorías todavía.</span> : null}
        </div>
        <div className="mt-2 flex max-w-xs gap-1.5">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !newCategory.trim()) return;
              mutateData((d) => { d.categories.push({ id: uid('cat'), name: newCategory.trim(), color: PROJECT_COLORS[d.categories.length % PROJECT_COLORS.length] }); });
              setNewCategory('');
            }}
            placeholder="Nueva categoría + Enter"
            className="!min-h-[2rem] !py-1 !text-[0.75rem]"
          />
          <button
            className="btn btn-secondary btn-icon !h-[2rem] !w-[2rem]"
            onClick={() => {
              if (!newCategory.trim()) return;
              mutateData((d) => { d.categories.push({ id: uid('cat'), name: newCategory.trim(), color: PROJECT_COLORS[d.categories.length % PROJECT_COLORS.length] }); });
              setNewCategory('');
            }}
            aria-label="Agregar categoría"
          >
            <Plus size={13} />
          </button>
        </div>
      </Card>

      <ProjectModal project={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: Project | null | undefined; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<Project['status']>('active');
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = project === undefined ? 'closed' : project?.id ?? 'new';
  if (project !== undefined && loadedFor !== key) {
    setLoadedFor(key);
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
    setDeadline(project?.deadline ?? '');
    setColor(project?.color ?? PROJECT_COLORS[0]);
    setStatus(project?.status ?? 'active');
    setError(null);
  }

  const save = () => {
    if (!name.trim()) return setError('Poné un nombre al proyecto.');
    mutateData((d) => {
      if (project) {
        const target = d.projects.find((p) => p.id === project.id);
        if (target) Object.assign(target, { name: name.trim(), description: description.trim(), deadline: deadline || null, color, status });
      } else {
        d.projects.push({ id: uid('proj'), name: name.trim(), description: description.trim(), deadline: deadline || null, color, status });
      }
    });
    toast.success(project ? 'Proyecto actualizado' : 'Proyecto creado', name.trim());
    onClose();
  };

  return (
    <Modal
      open={project !== undefined}
      onClose={onClose}
      title={project ? 'Editar proyecto' : 'Nuevo proyecto'}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre" required error={error}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ej. Trabajo práctico de Geografía" invalid={!!error} autoFocus />
        </Field>
        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Qué incluye, criterios, links…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha límite">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Estado">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
              <option value="active">Activo</option>
              <option value="paused">En pausa</option>
              <option value="done">Terminado</option>
            </Select>
          </Field>
        </div>
        <Field label="Color">
          <div className="flex gap-2">
            {PROJECT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-105', color === c ? 'border-ink' : 'border-transparent')} style={{ background: c }} aria-label={`Color ${c}`} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- notas */

function NotesTab() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const notes = useMemo(() => {
    const list = data.notes.filter((n) => !query || n.title.toLowerCase().includes(query.toLowerCase()) || n.body.toLowerCase().includes(query.toLowerCase()) || n.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())));
    return list.sort((a, b) => (a.pinned === b.pinned ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.pinned ? -1 : 1));
  }, [data.notes, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en tus notas…" className="!min-h-[2.2rem] !py-1 !text-[0.8rem]" />
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => actions.openNote()}><Plus size={13} /> Nota</button>
      </div>

      {notes.length === 0 ? (
        <Card className="card-pad"><EmptyState icon={<NotebookPen size={20} />} title={query ? 'Nada coincide con tu búsqueda' : 'Sin notas todavía'} description="Un lugar para ideas, resúmenes y recordatorios que no son tareas." action={<button className="btn btn-primary btn-sm" onClick={() => actions.openNote()}>Escribir una nota</button>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className={cn('card-pad group flex flex-col', note.pinned && 'border-accent-line/60')}>
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => actions.openNote(note)}>
                  <p className="truncate text-[0.85rem] font-medium text-ink">{note.title}</p>
                  <p className="text-[0.62rem] text-faint">Editada {relativeTime(note.updatedAt)}</p>
                </button>
                <div className="flex shrink-0">
                  <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={() => mutateData((d) => { const n = d.notes.find((x) => x.id === note.id); if (n) n.pinned = !n.pinned; })} aria-label="Fijar"><Pin size={11} className={note.pinned ? 'text-accent' : ''} /></button>
                  <button
                    className="btn btn-ghost btn-icon !h-6 !w-6 hover:text-danger"
                    aria-label="Eliminar nota"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Eliminar nota', message: `Se va a borrar “${note.title}”.`, confirmLabel: 'Eliminar', tone: 'danger' });
                      if (!ok) return;
                      mutateData((d) => { d.notes = d.notes.filter((n) => n.id !== note.id); });
                      toast.success('Nota eliminada');
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <button className="mt-2 line-clamp-4 whitespace-pre-line text-left text-[0.74rem] leading-relaxed text-muted" onClick={() => actions.openNote(note)}>
                {note.body || 'Sin contenido'}
              </button>
              {note.tags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.map((tag) => <span key={tag} className="chip !text-[0.62rem]">#{tag}</span>)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'danger' }) {
  return (
    <div className="card card-pad">
      <p className="text-[0.69rem] font-medium text-muted">{label}</p>
      <p className={cn('metric mt-2 text-[1.35rem]', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
      <p className="mt-0.5 truncate text-[0.65rem] text-faint">{hint}</p>
    </div>
  );
}

void Toggle;
