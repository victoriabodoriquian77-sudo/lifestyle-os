import { useMemo, useState } from 'react';
import { Calculator, Dumbbell, Pause, Play, RotateCcw, Ruler, Scale, Timer, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/store';
import { useCountdown } from '@/hooks/useCountdown';
import { notify, playBeep, vibrate } from '@/lib/sound';
import { fmtClock, fmtNum, parseNumber, cn, round } from '@/lib/utils';
import { Field, Input, Meter, ProgressRing, Select, SectionHead } from '@/components/ui/Primitives';
import { exerciseNames, lastExercisePerformance, personalRecords } from '@/lib/metrics';
import { toast } from '@/components/ui/Toast';

/* -------------------------------------------------------------- descanso */

const REST_PRESETS = [30, 60, 90, 120, 180];

export function RestTimer() {
  const sound = useAppStore((s) => s.data.settings.sound);
  const notifications = useAppStore((s) => s.data.settings.notifications);
  const [custom, setCustom] = useState('150');
  const timer = useCountdown(90, () => {
    playBeep('end', sound);
    vibrate([200, 100, 200]);
    if (notifications.enabled && notifications.restTimer) notify('Descanso terminado', 'Es momento de la siguiente serie.');
    toast.success('Descanso terminado', 'Es momento de la siguiente serie.');
  });

  const size = 170;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = timer.duration > 0 ? timer.remaining / timer.duration : 0;

  return (
    <div className="card card-pad">
      <SectionHead title="Cronómetro de descanso" subtitle="Presets o tiempo a medida, con aviso sonoro." action={<Timer size={15} className="text-accent" />} />
      <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - ratio * c} style={{ transition: 'stroke-dashoffset 200ms linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric text-[2.1rem]">{fmtClock(timer.remaining)}</span>
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-faint">{timer.running ? 'descansando' : 'listo'}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        <button className="btn btn-primary flex-1" onClick={() => (timer.running ? timer.pause() : timer.start())}>
          {timer.running ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Iniciar</>}
        </button>
        <button className="btn btn-secondary btn-icon" onClick={() => timer.reset()} aria-label="Reiniciar"><RotateCcw size={14} /></button>
        <button className="btn btn-secondary btn-sm" onClick={() => timer.addTime(15)}>+15s</button>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {REST_PRESETS.map((p) => (
          <button key={p} onClick={() => timer.start(p)} className="rounded-md border border-line py-1.5 text-[0.7rem] font-medium text-muted transition-colors hover:border-accent-line hover:text-accent">{p}s</button>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5">
        <Input type="number" min={5} max={900} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Segundos" className="!min-h-[2rem] !py-1 !text-[0.75rem]" aria-label="Tiempo personalizado" />
        <button
          className="btn btn-secondary btn-sm shrink-0"
          onClick={() => {
            const n = Number(custom);
            if (n >= 5 && n <= 900) timer.start(n);
          }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- conversor */

const CONVERSIONS = {
  peso: { label: 'Peso', units: { kg: 1, lb: 0.45359237, g: 0.001, oz: 0.0283495 } },
  distancia: { label: 'Distancia', units: { km: 1, mi: 1.609344, m: 0.001, yd: 0.0009144 } },
  volumen: { label: 'Volumen', units: { ml: 1, l: 1000, 'oz fl': 29.5735, taza: 240 } },
} as const;

type ConvKey = keyof typeof CONVERSIONS;

export function UnitConverter() {
  const [kind, setKind] = useState<ConvKey>('peso');
  const [value, setValue] = useState('60');
  const [from, setFrom] = useState('kg');
  const [to, setTo] = useState('lb');

  const units = CONVERSIONS[kind].units as Record<string, number>;
  const unitList = Object.keys(units);
  const input = parseNumber(value) ?? 0;
  const result = (input * units[from]) / units[to];

  const changeKind = (k: ConvKey) => {
    setKind(k);
    const list = Object.keys(CONVERSIONS[k].units);
    setFrom(list[0]);
    setTo(list[1]);
  };

  return (
    <div className="card card-pad">
      <SectionHead title="Calculadora de unidades" subtitle="Peso, distancia y volumen." action={<Ruler size={15} className="text-accent" />} />
      <div className="mb-2 flex gap-1">
        {(Object.keys(CONVERSIONS) as ConvKey[]).map((k) => (
          <button key={k} onClick={() => changeKind(k)} className={cn('flex-1 rounded-md border px-1 py-1.5 text-[0.7rem] transition-colors', kind === k ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink')}>
            {CONVERSIONS[k].label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <Field label="Valor">
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="De">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            {unitList.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      <div className="my-2 flex items-center gap-2 text-faint">
        <div className="flex-1 border-t border-line" />
        <Scale size={13} />
        <div className="flex-1 border-t border-line" />
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div>
          <span className="label">Resultado</span>
          <div className="flex h-[2.55rem] items-center rounded-[11px] border border-line bg-panel px-3">
            <span className="num text-[0.95rem] font-semibold text-ink">{fmtNum(result, 2)}</span>
          </div>
        </div>
        <Field label="A">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {unitList.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      <p className="mt-2 text-[0.66rem] text-faint">{fmtNum(input, 2)} {from} = {fmtNum(result, 2)} {to}</p>
    </div>
  );
}

/* --------------------------------------------------- progresión de cargas */

export function LoadCalculator() {
  const data = useAppStore((s) => s.data);
  const names = useMemo(() => exerciseNames(data), [data]);
  const prs = useMemo(() => personalRecords(data), [data]);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('5');

  const last = exercise ? lastExercisePerformance(data, exercise) : null;
  const w = parseNumber(weight) ?? last?.weight ?? 0;
  const r = Number(reps) || 1;
  const oneRm = w > 0 ? (r <= 1 ? w : w * (1 + r / 30)) : 0;

  const rows = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map((pctOfMax) => ({
    pct: pctOfMax,
    kg: round((oneRm * pctOfMax) / 100 / 2.5) * 2.5,
    reps: pctOfMax >= 95 ? '1-2' : pctOfMax >= 90 ? '3-4' : pctOfMax >= 85 ? '5-6' : pctOfMax >= 80 ? '7-8' : pctOfMax >= 75 ? '9-10' : pctOfMax >= 70 ? '11-12' : '12-15',
  }));

  const selectExercise = (name: string) => {
    setExercise(name);
    const perf = lastExercisePerformance(data, name);
    if (perf) {
      setWeight(String(perf.weight));
      setReps(String(perf.reps || 5));
    }
  };

  return (
    <div className="card card-pad">
      <SectionHead title="Progresión de cargas" subtitle="1RM estimado y tabla de trabajo." action={<TrendingUp size={15} className="text-accent" />} />
      <div className="space-y-2">
        <Field label="Ejercicio" hint={last ? `Último registro: ${fmtNum(last.weight)} kg × ${last.reps} (${last.date})` : 'Elegí un ejercicio para precargar tu último peso.'}>
          <Select value={exercise} onChange={(e) => selectExercise(e.target.value)}>
            <option value="">Sin ejercicio</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Peso (kg)">
            <Input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={last ? String(last.weight) : '60'} />
          </Field>
          <Field label="Reps realizadas">
            <Input type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
        <ProgressRing value={Math.min(100, (r / 12) * 100)} size={54} stroke={4} label={<span className="text-[0.68rem] font-semibold">{r}</span>} />
        <div>
          <p className="text-[0.64rem] uppercase tracking-[0.08em] text-faint">1RM estimado (Epley)</p>
          <p className="metric text-[1.45rem] text-accent">{oneRm ? `${fmtNum(oneRm, 1)} kg` : '—'}</p>
          <p className="text-[0.63rem] text-faint">Estimación, no una marca real.</p>
        </div>
      </div>

      {oneRm > 0 ? (
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <table className="table-base">
              <thead><tr><th>% 1RM</th><th className="text-right">Peso</th><th className="text-right">Reps aprox.</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.pct}>
                    <td className="num text-faint">{row.pct}%</td>
                    <td className="num text-right font-medium text-ink">{fmtNum(row.kg, 1)} kg</td>
                    <td className="text-right text-faint">{row.reps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-2 text-[0.7rem] leading-snug text-ink-soft">
            <Dumbbell size={11} className="mr-1 inline text-accent" />
            Próxima sesión: probá <span className="font-semibold">{fmtNum(round(oneRm * 0.75 / 2.5) * 2.5, 1)} kg</span> a 8-10 reps, o sumá 2,5 kg si completaste todas las series cómodo.
          </div>
        </>
      ) : null}

      {prs.length ? <p className="mt-2 text-[0.65rem] text-faint">{prs.length} ejercicios con historial. El récord más alto: {prs[0].name} · {fmtNum(prs[0].bestWeight)} kg.</p> : null}
    </div>
  );
}

void Calculator; void Meter;
