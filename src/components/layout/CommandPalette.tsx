import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Blocks, Check, CornerDownLeft, Dumbbell, LayoutDashboard, ListChecks, NotebookPen,
  Plus, Search, Settings2, Sparkles, TrendingUp, CalendarCheck2, Apple, Scale,
} from 'lucide-react';
import type { PageId } from '@/types';
import { navigate } from '@/lib/router';
import { useUI } from '@/store/ui';
import { useAppStore } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { cn } from '@/lib/utils';
import { today } from '@/lib/date';

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: typeof LayoutDashboard;
  run: () => void;
}

const PAGE_ITEMS: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'nutrition', label: 'Nutrition', icon: Apple },
  { id: 'habits', label: 'Habits', icon: ListChecks },
  { id: 'productivity', label: 'Productivity', icon: CalendarCheck2 },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'insights', label: 'Smart Insights', icon: Sparkles },
  { id: 'extensions', label: 'Extensions', icon: Blocks },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommand);
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const actions = useActions();
  const data = useAppStore((s) => s.data);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUI.getState().commandOpen);
      }
      if (e.key === 'Escape' && useUI.getState().commandOpen) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const allItems = useMemo<Item[]>(() => {
    const close = () => setOpen(false);
    const items: Item[] = [];

    items.push(
      { id: 'a-task', label: 'Nueva tarea', hint: 'Crear y priorizar', group: 'Acciones', icon: Check, run: () => { close(); actions.openTask(); } },
      { id: 'a-meal', label: 'Registrar comida', hint: 'Con macros opcionales', group: 'Acciones', icon: Apple, run: () => { close(); actions.openMeal({ date: today() }); } },
      { id: 'a-habit', label: 'Nuevo hábito', hint: 'Definir frecuencia', group: 'Acciones', icon: ListChecks, run: () => { close(); actions.openHabit(); } },
      { id: 'a-workout', label: 'Empezar entrenamiento', hint: 'Abrir modo entrenamiento', group: 'Acciones', icon: Dumbbell, run: () => { close(); actions.startWorkout(); } },
      { id: 'a-note', label: 'Nueva nota', hint: 'Guardar una idea', group: 'Acciones', icon: NotebookPen, run: () => { close(); actions.openNote(); } },
      { id: 'a-checkin', label: 'Check-in de bienestar', hint: 'Sueño, energía, ánimo', group: 'Acciones', icon: Sparkles, run: () => { close(); actions.openCheckin(today()); } },
      { id: 'a-weighin', label: 'Pesaje semanal', hint: 'Registrar o actualizar el peso de esta semana', group: 'Acciones', icon: Scale, run: () => { close(); actions.openWeighIn(); } },
      { id: 'a-quick', label: 'Abrir menú rápido', hint: 'Todo lo que podés crear', group: 'Acciones', icon: Plus, run: () => { close(); setQuickAdd(true); } },
    );

    PAGE_ITEMS.forEach((p) =>
      items.push({ id: `p-${p.id}`, label: p.label, hint: 'Sección', group: 'Ir a', icon: p.icon, run: () => { close(); navigate(p.id); } }),
    );

    data.routines.slice(0, 8).forEach((r) =>
      items.push({
        id: `r-${r.id}`, label: r.name, hint: `${r.exercises.length} ejercicios`, group: 'Rutinas', icon: Dumbbell,
        run: () => { close(); navigate('gym'); actions.openRoutine(r); },
      }),
    );

    data.tasks.filter((t) => t.status !== 'done').slice(0, 12).forEach((t) =>
      items.push({
        id: `t-${t.id}`, label: t.title, hint: t.dueDate ? `vence ${t.dueDate}` : 'sin fecha', group: 'Tareas', icon: Check,
        run: () => { close(); actions.openTask(t); },
      }),
    );

    data.notes.slice(0, 8).forEach((n) =>
      items.push({ id: `n-${n.id}`, label: n.title, hint: 'Nota', group: 'Notas', icon: NotebookPen, run: () => { close(); actions.openNote(n); } }),
    );

    return items;
  }, [actions, data, setOpen, setQuickAdd]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 14);
    return allItems
      .filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
      .slice(0, 14);
  }, [allItems, query]);

  useEffect(() => setCursor(0), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    results.forEach((r) => {
      map.set(r.group, [...(map.get(r.group) ?? []), r]);
    });
    return [...map.entries()];
  }, [results]);

  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[cursor]?.run();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let index = -1;
  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={() => setOpen(false)} />
      <div className="animate-pop relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar secciones, tareas, rutinas o acciones…"
            className="w-full bg-transparent text-[0.87rem] text-ink placeholder:text-faint focus:outline-none"
          />
          <kbd className="kbd shrink-0">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-[0.8rem] text-faint">Nada coincide con “{query}”.</p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-faint/80">{group}</p>
                {items.map((item) => {
                  index += 1;
                  const idx = index;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={item.run}
                      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors', cursor === idx ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-panel-2')}
                    >
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', cursor === idx ? 'border-accent-line text-accent' : 'border-line text-faint')}>
                        <Icon size={13} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.81rem] font-medium">{item.label}</span>
                        {item.hint ? <span className="block truncate text-[0.67rem] text-faint">{item.hint}</span> : null}
                      </span>
                      {cursor === idx ? <CornerDownLeft size={13} className="shrink-0 text-faint" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line bg-panel-2/60 px-3 py-2 text-[0.66rem] text-faint">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navegar</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> abrir <ArrowRight size={11} /></span>
        </div>
      </div>
    </div>
  );
}
