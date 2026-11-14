import { useId } from 'react';
import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn, fmtNum } from '@/lib/utils';
import { Card } from '@/components/ui/Primitives';

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
  unit?: string;
  /** Eje derecho para series de otra escala. */
  axis?: 'left' | 'right';
  dashed?: boolean;
}

type TooltipEntry = { name?: string; value?: number | string; color?: string; dataKey?: string; payload?: Record<string, unknown> };

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (v: string | number) => string;
  valueFormatter?: (v: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-panel/95 px-3 py-2 shadow-xl backdrop-blur-md">
      <p className="mb-1 text-[0.66rem] font-medium uppercase tracking-[0.08em] text-faint">
        {labelFormatter ? labelFormatter(label ?? '') : label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[0.72rem] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="num text-[0.76rem] font-semibold text-ink">
              {typeof entry.value === 'number'
                ? valueFormatter
                  ? valueFormatter(entry.value, String(entry.dataKey))
                  : fmtNum(entry.value, 1)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  empty,
  emptyHint,
  className,
  height = 230,
  legend,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  empty?: boolean;
  emptyHint?: ReactNode;
  className?: string;
  height?: number;
  legend?: ReactNode;
}) {
  return (
    <Card className={cn('card-pad flex flex-col', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.87rem] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[0.74rem] leading-snug text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 text-center" style={{ height }}>
          <p className="text-[0.8rem] font-medium text-ink-soft">Sin datos todavía</p>
          <p className="mt-1 max-w-[22rem] text-[0.73rem] leading-relaxed text-faint">
            {emptyHint ?? 'Los registros que cargues van a aparecer acá automáticamente.'}
          </p>
        </div>
      ) : (
        <div className="-ml-2" style={{ height }}>
          {children}
        </div>
      )}
      {legend && !empty ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div> : null}
    </Card>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[0.71rem] text-muted">
          <span
            className="h-[3px] w-3.5 rounded-full"
            style={{ background: it.dashed ? `repeating-linear-gradient(90deg, ${it.color} 0 3px, transparent 3px 6px)` : it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function TrendChart<T extends object>({
  data,
  xKey,
  series,
  kind = 'area',
  height = 230,
  xFormatter,
  valueFormatter,
  yTickFormatter,
  showY = true,
  reference,
  domain,
}: {
  data: T[];
  xKey: string;
  series: SeriesDef[];
  kind?: 'area' | 'line' | 'bar';
  height?: number;
  xFormatter?: (v: string | number) => string;
  valueFormatter?: (v: number, key: string) => string;
  yTickFormatter?: (v: number) => string;
  showY?: boolean;
  reference?: { value: number; label?: string };
  domain?: [number | 'auto', number | 'auto'];
}) {
  const gid = useId().replace(/[:]/g, '');
  const axes = series.some((s) => s.axis === 'right');
  const shared = {
    data,
    margin: { top: 8, right: axes ? 6 : 10, left: -6, bottom: 0 },
  };
  const axisProps = {
    tickLine: false,
    axisLine: false,
    tick: { fill: 'var(--faint)', fontSize: 10.5 },
    tickMargin: 8,
  };
  const tooltip = (
    <Tooltip
      cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
      content={<ChartTooltip labelFormatter={(v) => (xFormatter ? xFormatter(v) : String(v))} valueFormatter={valueFormatter} />}
    />
  );

  const yAxis = showY ? (
    <YAxis
      {...axisProps}
      width={40}
      tickFormatter={(v) => (yTickFormatter ? yTickFormatter(Number(v)) : fmtNum(Number(v)))}
      domain={domain}
    />
  ) : null;

  if (kind === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart {...shared} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={(v) => (xFormatter ? xFormatter(v) : String(v))} minTickGap={18} />
          {yAxis}
          {reference ? <ReferenceLine y={reference.value} stroke="var(--line-strong)" strokeDasharray="4 4" /> : null}
          {tooltip}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? 'var(--accent)'} radius={[4, 4, 0, 0]} maxBarSize={30} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart {...shared}>
          <CartesianGrid strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={(v) => (xFormatter ? xFormatter(v) : String(v))} minTickGap={22} />
          {yAxis}
          {reference ? <ReferenceLine y={reference.value} stroke="var(--line-strong)" strokeDasharray="4 4" /> : null}
          {tooltip}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? 'var(--accent)'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart {...shared}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? 'var(--accent)'} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color ?? 'var(--accent)'} stopOpacity={0.015} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={(v) => (xFormatter ? xFormatter(v) : String(v))} minTickGap={22} />
        {yAxis}
        {reference ? <ReferenceLine y={reference.value} stroke="var(--line-strong)" strokeDasharray="4 4" /> : null}
        {tooltip}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? 'var(--accent)'}
            strokeWidth={2}
            fill={`url(#${gid}-${i})`}
            connectNulls
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            strokeDasharray={s.dashed ? '5 4' : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  dataKey,
  color = 'var(--accent)',
  height = 34,
  positive = true,
}: {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  color?: string;
  height?: number;
  positive?: boolean;
}) {
  const gid = useId().replace(/[:]/g, '');
  if (!data.length) return <div style={{ height }} />;
  const stroke = positive ? color : 'var(--faint)';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={1.6} fill={`url(#spark-${gid})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 190,
  colors = ['var(--accent)', 'var(--info)', 'var(--warn)', 'var(--faint)', 'var(--danger)'],
  centerLabel,
  centerValue,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  colors?: string[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (!total) return null;
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtNum(v)} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="metric text-[1.15rem]">{centerValue ?? fmtNum(total)}</span>
        {centerLabel ? <span className="mt-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-faint">{centerLabel}</span> : null}
      </div>
    </div>
  );
}
