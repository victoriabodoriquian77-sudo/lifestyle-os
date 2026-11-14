import type { ReactNode } from 'react';
import { useRoute } from '@/lib/router';
import { Sidebar, MobileDrawer } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav, MoreSheet, QuickAdd } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { WorkoutMode } from '@/components/gym/WorkoutMode';
import { useReminders } from '@/hooks/useReminders';

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  useReminders();

  return (
    <div className="relative min-h-dvh">
      <Sidebar />
      <MobileDrawer />
      <div className="lg:pl-[248px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 md:px-6 md:pt-7 lg:px-8 lg:pb-12">
          <div key={route} className="animate-fade-up">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <MoreSheet />
      <QuickAdd />
      <CommandPalette />
      <WorkoutMode />
    </div>
  );
}
