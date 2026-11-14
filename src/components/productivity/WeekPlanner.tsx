import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { BlockType, TimeBlock } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { Badge, Card, Field, Input, SectionHead, Select } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { addDays, fmtDateLong, minutesToTime, startOfWeek, timeToMinutes, today, WEEKDAY_MIN, WEEKDAY_SHORT } from '@/lib/date';
import { cn, uid } from '@/lib/utils';

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_PX = 46;

const TYPE_META: Record<BlockType, { label: string; color: string; soft: string }> = {
  focus: { label: 'Foco', color: 'var(--accent)', soft: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
  workout: { label: 'Entrenamiento', color: 'var(--info)', soft: 'color-mix(in srgb, var(--info) 18%, transparent)' },
  meal: { label: 'Comida', color: 'var(--warn)', soft: 'color-mix(in srgb, var(--warn) 18%, transparent)' },
  rest: { label: 'Descanso', color: 'var(--faint)', soft: 'color-mix(in srgb, var(--faint) 18%, transparent)' },
  other: { label: 'Otro', color: 'var(--text-soft)', soft: 'color-mix(in srgb, var(--text-soft) 14%, transparent)' },
};

export function WeekPlanner() {
  const data = useAppStore((s) => s.data);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today(), 1));
  const [editing, setEditing] = useState<TimeBlock | null>(null);
  const [creating, setCreating] = useState<{ date: string; start: string } | null>(null);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const blocks = useMemo(() => data.timeBlocks.filter((b) => b.date >= week[0] && b.date <= week[6]), [data.timeBlocks, week]);
  const totalHours = useMemo(
    () => blocks.reduce((acc, b) => acc + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)), 0) / 60,
    [blocks],
  );

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const t = today();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionHead className="!mb-0" title="Planificación semanal" subtitle="Bloques de tiempo para sostener el día. Tocá un espacio vacío para crear." />
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(startOfWeek(today(), 1))}>Esta semana</button>
          <button className="btn btn-ghost btn-icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating({ date: t, start: '09:00' })}><Plus size={13} /> Bloque</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[0.66rem] text-faint">
        <span>{blocks.length} bloques · {Math.round(totalHours * 10) / 10} h planificadas</span>
        {(Object.keys(TYPE_META) as BlockType[]).map((type) => (
          <span key={type} className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px]" style={{ background: TYPE_META[type].color }} /> {TYPE_META[type].label}</span>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="scroll-x">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">
              <div />
              {week.map((day) => {
                const isToday = day === t;
                return (
                  <div key={day} className={cn('border-l border-line px-1.5 py-2 text-center', isToday && 'bg-accent-soft')}>
                    <p className={cn('text-[0.6rem] font-semibold uppercase tracking-[0.06em]', isToday ? 'text-accent' : 'text-faint')}>{WEEKDAY_MIN[new Date(day + 'T12:00:00').getDay()]}</p>
                    <p className={cn('num mt-0.5 text-[0.78rem] font-medium', isToday ? 'text-ink' : 'text-ink-soft')}>{new Date(day + 'T12:00:00').getDate()}</p>
                  </div>
                );
              })}
            </div>

            <div className="relative grid grid-cols-[52px_repeat(7,1fr)]" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[0.6rem] text-faint" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {hours.map((h) => (
                <div key={`line-${h}`} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (h - START_HOUR) * HOUR_PX, left: 52 }} />
              ))}

              {week.map((day) => {
                const dayBlocks = blocks.filter((b) => b.date === day);
                return (
                  <div key={day} className="relative border-l border-line">
                    {hours.map((h) => (
                      <button
                        key={h}
                        className="absolute inset-x-0 transition-colors hover:bg-panel-2/60"
                        style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                        onClick={() => setCreating({ date: day, start: `${String(h).padStart(2, '0')}:00` })}
                        aria-label={`Crear bloque el ${day} a las ${h}`}
                      />
                    ))}
                    {dayBlocks.map((block) => {
                      const top = ((timeToMinutes(block.start) - START_HOUR * 60) / 60) * HOUR_PX;
                      const height = Math.max(20, ((timeToMinutes(block.end) - timeToMinutes(block.start)) / 60) * HOUR_PX - 2);
                      const meta = TYPE_META[block.type];
                      return (
                        <button
                          key={block.id}
                          onClick={(e) => { e.stopPropagation(); setEditing(block); }}
                          className="absolute inset-x-0.5 z-10 overflow-hidden rounded-[5px] border px-1.5 py-1 text-left backdrop-blur-sm transition-transform hover:z-20 hover:scale-[1.01]"
                          style={{ top, height, background: meta.soft, borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)` }}
                          title={`${block.label} · ${block.start}–${block.end}`}
                        >
                          <span className="block truncate text-[0.62rem] font-semibold leading-tight" style={{ color: meta.color }}>{block.label}</span>
                          <span className="block truncate text-[0.56rem] leading-tight text-faint">{block.start}–{block.end}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {week.map((day) => {
          const dayBlocks = blocks.filter((b) => b.date === day).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
          if (!dayBlocks.length) return null;
          return (
            <div key={day} className="rounded-xl border border-line bg-panel-2/40 p-2.5">
              <p className="mb-1 text-[0.66rem] font-semibold uppercase tracking-[0.06em] text-faint">{WEEKDAY_SHORT[new Date(day + 'T12:00:00').getDay()]} {new Date(day + 'T12:00:00').getDate()}</p>
              <div className="space-y-0.5">
                {dayBlocks.map((b) => (
                  <button key={b.id} onClick={() => setEditing(b)} className="flex w-full items-center gap-1.5 text-left">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TYPE_META[b.type].color }} />
                    <span className="num shrink-0 text-[0.62rem] text-faint">{b.start}</span>
                    <span className="truncate text-[0.7rem] text-ink-soft">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <BlockModal
        open={!!creating || !!editing}
        block={editing}
        defaults={creating ?? undefined}
        onClose={() => { setCreating(null); setEditing(null); }}
      />
    </div>
  );
}

function BlockModal({ open, block, defaults, onClose }: { open: boolean; block?: TimeBlock | null; defaults?: { date: string; start: string }; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const allTasks = useAppStore((s) => s.data.tasks);
  const tasks = useMemo(() => allTasks.filter((x) => x.status !== 'done'), [allTasks]);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<BlockType>('focus');
  const [date, setDate] = useState(today());
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [taskId, setTaskId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = block?.id ?? (defaults ? `${defaults.date}-${defaults.start}` : 'closed');
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setError(null);
    setLabel(block?.label ?? '');
    setType(block?.type ?? 'focus');
    setDate(block?.date ?? defaults?.date ?? today());
    setStart(block?.start ?? defaults?.start ?? '09:00');
    const startMin = timeToMinutes(block?.start ?? defaults?.start ?? '09:00');
    setEnd(block?.end ?? minutesToTime(startMin + 60));
    setTaskId(block?.taskId ?? '');
  }

  const save = () => {
    if (!label.trim()) return setError('Poné un nombre al bloque.');
    if (timeToMinutes(end) <= timeToMinutes(start)) return setError('La hora de fin tiene que ser posterior al inicio.');
    mutateData((d) => {
      if (block) {
        const target = d.timeBlocks.find((b) => b.id === block.id);
        if (target) Object.assign(target, { label: label.trim(), type, date, start, end, taskId: taskId || null });
      } else {
        d.timeBlocks.push({ id: uid('block'), label: label.trim(), type, date, start, end, taskId: taskId || null });
      }
    });
    toast.success(block ? 'Bloque actualizado' : 'Bloque creado', `${start}–${end} · ${label.trim()}`);
    onClose();
  };

  const remove = async () => {
    if (!block) return;
    const ok = await confirm({ title: 'Eliminar bloque', message: `Se va a borrar “${block.label}”.`, confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    mutateData((d) => { d.timeBlocks = d.timeBlocks.filter((b) => b.id !== block.id); });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={block ? 'Editar bloque' : 'Nuevo bloque'}
      size="sm"
      description={block ? fmtDateLong(block.date) : 'Reservá tiempo antes de que el día lo ocupe.'}
      footer={
        <>
          {block ? <button className="btn btn-ghost mr-auto text-danger" onClick={remove} aria-label="Eliminar bloque"><Trash2 size={14} /></button> : null}
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Qué vas a hacer" required error={error}>
          <Input value={label} onChange={(e) => { setLabel(e.target.value); setError(null); }} placeholder="Ej. Estudiar derecho · capítulo 4" invalid={!!error} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as BlockType)}>
              {(Object.keys(TYPE_META) as BlockType[]).map((type) => <option key={type} value={type}>{TYPE_META[type].label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Inicio">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Vincular a tarea" hint="Opcional. Sirve para saber qué bloque corresponde a cada pendiente.">
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Sin tarea</option>
            {tasks.slice(0, 40).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </Select>
        </Field>
        {block?.taskId ? <Badge tone="outline">Vinculado a una tarea abierta</Badge> : null}
      </div>
    </Modal>
  );
}
