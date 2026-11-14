import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { uid } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  push: (tone: ToastTone, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'text-ok',
  error: 'text-danger',
  warning: 'text-warn',
  info: 'text-info',
};

const toastBus: { push: ToastApi['push'] } = { push: () => {} };

/** API imperativa (para código fuera de componentes: temporizadores, guardados). */
export const toast: ToastApi = {
  push: (tone, title, description) => toastBus.push(tone, title, description),
  success: (title, description) => toastBus.push('success', title, description),
  error: (title, description) => toastBus.push('error', title, description),
  info: (title, description) => toastBus.push('info', title, description),
  warning: (title, description) => toastBus.push('warning', title, description),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = uid('toast');
      setItems((prev) => [...prev.slice(-3), { id, tone, title, description }]);
      timers.current.set(id, setTimeout(() => remove(id), 4200));
    },
    [remove],
  );

  useEffect(() => {
    toastBus.push = push;
    return () => { toastBus.push = () => {}; };
  }, [push]);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d),
      info: (t, d) => push('info', t, d),
      warning: (t, d) => push('warning', t, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-20 right-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-6 md:right-6" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              className="animate-pop card flex items-start gap-3 px-3.5 py-3 shadow-2xl backdrop-blur-xl"
              role="status"
            >
              <Icon size={17} className={TONE_CLASS[item.tone]} strokeWidth={1.9} />
              <div className="min-w-0 flex-1">
                <p className="text-[0.82rem] font-medium leading-tight text-ink">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-[0.75rem] leading-snug text-muted">{item.description}</p> : null}
              </div>
              <button className="btn btn-ghost btn-icon !h-6 !w-6 shrink-0" onClick={() => remove(item.id)} aria-label="Cerrar">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
};
