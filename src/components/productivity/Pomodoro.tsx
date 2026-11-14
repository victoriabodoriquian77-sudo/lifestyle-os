import { useEffect, useMemo, useState } from 'react';
import { Coffee, Pause, Play, RotateCcw, Sparkles, Timer } from 'lucide-react';
import { mutateData, useAppStore } from '@/store/store';
import { useCountdown } from '@/hooks/useCountdown';
import { playBeep, vibrate, notify } from '@/lib/sound';
import { focusMinutes } from '@/lib/metrics';
import { today, addDays, localDayFromISO } from '@/lib/date';
import { cn, fmtNum, uid } from '@/lib/utils';
import { Segmented, Select } from '@/components/ui/Primitives';
import { toast } from '@/components/ui/Toast';

type Mode = 'focus' | 'break' | 'long';

const PRESETS: Record<Mode, number> = { focus: 25, break: 5, long: 15 };

export function Pomodoro() {
  const data = useAppStore((s) => s.data);
  const sound = data.settings.sound;
  const [mode, setMode] = useState<Mode>('focus');
  const [custom, setCustom] = useState<{ focus: number; break: number; long: number }>({ ...PRESETS });
  const [cycle, setCycle] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const minutes = custom[mode];
  const t = today();

  const timer = useCountdown(minutes * 60, () => {
    playBeep('end', sound);
    vibrate([150, 100, 150]);
    const finishedMode = mode;
    if (finishedMode === 'focus') {
      const now = new Date();
      const started = startedAt ?? new Date(now.getTime() - custom.focus * 60_000).toISOString();
      mutateData((d) => {
        d.pomodoros.push({
          id: uid('pomo'),
          startedAt: started,
          endedAt: now.toISOString(),
          focusMin: custom.focus,
          mode: 'focus',
          taskId: taskId || null,
          completed: true,
        });
      });
      const next: Mode = (cycle + 1) % 4 === 0 ? 'long' : 'break';
      setCycle((c) => c + 1);
      setMode(next);
      if (data.settings.notifications.enabled) notify('Bloque de foco completado', next === 'long' ? 'Descanso largo de 15 minutos.' : 'Descanso corto de 5 minutos.');
      toast.success('Bloque de foco registrado', `${custom.focus} min · ${next === 'long' ? 'descanso largo' : 'descanso corto'}`);
      if (autoStart) setTimeout(() => timer.start(custom[next] * 60), 600);
    } else {
      setMode('focus');
      if (data.settings.notifications.enabled) notify('Descanso terminado', 'Volvé al foco cuando quieras.');
      if (autoStart) setTimeout(() => timer.start(custom.focus * 60), 600);
    }
  });

  // Al cambiar de modo se recalcula la duración.
  useEffect(() => {
    timer.reset(custom[mode] * 60);
    setStartedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, custom]);

  const todayFocus = useMemo(() => focusMinutes(data, t, t), [data, t]);
  const todayCount = useMemo(() => data.pomodoros.filter((p) => localDayFromISO(p.startedAt) === t && p.completed && p.mode === 'focus').length, [data, t]);
  const weekFocus = useMemo(() => focusMinutes(data, addDays(t, -6), t), [data, t]);
  const openTasks = data.tasks.filter((x) => x.status !== 'done');

  const toggle = () => {
    if (timer.running) timer.pause();
    else {
      if (!startedAt || timer.remaining >= minutes * 60 - 1) setStartedAt(new Date().toISOString());
      timer.start();
    }
  };

  const ringSize = 150;
  const stroke = 7;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = timer.duration > 0 ? timer.remaining / timer.duration : 0;

  const modeLabel = mode === 'focus' ? 'Concentración' : mode === 'break' ? 'Descanso corto' : 'Descanso largo';

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink"><Timer size={14} className="text-accent" /> Pomodoro</h3>
          <p className="mt-0.5 text-[0.68rem] text-faint">Bloques de foco con descansos.</p>
        </div>
        <button className="btn btn-ghost btn-sm !text-[0.68rem]" onClick={() => setConfigOpen((v) => !v)}>Configurar</button>
      </div>

      {configOpen ? (
        <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-panel-2 p-2">
          {(['focus', 'break', 'long'] as Mode[]).map((m) => (
            <label key={m} className="block">
              <span className="mb-0.5 block text-[0.58rem] uppercase tracking-[0.06em] text-faint">{m === 'focus' ? 'Foco' : m === 'break' ? 'Corto' : 'Largo'}</span>
              <input
                type="number"
                min={1}
                max={120}
                value={custom[m]}
                onChange={(e) => setCustom({ ...custom, [m]: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })}
                className="input !min-h-[1.8rem] !px-1.5 !py-0.5 text-center !text-[0.75rem]"
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="mb-3">
        <Segmented
          size="sm"
          value={mode}
          onChange={(m) => { setMode(m); setStartedAt(null); }}
          options={[{ value: 'focus', label: 'Foco' }, { value: 'break', label: 'Corto' }, { value: 'long', label: 'Largo' }]}
        />
      </div>

      <div className="relative mx-auto flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize} className="-rotate-90">
          <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke={mode === 'focus' ? 'var(--accent)' : 'var(--info)'} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - ratio * c}
            style={{ transition: 'stroke-dashoffset 300ms linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric text-[2rem]">{String(Math.floor(timer.remaining / 60)).padStart(2, '0')}:{String(Math.floor(timer.remaining % 60)).padStart(2, '0')}</span>
          <span className="mt-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-faint">{modeLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button className="btn btn-primary flex-1" onClick={toggle}>
          {timer.running ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Iniciar</>}
        </button>
        <button className="btn btn-secondary btn-icon" onClick={() => { timer.reset(custom[mode] * 60); setStartedAt(null); }} aria-label="Reiniciar"><RotateCcw size={14} /></button>
      </div>

      <div className="mt-3">
        <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="!min-h-[1.9rem] !py-1 !text-[0.72rem]">
          <option value="">Sin tarea asociada</option>
          {openTasks.slice(0, 20).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </Select>
      </div>

      <button onClick={() => setAutoStart(!autoStart)} className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-left">
        <span className="text-[0.68rem] text-muted">Iniciar descanso automáticamente</span>
        <span className={cn('relative h-4 w-7 rounded-full transition-colors', autoStart ? 'bg-accent' : 'bg-panel-3 border border-line')}>
          <span className={cn('absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all', autoStart ? 'left-3.5 bg-[var(--accent-ink)]' : 'left-0.5 bg-faint')} />
        </span>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-line pt-3 text-center">
        <div>
          <p className="num text-[0.9rem] font-semibold text-ink">{todayCount}</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">bloques hoy</p>
        </div>
        <div>
          <p className="num text-[0.9rem] font-semibold text-ink">{fmtNum(todayFocus)}</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">min hoy</p>
        </div>
        <div>
          <p className="num text-[0.9rem] font-semibold text-accent">{fmtNum(weekFocus)}</p>
          <p className="text-[0.56rem] uppercase tracking-[0.05em] text-faint">min semana</p>
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[0.62rem] leading-snug text-faint">
        <Coffee size={10} /> El descanso es parte del trabajo, no una pausa del progreso.
      </p>
      <p className="mt-1 flex items-center gap-1 text-[0.62rem] leading-snug text-faint">
        <Sparkles size={10} /> Cada bloque completado se guarda en tus estadísticas.
      </p>
    </div>
  );
}
