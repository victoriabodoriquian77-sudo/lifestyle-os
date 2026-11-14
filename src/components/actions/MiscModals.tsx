import { useEffect, useState } from 'react';
import type { WeighIn } from '@/types';
import { Dumbbell, Play, Sparkles } from 'lucide-react';
import { mutateData, useAppStore } from '@/store/store';
import { startSession, upsertCheckin, newWeeklyGoal, newWeighIn, syncProfileWeight } from '@/lib/domain';
import { today, weekKey, WEEKDAY_LONG } from '@/lib/date';
import { navigate } from '@/lib/router';
import { useUI } from '@/store/ui';
import { cn, parseNumber } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Field, Input, Textarea } from '@/components/ui/Primitives';
import { useConfirm } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------ pesaje semanal */

export function WeighInModal({ open, onClose, weighIn }: { open: boolean; onClose: () => void; weighIn?: WeighIn | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const weighIns = useAppStore((s) => s.data.weighIns);
  const profile = useAppStore((s) => s.data.profile);
  const [day, setDay] = useState(today());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const unit = profile.units === 'metric' ? 'kg' : 'lb';
  const toDisplay = (kg: number) => Math.round((profile.units === 'metric' ? kg : kg * 2.2046226) * 10) / 10;

  useEffect(() => {
    if (!open) return;
    const d = weighIn?.date ?? today();
    const existing = weighIn ?? weighIns.find((w) => weekKey(w.date) === weekKey(d));
    setDay(d);
    setEditingId(existing?.id ?? null);
    const kg = existing?.weightKg ?? profile.weightKg;
    setWeight(kg != null ? String(toDisplay(kg)) : '');
    setNote(existing?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, weighIn, weighIns, profile.weightKg, profile.units]);

  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day);
  const sameWeek = validDay ? weighIns.find((w) => weekKey(w.date) === weekKey(day) && w.id !== editingId) : undefined;

  const save = () => {
    if (!validDay) {
      toast.error('Falta la fecha', 'Elegí el día del pesaje.');
      return;
    }
    const raw = parseNumber(weight);
    if (raw == null || raw <= 0) {
      toast.error('Falta el peso', 'Ingresá un número para guardar el pesaje.');
      return;
    }
    const kg = Math.round((profile.units === 'metric' ? raw : raw / 2.2046226) * 10) / 10;
    if (kg < 20 || kg > 400) {
      toast.error('Peso fuera de rango', 'Revisá el número y la unidad.');
      return;
    }
    mutateData((d) => {
      const wk = weekKey(day);
      d.weighIns = d.weighIns.filter((w) => w.id !== editingId && weekKey(w.date) !== wk);
      const entry = newWeighIn(day, kg, note);
      if (editingId) entry.id = editingId;
      d.weighIns.push(entry);
      syncProfileWeight(d);
    });
    toast.success(editingId ? 'Pesaje actualizado' : 'Pesaje guardado', 'Un registro por semana. Lo importante es la tendencia.');
    onClose();
  };

  const remove = async () => {
    if (!editingId) return;
    const ok = await confirm({ title: 'Eliminar pesaje', message: 'Se va a borrar este registro semanal.', confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    mutateData((d) => {
      d.weighIns = d.weighIns.filter((w) => w.id !== editingId);
      syncProfileWeight(d);
    });
    toast.success('Pesaje eliminado');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Actualizar pesaje' : 'Pesaje semanal'}
      description="Un registro por semana. Sirve para ver tendencia, no para juzgarte por un día."
      footer={
        <>
          {editingId ? <button className="btn btn-ghost btn-sm mr-auto !text-danger" onClick={remove}>Eliminar</button> : null}
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{editingId ? 'Guardar cambios' : 'Guardar pesaje'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label={`Peso (${unit})`} hint="Ideal: misma balanza y mismo momento del día.">
            <Input type="number" step={0.1} min={0} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={unit === 'kg' ? 'Ej. 64.5' : 'Ej. 142'} />
          </Field>
        </div>
        {sameWeek ? (
          <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
            Ya hay un pesaje en esa semana. Al guardar, se reemplaza por este.
          </p>
        ) : null}
        <Field label="Nota (opcional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Cómo te sentiste, contexto, ropa, viaje…" />
        </Field>
        <p className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-faint">
          <Sparkles size={12} className="mt-0.5 shrink-0" />
          El peso varía por agua, sal, ciclo y digestión. La serie semanal es más útil que el número aislado.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- iniciar entrenamiento */

export function StartWorkoutModal({ open, onClose, routineId }: { open: boolean; onClose: () => void; routineId?: string | null }) {
  const routines = useAppStore((s) => s.data.routines);
  const toast = useToast();
  const openWorkout = useUI((s) => s.openWorkout);
  const [selected, setSelected] = useState<string>('');
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setSelected(routineId ?? routines[0]?.id ?? '');
  }, [open, routineId, routines]);

  const start = () => {
    const routine = routines.find((r) => r.id === selected);
    if (!routine) return;
    let sessionId = '';
    mutateData((d) => {
      const r = d.routines.find((x) => x.id === routine.id);
      if (!r) return;
      const session = startSession(d, r, date);
      sessionId = session.id;
    });
    if (sessionId) {
      toast.success('Sesión iniciada', routine.name);
      onClose();
      navigate('gym');
      openWorkout(sessionId);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Empezar entrenamiento"
      description="Elegí la rutina y la fecha. La sesión queda guardada aunque cierres la app."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={start} disabled={!routines.length}><Play size={14} /> Iniciar sesión</button>
        </>
      }
    >
      {routines.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={18} />}
          title="Todavía no tenés rutinas"
          description="Creá una desde cero o importá una planilla de Excel o CSV con tus días de entrenamiento."
          action={<button className="btn btn-primary btn-sm" onClick={() => { onClose(); navigate('gym'); }}>Ir a Gym</button>}
        />
      ) : (
        <div className="space-y-3">
          <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
            {routines.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  selected === r.id ? 'border-accent-line bg-accent-soft' : 'border-line bg-panel-2 hover:border-line-strong',
                )}
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', selected === r.id ? 'border-accent-line text-accent' : 'border-line text-faint')}>
                  <Dumbbell size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.83rem] font-medium text-ink">{r.name}</span>
                  <span className="block text-[0.71rem] text-faint">
                    {r.exercises.length} ejercicios · {r.weekday != null ? WEEKDAY_LONG[r.weekday] : 'sin día fijo'}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Field label="Fecha de la sesión">
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------- check-in */

const SCALE = [1, 2, 3, 4, 5];

export function CheckinModal({ open, onClose, date }: { open: boolean; onClose: () => void; date?: string }) {
  const toast = useToast();
  const checkins = useAppStore((s) => s.data.checkins);
  const [sleepH, setSleepH] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState(today());

  useEffect(() => {
    if (!open) return;
    const d = date ?? today();
    setDay(d);
    const existing = checkins.find((c) => c.date === d);
    setSleepH(existing?.sleepH != null ? String(existing.sleepH) : '');
    setEnergy(existing?.energy ?? null);
    setMood(existing?.mood ?? null);
    setRecovery(existing?.recovery ?? null);
    setNotes(existing?.notes ?? '');
  }, [open, date, checkins]);

  const save = () => {
    mutateData((d) => {
      upsertCheckin(d, day, {
        sleepH: sleepH === '' ? null : Math.max(0, Math.min(16, Number(sleepH))),
        energy, mood, recovery, notes: notes.trim(),
      });
    });
    toast.success('Check-in guardado', 'Se actualizó tu bienestar de hoy.');
    onClose();
  };

  const scaleRow = (label: string, value: number | null, set: (v: number) => void) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[0.82rem] text-ink-soft">{label}</span>
      <div className="flex gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            className={cn('h-7 w-7 rounded-lg border text-[0.72rem] font-medium transition-colors', value === n ? 'border-accent-line bg-accent text-[var(--accent-ink)]' : 'border-line text-muted hover:border-line-strong')}
            aria-label={`${label}: ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Check-in de bienestar"
      description="Sueño, energía, ánimo y recuperación percibida. Sin números perfectos."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar check-in</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Horas de sueño" hint="Aproximadas, alcanza.">
            <Input type="number" step={0.5} min={0} max={16} value={sleepH} onChange={(e) => setSleepH(e.target.value)} placeholder="7.5" />
          </Field>
        </div>
        <div className="rounded-xl border border-line bg-panel-2 px-3 py-1.5">
          {scaleRow('Energía', energy, setEnergy)}
          <div className="divider" />
          {scaleRow('Estado de ánimo', mood, setMood)}
          <div className="divider" />
          {scaleRow('Recuperación', recovery, setRecovery)}
        </div>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Cómo te sentiste, qué influyó…" />
        </Field>
        <p className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-faint">
          <Sparkles size={12} className="mt-0.5 shrink-0" />
          Estos datos alimentan tus gráficos de bienestar y los insights. No son un diagnóstico médico.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ objetivo */

export function GoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [week, setWeek] = useState(weekKey(today()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setText(''); setWeek(weekKey(today())); setError(null); }
  }, [open]);

  const save = () => {
    if (!text.trim()) return setError('Escribí el objetivo.');
    mutateData((d) => { d.weeklyGoals.push(newWeeklyGoal(week, text.trim())); });
    toast.success('Objetivo semanal agregado');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Objetivo semanal"
      size="sm"
      description="Uno o dos objetivos concretos por semana rinden más que una lista larga."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Agregar</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Semana">
          <Input type="date" value={week} onChange={(e) => setWeek(weekKey(e.target.value))} />
        </Field>
        <Field label="Objetivo" required error={error}>
          <Input value={text} onChange={(e) => { setText(e.target.value); setError(null); }} placeholder="Ej. Cerrar el TP de geografía" invalid={!!error} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
