import { useMemo } from 'react';
import {
  Apple, Blocks, CalendarCheck2, Dumbbell, LayoutDashboard, ListChecks, Settings2, Sparkles, TrendingUp, Flame,
} from 'lucide-react';
import type { PageId } from '@/types';
import { navigate, useRoute } from '@/lib/router';
import { useAppStore } from '@/store/store';
import { useUI } from '@/store/ui';
import { habitStreak, workoutWeekStreak, dayHabitProgress } from '@/lib/metrics';
import { today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Primitives';

const GROUPS: Array<{ label: string; items: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> }> = [
  {
    label: 'Sistema',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'gym', label: 'Gym', icon: Dumbbell },
      { id: 'nutrition', label: 'Nutrition', icon: Apple },
      { id: 'habits', label: 'Habits', icon: ListChecks },
      { id: 'productivity', label: 'Productivity', icon: CalendarCheck2 },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { id: 'progress', label: 'Progress', icon: TrendingUp },
      { id: 'insights', label: 'Smart Insights', icon: Sparkles },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { id: 'extensions', label: 'Extensions', icon: Blocks },
      { id: 'settings', label: 'Settings', icon: Settings2 },
    ],
  },
];

export function Sidebar() {
  const route = useRoute() as PageId;
  const setSidebar = useUI((s) => s.setSidebar);
  const data = useAppStore((s) => s.data);

  const streak = useMemo(() => {
    const t = today();
    const workouts = workoutWeekStreak(data, t);
    const habitBest = data.habits.filter((h) => !h.archived).reduce((best, h) => Math.max(best, habitStreak(data, h, t)), 0);
    return { workouts, habitBest };
  }, [data]);

  const progress = useMemo(() => dayHabitProgress(data, today()), [data]);

  const go = (id: PageId) => {
    navigate(id);
    setSidebar(false);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl lg:flex">
      <div className="flex h-[68px] items-center gap-2.5 border-b border-line px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft">
          <span className="text-[0.72rem] font-bold tracking-tight text-accent">P</span>
        </div>
        <div className="leading-none">
          <p className="text-[0.78rem] font-semibold tracking-[-0.01em] text-ink">Personal Lifestyle</p>
          <p className="mt-1 text-[0.58rem] font-medium uppercase tracking-[0.22em] text-faint">OS · v1.0</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3.5 py-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-faint/80">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button key={item.id} className="nav-item" data-active={active} onClick={() => go(item.id)}>
                    <Icon size={16} strokeWidth={active ? 2 : 1.7} />
                    <span className="flex-1">{item.label}</span>
                    {item.id === 'habits' && progress.scheduled > 0 ? (
                      <span className={cn('num text-[0.65rem] font-medium', progress.pct >= 100 ? 'text-accent' : 'text-faint')}>
                        {Math.round(progress.pct)}%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3.5 pb-3">
        <div className="rounded-xl border border-line bg-panel-2/70 p-3">
          <div className="flex items-center gap-2">
            <Flame size={13} className="text-accent" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">Racha</p>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="metric text-[1.3rem] text-ink">{streak.workouts}</p>
              <p className="text-[0.64rem] text-faint">semana{streak.workouts === 1 ? '' : 's'} entrenando</p>
            </div>
            <div className="text-right">
              <p className="num text-[0.82rem] font-semibold text-accent">{streak.habitBest}</p>
              <p className="text-[0.64rem] text-faint">días de hábito</p>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => go('settings')} className="flex items-center gap-2.5 border-t border-line px-4 py-3 text-left transition-colors hover:bg-panel-2">
        <Avatar name={data.profile.name || 'PL'} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.78rem] font-medium text-ink">{data.profile.name || 'Tu perfil'}</p>
          <p className="truncate text-[0.66rem] text-faint">{data.profile.focus || 'Configurá tu foco'}</p>
        </div>
        <Settings2 size={14} className="shrink-0 text-faint" />
      </button>
    </aside>
  );
}

export function MobileDrawer() {
  const open = useUI((s) => s.sidebarOpen);
  const setOpen = useUI((s) => s.setSidebar);
  const route = useRoute();
  const data = useAppStore((s) => s.data);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="animate-pop absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-line bg-bg">
        <div className="flex h-[64px] items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-[0.72rem] font-bold text-accent">P</div>
            <p className="text-[0.8rem] font-semibold text-ink">Personal Lifestyle OS</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-faint/80">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className="nav-item" data-active={route === item.id} onClick={() => { navigate(item.id); setOpen(false); }}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4 text-[0.72rem] text-faint">
          {data.profile.name || 'Perfil sin configurar'}
        </div>
      </div>
    </div>
  );
}
