import { useMemo, useState } from 'react';
import {
  Apple, CalendarCheck2, Check, Dumbbell, Droplets, LayoutDashboard, ListChecks, MoreHorizontal,
  NotebookPen, Plus, Settings2, Sparkles, TrendingUp, Blocks, Scale, X,
} from 'lucide-react';
import type { PageId } from '@/types';
import { navigate, useRoute } from '@/lib/router';
import { useUI } from '@/store/ui';
import { mutateData } from '@/store/store';
import { addWater } from '@/lib/domain';
import { toast } from '@/components/ui/Toast';
import { useActions } from '@/components/actions/ActionsProvider';
import { cn, fmtMl } from '@/lib/utils';
import { useAppStore } from '@/store/store';
import { waterDay } from '@/lib/metrics';
import { today } from '@/lib/date';

const TABS: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'nutrition', label: 'Nutrition', icon: Apple },
  { id: 'habits', label: 'Habits', icon: ListChecks },
];

const MORE: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard; desc: string }> = [
  { id: 'productivity', label: 'Productivity', icon: CalendarCheck2, desc: 'Tareas, proyectos y foco' },
  { id: 'progress', label: 'Progress', icon: TrendingUp, desc: 'Estadísticas y evolución' },
  { id: 'insights', label: 'Smart Insights', icon: Sparkles, desc: 'Patrones de tus datos' },
  { id: 'extensions', label: 'Extensions', icon: Blocks, desc: 'Herramientas y accesos' },
  { id: 'settings', label: 'Settings', icon: Settings2, desc: 'Perfil, datos y respaldo' },
];

export function MobileNav() {
  const route = useRoute();
  const setMore = useUI((s) => s.setMore);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="flex items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = route === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={cn('flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors', active ? 'text-accent' : 'text-faint')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.1 : 1.7} />
              <span className="text-[0.6rem] font-medium">{tab.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMore(true)} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors', MORE.some((m) => m.id === route) ? 'text-accent' : 'text-faint')}>
          <MoreHorizontal size={19} />
          <span className="text-[0.6rem] font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
}

export function MoreSheet() {
  const open = useUI((s) => s.moreOpen);
  const setOpen = useUI((s) => s.setMore);
  const route = useRoute();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="animate-pop absolute inset-x-0 bottom-0 rounded-t-[22px] border-t border-line-strong bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-label="Más secciones">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong" />
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-faint">Más secciones</p>
          <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={14} /></button>
        </div>
        <div className="space-y-1">
          {MORE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { navigate(item.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left', route === item.id ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-panel-2')}
              >
                <Icon size={17} className={route === item.id ? 'text-accent' : 'text-muted'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.84rem] font-medium text-ink">{item.label}</span>
                  <span className="block text-[0.7rem] text-faint">{item.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function QuickAdd() {
  const open = useUI((s) => s.quickAddOpen);
  const setOpen = useUI((s) => s.setQuickAdd);
  const actions = useActions();
  const data = useAppStore((s) => s.data);
  const water = useMemo(() => waterDay(data, today()), [data]);
  const [added, setAdded] = useState(false);

  const close = () => setOpen(false);

  const items = [
    { label: 'Tarea', icon: Check, hint: 'Qué tenés que hacer', run: () => actions.openTask() },
    { label: 'Comida', icon: Apple, hint: 'Registrar lo que comiste', run: () => actions.openMeal({ date: today() }) },
    { label: 'Hábito', icon: ListChecks, hint: 'Nuevo hábito a sostener', run: () => actions.openHabit() },
    { label: 'Entrenamiento', icon: Dumbbell, hint: 'Iniciar una sesión', run: () => actions.startWorkout() },
    { label: 'Pesaje', icon: Scale, hint: 'Peso de esta semana', run: () => actions.openWeighIn() },
    { label: 'Nota', icon: NotebookPen, hint: 'Idea o recordatorio', run: () => actions.openNote() },
  ];

  if (!open) {
    return (
      <div className="fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-line bg-accent text-[var(--accent-ink)] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] transition-transform hover:scale-105 active:scale-95"
          onClick={() => setOpen(true)}
          aria-label="Crear rápido"
        >
          <Plus size={21} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
      <div className="animate-pop absolute bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-4 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-panel p-2 shadow-2xl lg:bottom-auto lg:right-6 lg:top-[4.3rem]">
        <p className="px-2 py-1.5 text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-faint">Crear rápido</p>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => { item.run(); close(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-2 text-muted"><Icon size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8rem] font-medium text-ink">{item.label}</span>
                <span className="block text-[0.66rem] text-faint">{item.hint}</span>
              </span>
            </button>
          );
        })}
        <div className="my-1.5 divider" />
        <button
          onClick={() => {
            mutateData((d) => addWater(d, 250));
            setAdded(true);
            setTimeout(() => setAdded(false), 900);
            toast.success('+250 ml de agua', `Total de hoy: ${fmtMl(water + 250, 'metric')}`);
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-2 text-info"><Droplets size={14} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8rem] font-medium text-ink">{added ? 'Registrado' : 'Agua +250 ml'}</span>
            <span className="block text-[0.66rem] text-faint">Hoy: {fmtMl(water, 'metric')}</span>
          </span>
        </button>
        <button
          onClick={() => { actions.openCheckin(today()); close(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel-2 text-warn"><Sparkles size={14} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8rem] font-medium text-ink">Check-in de bienestar</span>
            <span className="block text-[0.66rem] text-faint">Sueño, energía y ánimo</span>
          </span>
        </button>
      </div>
    </div>
  );
}
