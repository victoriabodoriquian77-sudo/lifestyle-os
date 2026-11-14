import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { Routine, RoutineExercise } from '@/types';
import { MUSCLE_GROUPS } from '@/types';
import { mutateData } from '@/store/store';
import { newRoutineExercise } from '@/lib/domain';
import { guessMuscleGroup } from '@/lib/muscle';
import { WEEKDAY_LONG } from '@/lib/date';
import { cn, uid } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

const blankExercise = (order: number): RoutineExercise => newRoutineExercise({ name: '', muscleGroup: 'Otro', sets: 3, repsTarget: '10', restSec: 90, order });

export function RoutineModal({ open, onClose, routine }: { open: boolean; onClose: () => void; routine?: Routine | null }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weekday, setWeekday] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(routine?.name ?? '');
    setDescription(routine?.description ?? '');
    setWeekday(routine?.weekday != null ? String(routine.weekday) : '');
    setNotes(routine?.notes ?? '');
    setExercises(
      routine
        ? routine.exercises.slice().sort((a, b) => a.order - b.order).map((e) => ({ ...e }))
        : [blankExercise(0), blankExercise(1), blankExercise(2)],
    );
  }, [open, routine]);

  const patch = (id: string, change: Partial<RoutineExercise>) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...change } : e)));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...exercises];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setExercises(next.map((e, i) => ({ ...e, order: i })));
  };

  const save = () => {
    if (!name.trim()) return setError('Ponele un nombre a la rutina.');
    const cleaned = exercises.filter((e) => e.name.trim());
    if (!cleaned.length) return setError('Agregá al menos un ejercicio.');
    const invalid = cleaned.find((e) => !e.sets || e.sets < 1 || e.sets > 15);
    if (invalid) return setError(`Revisá las series de “${invalid.name}” (entre 1 y 15).`);

    const muscleGroups = [...new Set(cleaned.map((e) => e.muscleGroup))];
    const now = new Date().toISOString();
    mutateData((d) => {
      if (routine) {
        const target = d.routines.find((r) => r.id === routine.id);
        if (!target) return;
        Object.assign(target, {
          name: name.trim(),
          description: description.trim(),
          weekday: weekday === '' ? null : Number(weekday),
          notes: notes.trim(),
          muscleGroups,
          exercises: cleaned.map((e, i) => ({ ...e, name: e.name.trim(), order: i })),
          updatedAt: now,
        });
      } else {
        d.routines.push({
          id: uid('routine'),
          name: name.trim(),
          description: description.trim(),
          weekday: weekday === '' ? null : Number(weekday),
          notes: notes.trim(),
          muscleGroups,
          exercises: cleaned.map((e, i) => ({ ...e, name: e.name.trim(), order: i })),
          createdAt: now,
          updatedAt: now,
          source: 'manual',
        });
      }
    });
    toast.success(routine ? 'Rutina actualizada' : 'Rutina creada', name.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={routine ? 'Editar rutina' : 'Nueva rutina'}
      description="Ejercicios, series, repeticiones y descanso. Después podés duplicarla o importarla desde una planilla."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{routine ? 'Guardar rutina' : 'Crear rutina'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Nombre" required error={error}>
            <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ej. Push A · Pecho y tríceps" invalid={!!error} autoFocus />
          </Field>
          <Field label="Día sugerido">
            <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              <option value="">Sin día</option>
              {WEEKDAY_LONG.slice(1).map((d) => <option key={d} value={WEEKDAY_LONG.indexOf(d)}>{d}</option>)}
              <option value={0}>domingo</option>
            </Select>
          </Field>
        </div>

        <Field label="Descripción">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enfoque, progresión o cualquier contexto útil" />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label !mb-0">Ejercicios ({exercises.filter((e) => e.name.trim()).length})</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setExercises((p) => [...p, blankExercise(p.length)])}>
              <Plus size={13} /> Agregar
            </button>
          </div>

          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <div key={ex.id} className="rounded-xl border border-line bg-panel-2/60 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="hidden text-faint sm:flex sm:flex-col">
                    <button className="hover:text-ink disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp size={11} /></button>
                    <button className="hover:text-ink disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Bajar"><ArrowDown size={11} /></button>
                  </div>
                  <GripVertical size={13} className="hidden shrink-0 text-faint/50 sm:block" />
                  <Input
                    value={ex.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      const guess = guessMuscleGroup(value);
                      patch(ex.id, guess ? { name: value, muscleGroup: guess } : { name: value });
                    }}
                    placeholder={`Ejercicio ${i + 1}`}
                    className="!min-h-[2.1rem] flex-1 !py-1 !text-[0.82rem]"
                  />
                  <button
                    className="btn btn-ghost btn-icon !h-8 !w-8 shrink-0 hover:text-danger"
                    onClick={() => setExercises((p) => p.filter((x) => x.id !== ex.id))}
                    aria-label="Quitar ejercicio"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block">
                    <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.08em] text-faint">Grupo</span>
                    <Select value={ex.muscleGroup} onChange={(e) => patch(ex.id, { muscleGroup: e.target.value })} className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]">
                      {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.08em] text-faint">Series</span>
                    <Input type="number" min={1} max={15} value={ex.sets} onChange={(e) => patch(ex.id, { sets: Number(e.target.value) })} className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.08em] text-faint">Reps</span>
                    <Input value={ex.repsTarget} onChange={(e) => patch(ex.id, { repsTarget: e.target.value })} placeholder="8-12" className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.08em] text-faint">Descanso (s)</span>
                    <Input type="number" min={0} step={15} value={ex.restSec} onChange={(e) => patch(ex.id, { restSec: Number(e.target.value) })} className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" />
                  </label>
                </div>
                <Input
                  value={ex.notes}
                  onChange={(e) => patch(ex.id, { notes: e.target.value })}
                  placeholder="Observaciones (tempo, técnica, variante…)"
                  className={cn('mt-2 !min-h-[1.9rem] !py-0.5 !text-[0.73rem]', !ex.notes && 'text-faint')}
                />
              </div>
            ))}
          </div>
        </div>

        <Field label="Notas de la rutina">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Calentamiento, orden, indicaciones generales…" />
        </Field>
      </div>
    </Modal>
  );
}
