import { useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Dumbbell, Minus, Pause, Play, Plus, RotateCcw, Timer, Trophy, X,
} from 'lucide-react';
import type { SessionExercise, SessionSet } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { useUI } from '@/store/ui';
import { finishSession } from '@/lib/domain';
import { sessionVolume, personalRecords, lastExercisePerformance } from '@/lib/metrics';
import { fmtTime, fmtDateLong } from '@/lib/date';
import { useCountdown } from '@/hooks/useCountdown';
import { playBeep, vibrate, notify } from '@/lib/sound';
import { cn, fmtClock, fmtNum, uid } from '@/lib/utils';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const PRESETS = [30, 60, 90, 120, 180];

export function WorkoutMode() {
  const sessionId = useUI((s) => s.activeSessionId);
  const close = useUI((s) => s.closeWorkout);
  const settings = useAppStore((s) => s.data.settings);
  const session = useAppStore((s) => s.data.sessions.find((x) => x.id === sessionId));
  const allSessions = useAppStore((s) => s.data.sessions);
  const data = useAppStore((s) => s.data);
  const toast = useToast();
  const confirm = useConfirm();

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [finishOpen, setFinishOpen] = useState(false);
  const [customRest, setCustomRest] = useState('');

  const exercise: SessionExercise | undefined = session?.exercises[index];

  const rest = useCountdown(exercise?.restSec ?? settings.restDefaultSec, () => {
    playBeep('end', settings.sound);
    vibrate([120, 80, 120]);
    if (settings.notifications.enabled && settings.notifications.restTimer) notify('Descanso terminado', 'Siguiente serie.');
  });

  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    setIndex(0);
    setFinishOpen(false);
  }, [sessionId]);

  useEffect(() => {
    if (exercise) rest.reset(exercise.restSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const previousSession = useMemo(() => {
    if (!session) return null;
    const list = allSessions
      .filter((s) => s.status === 'completed' && s.routineId === session.routineId && s.id !== session.id)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return list[list.length - 1] ?? null;
  }, [allSessions, session]);

  const priorBest = useMemo(() => {
    const map = new Map<string, number>();
    personalRecords(data).forEach((r) => map.set(r.name.trim().toLowerCase(), r.bestWeight));
    return map;
  }, [data]);

  if (!sessionId || !session) return null;

  const elapsed = Math.max(0, (now - new Date(session.startedAt).getTime()) / 1000);
  const totalSets = session.exercises.reduce((t, e) => t + e.sets.length, 0);
  const doneSets = session.exercises.reduce((t, e) => t + e.sets.filter((s) => s.completed).length, 0);
  const volume = sessionVolume(session);

  const patchSet = (exerciseId: string, setId: string, patch: Partial<SessionSet>) => {
    mutateData((d) => {
      const s = d.sessions.find((x) => x.id === session.id);
      const ex = s?.exercises.find((x) => x.id === exerciseId);
      const set = ex?.sets.find((x) => x.id === setId);
      if (set) Object.assign(set, patch);
    });
  };

  const completeSet = (ex: SessionExercise, set: SessionSet) => {
    const completing = !set.completed;
    const patch: Partial<SessionSet> = { completed: completing };
    if (completing && set.reps == null) {
      const target = exercise?.repsTarget ?? '10';
      const nums = target.match(/\d+/g)?.map(Number) ?? [];
      patch.reps = nums.length ? Math.min(...nums) : 10;
    }
    patchSet(ex.id, set.id, patch);
    if (completing) {
      playBeep('tick', settings.sound);
      if (settings.autoRest) rest.start(ex.restSec);
    }
  };

  const addSet = (ex: SessionExercise) => {
    mutateData((d) => {
      const s = d.sessions.find((x) => x.id === session.id);
      const target = s?.exercises.find((x) => x.id === ex.id);
      if (!target) return;
      const last = target.sets[target.sets.length - 1];
      target.sets.push({ id: uid('set'), weightKg: last?.weightKg ?? null, reps: null, completed: false, rpe: null });
    });
  };

  const removeSet = (exId: string, setId: string) => {
    mutateData((d) => {
      const s = d.sessions.find((x) => x.id === session.id);
      const ex = s?.exercises.find((x) => x.id === exId);
      if (ex && ex.sets.length > 1) ex.sets = ex.sets.filter((x) => x.id !== setId);
    });
  };

  const finish = () => {
    const newPrs: string[] = [];
    session.exercises.forEach((ex) => {
      const best = Math.max(0, ...ex.sets.filter((s) => s.completed).map((s) => s.weightKg ?? 0));
      const prior = priorBest.get(ex.name.trim().toLowerCase()) ?? 0;
      if (best > 0 && best > prior) newPrs.push(ex.name);
    });
    mutateData((d) => { finishSession(d, session.id); });
    setFinishOpen(false);
    toast.success('Entrenamiento guardado', `${doneSets} series · ${fmtNum(volume)} kg de volumen`);
    if (newPrs.length) setTimeout(() => toast.success('¡Nuevo récord!', newPrs.slice(0, 2).join(' · ')), 600);
    close();
  };

  const askFinish = async () => {
    if (doneSets === 0) {
      const ok = await confirm({ title: 'Salir sin registrar series', message: 'La sesión quedará como abandonada y no contará en tus estadísticas. ¿Continuar?', confirmLabel: 'Salir', tone: 'danger' });
      if (!ok) return;
      mutateData((d) => {
        const s = d.sessions.find((x) => x.id === session.id);
        if (s) { s.status = 'abandoned'; s.finishedAt = new Date().toISOString(); }
      });
      close();
      return;
    }
    setFinishOpen(true);
  };

  const prevPerformance = exercise ? lastExercisePerformance(data, exercise.name) : null;
  const prevSets = previousSession?.exercises.find((e) => e.name.trim().toLowerCase() === exercise?.name.trim().toLowerCase())?.sets;

  const ring = (() => {
    const size = 132;
    const stroke = 8;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const ratio = rest.duration > 0 ? rest.remaining / rest.duration : 0;
    return { size, stroke, r, c, offset: c - ratio * c };
  })();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button className="btn btn-ghost btn-icon" onClick={close} aria-label="Minimizar"><ChevronLeft size={17} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9rem] font-semibold text-ink">{session.name}</p>
            <p className="text-[0.68rem] text-faint">
              <span className="capitalize">{fmtDateLong(session.date)}</span> · <span className="num">{fmtTime(fmtClock(elapsed))}</span> · {doneSets}/{totalSets} series
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="chip chip-accent"><Trophy size={11} /> {fmtNum(volume)} kg</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={askFinish}><Check size={14} /> Terminar</button>
        </div>
        <div className="h-[2px] w-full bg-[var(--ring-track)]">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="scroll-x -mx-1 mb-4 flex gap-1.5 px-1 pb-1">
            {session.exercises.map((ex, i) => {
              const done = ex.sets.filter((s) => s.completed).length;
              return (
                <button
                  key={ex.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                    i === index ? 'border-accent-line bg-accent-soft' : 'border-line bg-panel-2 hover:border-line-strong',
                  )}
                >
                  <span className={cn('block max-w-[9rem] truncate text-[0.72rem] font-medium', i === index ? 'text-accent' : 'text-ink-soft')}>{ex.name}</span>
                  <span className="num block text-[0.62rem] text-faint">{done}/{ex.sets.length}</span>
                </button>
              );
            })}
          </div>

          {exercise ? (
            <div className="card card-pad">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="chip chip-outline">{exercise.muscleGroup}</span>
                    <span className="chip">Objetivo {exercise.repsTarget} reps</span>
                    {prevPerformance ? <span className="chip chip-info">Último: {fmtNum(prevPerformance.weight)} kg × {prevPerformance.reps}</span> : null}
                  </div>
                  <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">{exercise.name}</h2>
                  <p className="mt-0.5 text-[0.72rem] text-faint">Ejercicio {index + 1} de {session.exercises.length}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[36px_1fr_1fr_44px_28px] items-center gap-2 border-b border-line bg-panel-2 px-2.5 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-faint sm:grid-cols-[36px_84px_1fr_1fr_44px_28px]">
                  <span>#</span>
                  <span className="hidden sm:block">Anterior</span>
                  <span>Peso (kg)</span>
                  <span>Reps</span>
                  <span className="text-center">Listo</span>
                  <span />
                </div>
                {exercise.sets.map((set, si) => {
                  const prev = prevSets?.[si];
                  return (
                    <div
                      key={set.id}
                      className={cn('grid grid-cols-[36px_1fr_1fr_44px_28px] items-center gap-2 border-b border-line px-2.5 py-2 last:border-b-0 sm:grid-cols-[36px_84px_1fr_1fr_44px_28px]', set.completed && 'bg-accent-soft/40')}
                    >
                      <span className={cn('text-[0.75rem] font-semibold', set.completed ? 'text-accent' : 'text-faint')}>{si + 1}</span>
                      <span className="num hidden text-[0.72rem] text-faint sm:block">
                        {prev?.completed && prev.weightKg ? `${fmtNum(prev.weightKg)}×${prev.reps ?? '—'}` : '—'}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={set.weightKg ?? ''}
                        onChange={(e) => patchSet(exercise.id, set.id, { weightKg: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="—"
                        className="input !min-h-[2.2rem] !py-1 text-center !text-[0.85rem]"
                        aria-label={`Peso serie ${si + 1}`}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps ?? ''}
                        onChange={(e) => patchSet(exercise.id, set.id, { reps: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder={exercise.repsTarget}
                        className="input !min-h-[2.2rem] !py-1 text-center !text-[0.85rem]"
                        aria-label={`Repeticiones serie ${si + 1}`}
                      />
                      <button
                        onClick={() => completeSet(exercise, set)}
                        className={cn(
                          'mx-auto flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                          set.completed ? 'border-transparent bg-accent text-[var(--accent-ink)]' : 'border-line-strong text-faint hover:border-accent-line hover:text-accent',
                        )}
                        aria-label={set.completed ? 'Desmarcar serie' : 'Completar serie'}
                      >
                        <Check size={15} strokeWidth={2.6} />
                      </button>
                      <button className="btn btn-ghost btn-icon !h-7 !w-7 text-faint hover:text-danger" onClick={() => removeSet(exercise.id, set.id)} aria-label="Quitar serie">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => addSet(exercise)}><Plus size={13} /> Serie</button>
              </div>

              <textarea
                value={exercise.notes}
                onChange={(e) => {
                  const value = e.target.value;
                  mutateData((d) => {
                    const s = d.sessions.find((x) => x.id === session.id);
                    const ex = s?.exercises.find((x) => x.id === exercise.id);
                    if (ex) ex.notes = value;
                  });
                }}
                placeholder="Observaciones de este ejercicio (técnica, sensaciones, ajustes)…"
                rows={2}
                className="textarea mt-3 !min-h-[3.2rem] !text-[0.78rem]"
              />

              <div className="mt-4 flex items-center justify-between gap-2">
                <button className="btn btn-secondary btn-sm" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-[0.68rem] text-faint">{doneSets}/{totalSets} completadas</span>
                <button className="btn btn-secondary btn-sm" disabled={index >= session.exercises.length - 1} onClick={() => setIndex((i) => Math.min(session.exercises.length - 1, i + 1))}>
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="card card-pad text-center text-[0.82rem] text-muted">
              Esta rutina no tiene ejercicios cargados.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button className="btn btn-ghost btn-sm text-danger" onClick={askFinish}>Cancelar sesión</button>
            <p className="text-[0.68rem] text-faint">Se guarda automáticamente en este dispositivo.</p>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[0.83rem] font-semibold text-ink"><Timer size={14} className="text-accent" /> Descanso</h3>
              {rest.running ? <span className="chip chip-accent animate-pulse-soft">activo</span> : <span className="chip">en pausa</span>}
            </div>

            <div className="relative mx-auto mb-3 flex items-center justify-center" style={{ width: ring.size, height: ring.size }}>
              <svg width={ring.size} height={ring.size} className="-rotate-90">
                <circle cx={ring.size / 2} cy={ring.size / 2} r={ring.r} fill="none" stroke="var(--ring-track)" strokeWidth={ring.stroke} />
                <circle
                  cx={ring.size / 2} cy={ring.size / 2} r={ring.r} fill="none" stroke="var(--accent)" strokeWidth={ring.stroke}
                  strokeLinecap="round" strokeDasharray={ring.c} strokeDashoffset={ring.offset}
                  style={{ transition: 'stroke-dashoffset 200ms linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="metric text-[1.9rem]">{fmtClock(rest.remaining)}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.1em] text-faint">{fmtClock(rest.duration)}</span>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-center gap-1.5">
              <button className="btn btn-primary flex-1" onClick={() => (rest.running ? rest.pause() : rest.start())}>
                {rest.running ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Iniciar</>}
              </button>
              <button className="btn btn-secondary btn-icon" onClick={() => rest.reset()} aria-label="Reiniciar"><RotateCcw size={14} /></button>
              <button className="btn btn-secondary btn-icon" onClick={() => rest.addTime(15)} aria-label="Sumar 15 segundos"><Plus size={14} /></button>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => rest.start(p)} className="rounded-md border border-line py-1 text-[0.66rem] font-medium text-muted transition-colors hover:border-accent-line hover:text-accent">
                  {p}s
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                type="number"
                min={5}
                max={600}
                value={customRest}
                onChange={(e) => setCustomRest(e.target.value)}
                placeholder="Personalizado"
                className="input !min-h-[2rem] !py-1 !text-[0.72rem]"
                aria-label="Descanso personalizado en segundos"
              />
              <button
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => {
                  const n = Number(customRest);
                  if (n >= 5 && n <= 900) rest.start(n);
                }}
              >
                Aplicar
              </button>
            </div>
            <p className="mt-2 text-center text-[0.64rem] text-faint">Se inicia automáticamente al completar una serie.</p>
          </div>

          <div className="card card-pad">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[0.83rem] font-semibold text-ink"><Dumbbell size={14} className="text-accent" /> Sesión</h3>
            <div className="space-y-2">
              <Row label="Duración" value={fmtClock(elapsed)} />
              <Row label="Series" value={`${doneSets} / ${totalSets}`} />
              <Row label="Volumen" value={`${fmtNum(volume)} kg`} />
              <Row label="Ejercicios" value={`${session.exercises.filter((e) => e.sets.some((s) => s.completed)).length} / ${session.exercises.length}`} />
            </div>
            <textarea
              value={session.notes}
              onChange={(e) => {
                const value = e.target.value;
                mutateData((d) => {
                  const s = d.sessions.find((x) => x.id === session.id);
                  if (s) s.notes = value;
                });
              }}
              placeholder="Notas generales de la sesión…"
              rows={2}
              className="textarea mt-3 !min-h-[3rem] !text-[0.75rem]"
            />
          </div>

        </aside>
      </main>

      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Terminar entrenamiento"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFinishOpen(false)}>Seguir entrenando</button>
            <button className="btn btn-primary" onClick={finish}>Guardar sesión</button>
          </>
        }
      >
        <div className="space-y-2 text-[0.83rem] text-muted">
          <p>Vas a guardar <span className="font-semibold text-ink">{doneSets} series</span> de {totalSets}, con un volumen total de <span className="font-semibold text-ink">{fmtNum(volume)} kg</span>.</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-xl border border-line bg-panel-2 px-3 py-2">
              <p className="text-[0.66rem] uppercase tracking-[0.08em] text-faint">Duración</p>
              <p className="metric mt-1 text-[1rem]">{fmtClock(elapsed)}</p>
            </div>
            <div className="rounded-xl border border-line bg-panel-2 px-3 py-2">
              <p className="text-[0.66rem] uppercase tracking-[0.08em] text-faint">Ejercicios</p>
              <p className="metric mt-1 text-[1rem]">{session.exercises.filter((e) => e.sets.some((s) => s.completed)).length}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.74rem] text-muted">{label}</span>
      <span className="num text-[0.76rem] font-medium text-ink-soft">{value}</span>
    </div>
  );
}

function MinusIcon() {
  return <Minus size={14} />;
}
void MinusIcon;
