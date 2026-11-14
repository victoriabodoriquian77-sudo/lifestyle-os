import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  preventClose?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
      first?.focus({ preventScroll: true });
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, preventClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Diálogo'}>
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={() => { if (!preventClose) onClose(); }}
      />
      <div
        ref={panelRef}
        className={cn(
          'animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line-strong bg-panel shadow-2xl',
          'rounded-t-[20px] sm:rounded-[18px]',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[0.98rem] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
            {description ? <p className="mt-0.5 text-[0.78rem] leading-snug text-muted">{description}</p> : null}
          </div>
          <button className="btn btn-ghost btn-icon -mr-1 -mt-1 shrink-0" onClick={onClose} aria-label="Cerrar" disabled={preventClose}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-panel-2/50 px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ confirm */

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.opts.title ?? ''}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => close(false)}>{state?.opts.cancelLabel ?? 'Cancelar'}</button>
            <button
              className={cn('btn', state?.opts.tone === 'danger' ? 'btn-danger' : 'btn-primary')}
              onClick={() => close(true)}
            >
              {state?.opts.confirmLabel ?? 'Confirmar'}
            </button>
          </>
        }
      >
        <div className="text-[0.83rem] leading-relaxed text-muted">{state?.opts.message ?? 'Esta acción no se puede deshacer.'}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
};
