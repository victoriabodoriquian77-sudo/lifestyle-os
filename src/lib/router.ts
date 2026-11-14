import { useSyncExternalStore } from 'react';
import type { PageId } from '@/types';

const PAGES: PageId[] = [
  'overview', 'gym', 'nutrition', 'habits', 'productivity', 'progress', 'insights', 'extensions', 'settings',
];

const parse = (): PageId => {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0];
  return (PAGES.includes(raw as PageId) ? raw : 'overview') as PageId;
};

let current: PageId = typeof window !== 'undefined' ? parse() : 'overview';
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const navigate = (page: PageId): void => {
  if (page === current) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  current = page;
  window.location.hash = `#/${page}`;
  emit();
};

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const next = parse();
    if (next !== current) {
      current = next;
      emit();
    }
  });
}

export const useRoute = (): PageId =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => 'overview' as PageId,
  );

export const PAGE_TITLES: Record<PageId, string> = {
  overview: 'Overview',
  gym: 'Gym',
  nutrition: 'Nutrition',
  habits: 'Habits',
  productivity: 'Productivity',
  progress: 'Progress',
  insights: 'Smart Insights',
  extensions: 'Extensions',
  settings: 'Settings',
};
