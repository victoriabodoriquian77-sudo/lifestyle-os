import { useEffect, useState } from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { PAGE_TITLES, useRoute } from '@/lib/router';
import { useUI } from '@/store/ui';
import { useAppStore } from '@/store/store';
import { fmtDateLong, today } from '@/lib/date';

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const fmtTimeClock = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function Topbar() {
  const route = useRoute();
  const now = useClock();
  const setSidebar = useUI((s) => s.setSidebar);
  const setCommand = useUI((s) => s.setCommand);
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const quickAddOpen = useUI((s) => s.quickAddOpen);
  const name = useAppStore((s) => s.data.profile.name);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="flex h-[64px] items-center gap-3 px-4 md:px-6 lg:px-8">
        <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setSidebar(true)} aria-label="Abrir menú">
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[1.02rem] font-semibold tracking-[-0.02em] text-ink">{PAGE_TITLES[route]}</h1>
            <span className="hidden h-1 w-1 rounded-full bg-faint/50 sm:block" />
            <p className="hidden truncate text-[0.74rem] text-faint sm:block">{fmtDateLong(today())}</p>
          </div>
          <p className="mt-0.5 truncate text-[0.68rem] text-faint lg:hidden">{name ? `Hola, ${name.split(' ')[0]}` : 'Personal Lifestyle OS'}</p>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-baseline gap-1.5 rounded-lg border border-line bg-panel-2/70 px-2.5 py-1.5">
            <span className="num text-[0.78rem] font-medium text-ink-soft">{fmtTimeClock(now)}</span>
            <span className="text-[0.62rem] uppercase tracking-[0.08em] text-faint">hoy</span>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/70 px-2.5 py-1.5 text-[0.74rem] text-faint transition-colors hover:border-line-strong hover:text-ink-soft"
            onClick={() => setCommand(true)}
          >
            <Search size={13} />
            <span className="pr-6">Buscar</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
        </div>

        <button className="btn btn-ghost btn-icon md:hidden" onClick={() => setCommand(true)} aria-label="Buscar">
          <Search size={17} />
        </button>

        <button
          className="btn btn-primary btn-sm hidden md:!min-h-[2.3rem] lg:inline-flex lg:px-3"
          onClick={() => setQuickAdd(!quickAddOpen)}
          aria-expanded={quickAddOpen}
          aria-label="Crear"
        >
          <Plus size={15} />
          <span className="hidden md:inline">Crear</span>
        </button>
      </div>
    </header>
  );
}
