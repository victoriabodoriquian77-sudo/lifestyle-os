import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------- card */

export function Card({ className, children, hover = true, ...rest }: ComponentProps<'div'> & { hover?: boolean }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="text-[0.98rem] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[0.78rem] leading-snug text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- stat */

export function Stat({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'neutral',
  className,
  onClick,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger';
  className?: string;
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div
      className={cn('card card-pad group', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.72rem] font-medium text-muted">{label}</p>
        {icon ? <span className="text-faint transition-colors group-hover:text-muted">{icon}</span> : null}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={cn('metric text-[1.65rem]', toneClass)}>{value}</span>
        {unit ? <span className="text-[0.72rem] font-medium text-faint">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 text-[0.72rem] leading-snug text-faint">{hint}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- progress ring */

export function ProgressRing({
  value,
  size = 92,
  stroke = 7,
  label,
  sublabel,
  tone = 'accent',
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
  tone?: 'accent' | 'warn' | 'danger' | 'info';
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = tone === 'accent' ? 'var(--accent)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--info)';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="metric" style={{ fontSize: size * 0.26 }}>{label ?? Math.round(clamped)}</span>
        {sublabel ? <span className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-faint">{sublabel}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ progress */

export function Meter({
  value,
  tone = 'accent',
  className,
  height = 6,
}: {
  value: number;
  tone?: 'accent' | 'warn' | 'danger' | 'info' | 'muted';
  className?: string;
  height?: number;
}) {
  const color =
    tone === 'accent' ? 'var(--accent)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : tone === 'info' ? 'var(--info)' : 'var(--faint)';
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-[var(--ring-track)]', className)} style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color, transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ empty */

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line text-center', compact ? 'px-4 py-8' : 'px-6 py-12')}>
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel-2 text-faint">{icon}</div>
      ) : null}
      <p className="text-[0.87rem] font-medium text-ink-soft">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-[0.78rem] leading-relaxed text-faint">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-panel-2 p-0.5', className)}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-[8px] font-medium transition-all',
            size === 'sm' ? 'px-2 py-1 text-[0.7rem]' : 'px-2.5 py-1.5 text-[0.75rem]',
            value === opt.value ? 'bg-panel-3 text-ink shadow-sm' : 'text-muted hover:text-ink-soft',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ toggle */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40',
        checked ? 'border-transparent bg-accent' : 'border-line-strong bg-panel-3',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-white shadow transition-all duration-200',
          checked ? 'left-[19px]' : 'left-[2px]',
        )}
        style={{ background: checked ? 'var(--accent-ink)' : 'var(--faint)' }}
      />
    </button>
  );
  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.82rem] font-medium text-ink-soft">{label}</p>
        {description ? <p className="mt-0.5 text-[0.74rem] leading-snug text-faint">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}

/* ------------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  error,
  children,
  required,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  const autoId = useId();
  const labelId = `${autoId}-label`;
  return (
    <div className={cn('min-w-0', className)} role={label ? 'group' : undefined} aria-labelledby={label ? labelId : undefined}>
      {label ? (
        <label className="label" htmlFor={htmlFor} id={labelId}>
          {label}
          {required ? <span className="ml-0.5 text-accent">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-[0.72rem] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[0.71rem] leading-snug text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input className={cn('input', invalid && 'input-invalid', className)} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea className={cn('textarea', invalid && 'input-invalid', className)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <select className={cn('select', invalid && 'input-invalid', className)} {...rest}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------- badge */

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'danger' | 'info' | 'outline';
  className?: string;
}) {
  const map = {
    default: 'chip',
    accent: 'chip chip-accent',
    warn: 'chip chip-warn',
    danger: 'chip chip-danger',
    info: 'chip chip-info',
    outline: 'chip chip-outline',
  } as const;
  return <span className={cn(map[tone], className)}>{children}</span>;
}

/* ------------------------------------------------------------------ avatar */

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-soft font-semibold text-accent', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || '·'}
    </div>
  );
}

/* ------------------------------------------------------------- inline hint */

export function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-[0.73rem] leading-relaxed text-muted">{children}</p>;
}
