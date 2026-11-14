import { useMemo } from 'react';
import {
  ArrowRight, Apple, Brain, Dumbbell, Info, ListChecks, Moon, ShieldCheck, Sparkles, Target,
} from 'lucide-react';
import { useAppStore } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { navigate } from '@/lib/router';
import { Badge, Card, EmptyState, Meter, ProgressRing, SectionHead } from '@/components/ui/Primitives';
import { buildInsights, loggingCoverage } from '@/lib/insights';
import { dayHabitProgress, dayNutrition, taskStats, waterDay } from '@/lib/metrics';
import { addDays, today } from '@/lib/date';
import { cn, fmtMl, pct } from '@/lib/utils';

const TONE_META = {
  positive: { label: 'A favor', color: 'var(--accent)', chip: 'chip-accent' as const },
  attention: { label: 'Atención', color: 'var(--warn)', chip: 'chip-warn' as const },
  neutral: { label: 'Observación', color: 'var(--faint)', chip: 'chip-outline' as const },
};

export function Insights() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const t = today();
  const insights = useMemo(() => buildInsights(data), [data]);
  const coverage30 = useMemo(() => loggingCoverage(data, addDays(t, -29), t), [data, t]);
  const coverage7 = useMemo(() => loggingCoverage(data, addDays(t, -6), t), [data, t]);

  const marks30 = data.habitLogs.filter((l) => l.date >= addDays(t, -29)).length;
  const meals30 = data.meals.filter((m) => m.date >= addDays(t, -29)).length;
  const sessions30 = data.sessions.filter((s) => s.status === 'completed' && s.date >= addDays(t, -29)).length;
  const checkins30 = data.checkins.filter((c) => c.date >= addDays(t, -29)).length;
  const tasks30 = taskStats(data, addDays(t, -29), t).completed;

  const coverageItems = [
    { label: 'Entrenamiento', value: sessions30, goal: 8, unit: 'sesiones', icon: <Dumbbell size={13} />, route: 'gym' as const, hint: 'Registrá sesiones para detectar progreso y estancamientos.' },
    { label: 'Hábitos', value: marks30, goal: 60, unit: 'marcas', icon: <ListChecks size={13} />, route: 'habits' as const, hint: 'Con dos semanas de marcas ya se ven patrones.' },
    { label: 'Productividad', value: tasks30, goal: 20, unit: 'tareas', icon: <Target size={13} />, route: 'productivity' as const, hint: 'Completar tareas alimenta los insights de postergación.' },
    { label: 'Nutrición', value: meals30, goal: 20, unit: 'comidas', icon: <Apple size={13} />, route: 'nutrition' as const, hint: 'Anotá solo cuando te sirva revisar cómo venís.' },
    { label: 'Bienestar', value: checkins30, goal: 10, unit: 'check-ins', icon: <Moon size={13} />, route: 'progress' as const, hint: 'Sueño y energía explican mucho de tu rendimiento.' },
  ];

  const enoughData = marks30 + sessions30 + tasks30 + meals30 + checkins30 > 0;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Análisis inteligente</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Lo que tus datos dicen de vos.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Observaciones generadas con reglas sobre tus registros reales. Sin diagnósticos ni metas inventadas.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-2.5">
          <ProgressRing value={coverage30} size={54} stroke={4} label={<span className="text-[0.68rem] font-semibold">{Math.round(coverage30)}%</span>} />
          <div>
            <p className="text-[0.7rem] font-medium text-muted">Cobertura de registro</p>
            <p className="text-[0.68rem] text-faint">Últimos 30 días · {Math.round(coverage7)}% esta semana</p>
          </div>
        </div>
      </section>

      {!enoughData ? (
        <Card className="card-pad">
          <EmptyState
            icon={<Brain size={20} />}
            title="Todavía no hay patrones que analizar"
            description="Los insights nacen de tus registros. Empezá por lo más simple: marcá un hábito hoy, registrá una comida o completá un entrenamiento. En pocos días vas a ver observaciones reales."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => navigate('habits')}>Marcar hábitos</button>
                <button className="btn btn-secondary btn-sm" onClick={() => actions.startWorkout()}>Entrenar</button>
                <button className="btn btn-secondary btn-sm" onClick={() => actions.openCheckin(t)}>Check-in</button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => {
            const meta = TONE_META[insight.tone];
            return (
              <Card key={insight.id} className="card-pad">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="dot" style={{ background: meta.color }} />
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-faint">{insight.area}</span>
                  </div>
                  <span className={meta.chip}>{meta.label}</span>
                </div>
                <h3 className="mt-1.5 text-[0.88rem] font-semibold leading-snug text-ink">{insight.title}</h3>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">{insight.body}</p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="card-pad">
          <SectionHead title="Qué alimenta tus insights" subtitle="Más registro no significa más presión: significa mejores observaciones." />
          <div className="space-y-3">
            {coverageItems.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-soft">{item.icon} {item.label}</span>
                  <span className="num text-[0.68rem] text-faint">{item.value} {item.unit} · 30 d</span>
                </div>
                <Meter value={pct(item.value, item.goal)} height={4} tone={item.value >= item.goal ? 'accent' : 'muted'} />
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-[0.64rem] text-faint">{item.hint}</span>
                  <button className="flex shrink-0 items-center gap-0.5 text-[0.64rem] text-muted hover:text-accent" onClick={() => navigate(item.route)}>ir <ArrowRight size={10} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="card-pad">
          <SectionHead title="Cómo funciona" subtitle="Transparencia total sobre las reglas." action={<Badge tone="outline"><ShieldCheck size={10} /> Sin IA generativa</Badge>} />
          <div className="space-y-2.5 text-[0.75rem] leading-relaxed text-muted">
            <p className="flex gap-2"><Sparkles size={13} className="mt-0.5 shrink-0 text-accent" /> Cada insight compara períodos equivalentes (por ejemplo, 28 días contra los 28 anteriores) y solo aparece cuando hay un mínimo de registros.</p>
            <p className="flex gap-2"><Dumbbell size={13} className="mt-0.5 shrink-0 text-accent" /> Las progresiones usan el 1RM estimado (Epley) y el peso máximo por sesión. Los estancamientos se detectan con tres sesiones consecutivas sin cambios.</p>
            <p className="flex gap-2"><ListChecks size={13} className="mt-0.5 shrink-0 text-accent" /> La consistencia de hábitos respeta la frecuencia configurada: un hábito semanal no cuenta como incumplido los días que no toca.</p>
            <p className="flex gap-2"><Moon size={13} className="mt-0.5 shrink-0 text-accent" /> Las observaciones de descanso son orientativas y jamás indican diagnósticos, dietas restrictivas ni entrenamientos excesivos.</p>
            <p className="flex gap-2"><Info size={13} className="mt-0.5 shrink-0 text-faint" /> Si un dato no existe, no se estima ni se rellena con valores ficticios.</p>
          </div>
          <div className="mt-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-faint">Tu estado de hoy</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[0.72rem]">
              <span className="text-muted">Hábitos: <span className="num text-ink-soft">{dayHabitProgress(data, t).done}/{dayHabitProgress(data, t).scheduled}</span></span>
              <span className="text-muted">Agua: <span className="num text-ink-soft">{fmtMl(waterDay(data, t), data.profile.units)}</span></span>
              <span className="text-muted">Comidas: <span className="num text-ink-soft">{dayNutrition(data, t).meals}</span></span>
              <span className="text-muted">Tareas vencidas: <span className={cn('num', taskStats(data, addDays(t, -29), t).overdue ? 'text-danger' : 'text-ink-soft')}>{taskStats(data, addDays(t, -29), t).overdue}</span></span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
