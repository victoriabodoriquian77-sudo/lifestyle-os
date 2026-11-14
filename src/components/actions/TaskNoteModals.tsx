import { useEffect, useState } from 'react';
import { Plus, Pin, Trash2, X } from 'lucide-react';
import type { Note, Task, TaskPriority } from '@/types';
import { mutateData, useAppStore } from '@/store/store';
import { newNote, newTask } from '@/lib/domain';
import { cn, uid } from '@/lib/utils';
import { addDays, today } from '@/lib/date';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------- tareas */

export function TaskModal({ open, onClose, task }: { open: boolean; onClose: () => void; task?: Task | null }) {
  const toast = useToast();
  const projects = useAppStore((s) => s.data.projects);
  const categories = useAppStore((s) => s.data.categories);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimated, setEstimated] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setProjectId(task?.projectId ?? '');
    setCategoryId(task?.categoryId ?? '');
    setPriority(task?.priority ?? 'medium');
    setDueDate(task?.dueDate ?? '');
    setEstimated(task?.estimatedMin ? String(task.estimatedMin) : '');
  }, [open, task]);

  const save = () => {
    if (!title.trim()) return setError('La tarea necesita un título.');
    const payload = {
      title: title.trim(),
      notes: notes.trim(),
      projectId: projectId || null,
      categoryId: categoryId || null,
      priority,
      dueDate: dueDate || null,
      estimatedMin: estimated ? Math.max(0, Number(estimated)) : null,
    };
    mutateData((d) => {
      if (task) {
        const target = d.tasks.find((t) => t.id === task.id);
        if (target) Object.assign(target, payload);
      } else {
        d.tasks.push(newTask({ ...payload, status: 'todo' }));
      }
    });
    toast.success(task ? 'Tarea actualizada' : 'Tarea creada', payload.title);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      description="Fecha, prioridad y proyecto. Lo mínimo para no perderle el rastro."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{task ? 'Guardar' : 'Crear tarea'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título" required error={error}>
          <Input value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Ej. Entregar informe de química" invalid={!!error} autoFocus />
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Detalles, links, criterios de entrega…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha límite">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Prioridad">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proyecto">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tiempo estimado" hint="En minutos. Se usa para la planificación por bloques.">
          <Input type="number" min={0} step={5} value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="30" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip chip-outline" onClick={() => setDueDate(today())}>Hoy</button>
          <button type="button" className="chip chip-outline" onClick={() => setDueDate(addDays(today(), 1))}>Mañana</button>
          <button type="button" className="chip chip-outline" onClick={() => setDueDate('')}>Sin fecha</button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- notas */

export function NoteModal({ open, onClose, note }: { open: boolean; onClose: () => void; note?: Note | null }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setTags(note?.tags.join(', ') ?? '');
    setPinned(note?.pinned ?? false);
  }, [open, note]);

  const save = () => {
    if (!title.trim()) return setError('Ponele un título a la nota.');
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    mutateData((d) => {
      if (note) {
        const target = d.notes.find((n) => n.id === note.id);
        if (target) Object.assign(target, { title: title.trim(), body, tags: tagList, pinned, updatedAt: new Date().toISOString() });
      } else {
        d.notes.push(newNote({ title: title.trim(), body, tags: tagList, pinned }));
      }
    });
    toast.success(note ? 'Nota guardada' : 'Nota creada');
    onClose();
  };

  const remove = () => {
    if (!note) return;
    mutateData((d) => { d.notes = d.notes.filter((n) => n.id !== note.id); });
    toast.success('Nota eliminada');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? 'Editar nota' : 'Nota rápida'}
      size="md"
      footer={
        <>
          {note ? <button className="btn btn-ghost mr-auto text-danger" onClick={remove} aria-label="Eliminar nota"><Trash2 size={14} /></button> : null}
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{note ? 'Guardar' : 'Crear nota'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título" required error={error}>
          <Input value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Idea, recordatorio, resumen…" invalid={!!error} autoFocus />
        </Field>
        <Field label="Contenido">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Escribí libremente. Se guarda tal cual." className="font-normal" />
        </Field>
        <Field label="Etiquetas" hint="Separadas por coma.">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="estudio, salud, ideas" />
        </Field>
        <Toggle checked={pinned} onChange={setPinned} label="Fijar arriba" description="Las notas fijadas aparecen primero en la lista." />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- tareas: subtareas */

export function SubtaskEditor({ taskId }: { taskId: string }) {
  const task = useAppStore((s) => s.data.tasks.find((t) => t.id === taskId));
  const [text, setText] = useState('');
  if (!task) return null;

  const add = () => {
    if (!text.trim()) return;
    mutateData((d) => {
      const t = d.tasks.find((x) => x.id === taskId);
      if (t) t.subtasks.push({ id: uid('sub'), title: text.trim(), done: false });
    });
    setText('');
  };

  return (
    <div className="space-y-2">
      {task.subtasks.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mutateData((d) => { const t = d.tasks.find((x) => x.id === taskId); const sub = t?.subtasks.find((x) => x.id === s.id); if (sub) sub.done = !sub.done; })}
            className={cn('flex h-4 w-4 items-center justify-center rounded border text-[9px]', s.done ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong')}
            aria-label={s.done ? 'Desmarcar' : 'Marcar'}
          >
            {s.done ? '✓' : ''}
          </button>
          <span className={cn('flex-1 text-[0.8rem]', s.done && 'checked-line')}>{s.title}</span>
          <button
            type="button"
            className="btn btn-ghost btn-icon !h-6 !w-6"
            onClick={() => mutateData((d) => { const t = d.tasks.find((x) => x.id === taskId); if (t) t.subtasks = t.subtasks.filter((x) => x.id !== s.id); })}
            aria-label="Eliminar subtarea"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Agregar subtarea…"
          className="!min-h-[2rem] !py-1 text-[0.8rem]"
        />
        <button className="btn btn-secondary btn-icon !h-[2rem] !w-[2rem]" onClick={add} aria-label="Agregar subtarea"><Plus size={14} /></button>
      </div>
    </div>
  );
}

export function PinButton({ note }: { note: Note }) {
  return (
    <button
      className={cn('btn btn-ghost btn-icon !h-7 !w-7', note.pinned && 'text-accent')}
      onClick={() => mutateData((d) => { const n = d.notes.find((x) => x.id === note.id); if (n) n.pinned = !n.pinned; })}
      aria-label={note.pinned ? 'Desfijar' : 'Fijar'}
    >
      <Pin size={13} />
    </button>
  );
}
