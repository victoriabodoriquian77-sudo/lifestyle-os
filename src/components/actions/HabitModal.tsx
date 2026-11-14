import { useEffect, useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import type { Habit, HabitFrequency } from '@/types';
import { mutateData } from '@/store/store';
import { newHabit } from '@/lib/domain';
import { HABIT_COLORS, HABIT_ICON_NAMES, habitIcon } from '@/lib/icons';
import { WEEKDAY_MIN } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { Field, Input, Segmented, Select, Textarea, Toggle } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

export function HabitModal({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Target');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [freqType, setFreqType] = useState<HabitFrequency['type']>('daily');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [targetPerDay, setTargetPerDay] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setIcon(habit.icon);
      setColor(habit.color);
      setFreqType(habit.frequency.type);
      setDays(habit.frequency.type === 'days' ? habit.frequency.days : [1, 2, 3, 4, 5]);
      setTimesPerWeek(habit.frequency.type === 'weekly' ? habit.frequency.timesPerWeek : 3);
      setTimeOfDay(habit.timeOfDay ?? '');
      setTargetPerDay(habit.targetPerDay);
    } else {
      setName('');
      setDescription('');
      setIcon('Target');
      setColor(HABIT_COLORS[0]);
      setFreqType('daily');
      setDays([1, 2, 3, 4, 5]);
      setTimesPerWeek(3);
      setTimeOfDay('');
      setTargetPerDay(1);
    }
  }, [open, habit]);

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = () => {
    if (!name.trim()) return setError('Poné un nombre para el hábito.');
    if (freqType === 'days' && !days.length) return setError('Elegí al menos un día.');
    const frequency: HabitFrequency =
      freqType === 'daily' ? { type: 'daily' } : freqType === 'days' ? { type: 'days', days } : { type: 'weekly', timesPerWeek: Math.max(1, Math.min(7, timesPerWeek)) };

    mutateData((d) => {
      if (habit) {
        const target = d.habits.find((h) => h.id === habit.id);
        if (!target) return;
        Object.assign(target, { name: name.trim(), description: description.trim(), icon, color, frequency, timeOfDay: timeOfDay || null, targetPerDay: Math.max(1, targetPerDay) });
      } else {
        d.habits.push(
          newHabit({
            name: name.trim(), description: description.trim(), icon, color, frequency,
            timeOfDay: timeOfDay || null, targetPerDay: Math.max(1, targetPerDay), order: Date.now(),
          }),
        );
      }
    });
    toast.success(habit ? 'Hábito actualizado' : 'Hábito creado', name.trim());
    onClose();
  };

  const remove = async () => {
    if (!habit) return;
    const ok = await confirm({
      title: 'Eliminar hábito',
      message: `Se va a eliminar “${habit.name}” y su historial de marcas. Esta acción no se puede deshacer. Si querés conservar los datos, usá Archivar.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    mutateData((d) => {
      d.habits = d.habits.filter((h) => h.id !== habit.id);
      d.habitLogs = d.habitLogs.filter((l) => l.habitId !== habit.id);
    });
    toast.success('Hábito eliminado');
    onClose();
  };

  const Icon = habitIcon(icon);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? 'Editar hábito' : 'Nuevo hábito'}
      description="Definí qué querés sostener y con qué frecuencia. Podés cambiarlo cuando quieras."
      footer={
        <>
          {habit ? (
            <button className="btn btn-ghost mr-auto" onClick={() => { mutateData((d) => { const h = d.habits.find((x) => x.id === habit.id); if (h) h.archived = !h.archived; }); toast.success(habit.archived ? 'Hábito reactivado' : 'Hábito archivado'); onClose(); }}>
              <Archive size={14} /> {habit.archived ? 'Reactivar' : 'Archivar'}
            </button>
          ) : null}
          {habit ? <button className="btn btn-ghost text-danger" onClick={remove} aria-label="Eliminar hábito"><Trash2 size={14} /></button> : null}
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{habit ? 'Guardar cambios' : 'Crear hábito'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel-2" style={{ color }}>
            <Icon size={20} strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <Field label="Nombre" required error={error}>
              <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ej. Caminar 20 minutos" invalid={!!error} autoFocus />
            </Field>
          </div>
        </div>

        <Field label="Descripción" hint="Opcional. Ayuda a definir qué cuenta como cumplido.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ej. Al menos 20 minutos continuos, puede ser a la mañana o después del almuerzo" />
        </Field>

        <Field label="Ícono">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {HABIT_ICON_NAMES.map((n) => {
              const Ic = habitIcon(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  className={cn('flex h-8 items-center justify-center rounded-lg border transition-colors', icon === n ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-muted hover:bg-panel-2 hover:text-ink')}
                  aria-label={n}
                >
                  <Ic size={15} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-105', color === c ? 'border-ink' : 'border-transparent')}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>

        <Field label="Frecuencia">
          <Segmented
            value={freqType}
            onChange={(v) => setFreqType(v)}
            options={[
              { value: 'daily', label: 'Todos los días' },
              { value: 'days', label: 'Días fijos' },
              { value: 'weekly', label: 'Veces por semana' },
            ]}
          />
        </Field>

        {freqType === 'days' ? (
          <div className="flex gap-1.5">
            {WEEKDAY_MIN.map((label, d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn('h-9 flex-1 rounded-lg border text-[0.75rem] font-medium transition-colors', days.includes(d) ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-muted hover:bg-panel-2')}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {freqType === 'weekly' ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
            <span className="text-[0.8rem] text-muted">Objetivo:</span>
            <Input type="number" min={1} max={7} value={timesPerWeek} onChange={(e) => setTimesPerWeek(Number(e.target.value))} className="!w-16 text-center" />
            <span className="text-[0.8rem] text-muted">veces por semana</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hora sugerida" hint="Para ordenar tu día.">
            <Input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
          </Field>
          <Field label="Veces por día" hint="Si requiere más de una marca.">
            <Select value={targetPerDay} onChange={(e) => setTargetPerDay(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'vez' : 'veces'}</option>)}
            </Select>
          </Field>
        </div>

        {habit ? <Toggle checked={!habit.archived} onChange={(v) => { mutateData((d) => { const h = d.habits.find((x) => x.id === habit.id); if (h) h.archived = !v; }); }} label="Hábito activo" description="Los archivados no aparecen en el día a día pero conservan su historial." /> : null}
      </div>
    </Modal>
  );
}
