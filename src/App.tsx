import { useEffect } from 'react';
import { useAppStore } from '@/store/store';
import { useRoute } from '@/lib/router';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/Modal';
import { ActionsProvider } from '@/components/actions/ActionsProvider';
import { Overview } from '@/pages/Overview';
import { Gym } from '@/pages/Gym';
import { Nutrition } from '@/pages/Nutrition';
import { Habits } from '@/pages/Habits';
import { Productivity } from '@/pages/Productivity';
import { Progress } from '@/pages/Progress';
import { Insights } from '@/pages/Insights';
import { Extensions } from '@/pages/Extensions';
import { Settings } from '@/pages/Settings';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-pulse-soft flex h-11 w-11 items-center justify-center rounded-2xl border border-accent-line bg-accent-soft text-[1rem] font-bold text-accent">P</div>
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-faint">Personal Lifestyle OS</p>
      </div>
    </div>
  );
}

function Router() {
  const route = useRoute();
  switch (route) {
    case 'gym': return <Gym />;
    case 'nutrition': return <Nutrition />;
    case 'habits': return <Habits />;
    case 'productivity': return <Productivity />;
    case 'progress': return <Progress />;
    case 'insights': return <Insights />;
    case 'extensions': return <Extensions />;
    case 'settings': return <Settings />;
    default: return <Overview />;
  }
}

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const theme = useAppStore((s) => s.data.settings.theme);
  const accent = useAppStore((s) => s.data.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    try { localStorage.setItem('plos-theme', theme); } catch { /* noop */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07080a' : '#f4f5f1');
  }, [theme, accent]);

  if (!hydrated) return <Splash />;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <ActionsProvider>
          <AppShell>
            <Router />
          </AppShell>
        </ActionsProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
