import { useMemo, useState } from 'react';
import {
  Apple, ChevronLeft, ChevronRight, Droplets, Minus, Pencil, Plus, Salad, Sparkles, Star, Trash2, Utensils,
} from 'lucide-react';
import type { Meal, MealCategory } from '@/types';
import { MEAL_CATEGORIES } from '@/types';
import { useAppStore, mutateData } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { useConfirm } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge, Card, EmptyState, Field, Input, Meter, SectionHead, Segmented } from '@/components/ui/Primitives';
import { ChartCard, TrendChart } from '@/components/charts/Charts';
import { addWater, newMeal, subtractWater } from '@/lib/domain';
import {
  dayNutrition, mealTotals, nutritionSeries, waterDay, nutritionSeries as series,
} from '@/lib/metrics';
import { addDays, fmtDateLong, fmtDateNumeric, fmtDateShort, today, nowTime, friendlyDay } from '@/lib/date';
import { cn, fmtMl, fmtNum, pct, sum, uid } from '@/lib/utils';
import { navigate } from '@/lib/router';

type Tab = 'dia' | 'favoritas' | 'historial';
type Range = '7' | '30' | '90';

const categoryForTime = (): MealCategory => {
  const h = new Date().getHours();
  if (h < 11) return 'Desayuno';
  if (h < 16) return 'Almuerzo';
  if (h < 19) return 'Merienda';
  return 'Cena';
};

const CATEGORY_ICONS: Record<MealCategory, string> = {
  Desayuno: '☀️', Almuerzo: '🍽️', Merienda: '🫖', Cena: '🌙', Snacks: '🥜',
};

export function Nutrition() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('dia');
  const [date, setDate] = useState(today());
  const [range, setRange] = useState<Range>('30');
  const [customWater, setCustomWater] = useState('');

  const meals = useMemo(
    () => data.meals.filter((m) => m.date === date).sort((a, b) => (a.time < b.time ? -1 : 1)),
    [data.meals, date],
  );
  const totals = useMemo(() => dayNutrition(data, date), [data, date]);
  const water = useMemo(() => waterDay(data, date), [data, date]);
  const goals = data.settings.nutritionGoals;
  const hasGoals = Object.values(goals).some((v) => typeof v === 'number' && v > 0);
  const isToday = date === today();

  const days = Number(range);
  const rangeFrom = addDays(today(), -(days - 1));
  const chart = useMemo(() => nutritionSeries(data, rangeFrom, today()), [data, rangeFrom]);
  const chartData = chart.map((p) => ({ ...p, date: p.date })).filter((p) => p.meals > 0);

  const recentDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today(), -i)).map((d) => ({ date: d, ...dayNutrition(data, d), water: waterDay(data, d) })),
    [data],
  );

  const logTemplate = (templateId: string) => {
    const tpl = data.templates.find((x) => x.id === templateId);
    if (!tpl) return;
    mutateData((d) => {
      d.meals.push(newMeal({
        category: categoryForTime(),
        date: today(),
        time: nowTime(),
        items: tpl.items.map((i) => ({ ...i, id: uid('food') })),
        notes: tpl.kind === 'recipe' ? `Receta: ${tpl.name}` : `Favorita: ${tpl.name}`,
      }));
    });
    toast.success('Comida registrada', tpl.name);
  };

  const byCategory = MEAL_CATEGORIES.map((cat) => ({ cat, meals: meals.filter((m) => m.category === cat) })).filter((g) => g.meals.length);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Registro de alimentación</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Comer bien, sin obsesionarse.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            El registro es opcional. Sirve para ver patrones, sostener una alimentación variada y, si querés, seguir tus metas calóricas y de macros sin convertirlo en una obsesión.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => actions.openTemplate('recipe')}><Salad size={14} /> Nueva receta</button>
          <button className="btn btn-primary" onClick={() => actions.openMeal({ date, category: categoryForTime() })}><Plus size={14} /> Registrar comida</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NutrientCard label={goals.kcal ? 'Calorías' : 'Calorías registradas'} value={fmtNum(totals.kcal)} current={totals.kcal} goal={goals.kcal} unit="kcal" hint={`${totals.meals} comidas`} icon={<Utensils size={14} />} />
        <NutrientCard label="Proteína" value={fmtNum(totals.protein)} current={totals.protein} goal={goals.protein} unit="g" hint="del total registrado" icon={<Apple size={14} />} />
        <NutrientCard label="Carbohidratos" value={fmtNum(totals.carbs)} current={totals.carbs} goal={goals.carbs} unit="g" hint="del total registrado" icon={<Salad size={14} />} />
        <NutrientCard label="Grasas" value={fmtNum(totals.fat)} current={totals.fat} goal={goals.fat} unit="g" hint="del total registrado" icon={<Sparkles size={14} />} />
      </section>

      <div className="-mt-1 flex justify-end">
        <button className="text-[0.65rem] text-faint transition-colors hover:text-accent" onClick={() => navigate('settings')}>
          {hasGoals ? 'Editar metas nutricionales' : 'Definir metas calóricas y macros'} →
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-icon" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior"><ChevronLeft size={16} /></button>
              <div className="text-center">
                <p className="text-[0.85rem] font-medium capitalize text-ink">{friendlyDay(date)}</p>
                <p className="text-[0.66rem] text-faint">{fmtDateLong(date)}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} aria-label="Día siguiente"><ChevronRight size={16} /></button>
              {!isToday ? <button className="btn btn-ghost btn-sm" onClick={() => setDate(today())}>Hoy</button> : null}
            </div>
            <Segmented
                value={tab}
                onChange={(v) => setTab(v)}
                options={[
                  { value: 'dia', label: 'Día' },
                  { value: 'favoritas', label: `Favoritas (${data.templates.length})` },
                  { value: 'historial', label: 'Historial' },
                ]}
              />
          </div>

          {tab === 'dia' ? (
            byCategory.length === 0 ? (
              <Card className="card-pad">
                <EmptyState
                  icon={<Utensils size={20} />}
                  title="Sin comidas registradas este día"
                  description="Podés anotar solo lo que te interese revisar: una comida, una colación o el día completo. No hay una forma correcta."
                  action={<button className="btn btn-primary btn-sm" onClick={() => actions.openMeal({ date, category: categoryForTime() })}><Plus size={13} /> Registrar comida</button>}
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {byCategory.map(({ cat, meals: group }) => {
                  const groupTotals = group.reduce((acc, m) => {
                    const t = mealTotals(m);
                    return { kcal: acc.kcal + t.kcal, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat };
                  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
                  return (
                    <Card key={cat} className="overflow-hidden">
                      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.9rem]">{CATEGORY_ICONS[cat]}</span>
                          <p className="text-[0.82rem] font-medium text-ink">{cat}</p>
                          <span className="text-[0.66rem] text-faint">{group.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="num text-[0.7rem] text-faint">{fmtNum(groupTotals.kcal)} kcal</span>
                          <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={() => actions.openMeal({ date, category: cat })} aria-label={`Agregar a ${cat}`}><Plus size={13} /></button>
                        </div>
                      </div>
                      <div className="divide-y divide-line">
                        {group.map((meal) => (
                          <MealRow
                            key={meal.id}
                            meal={meal}
                            onEdit={() => actions.openMeal({ meal })}
                            onDelete={async () => {
                              const ok = await confirm({ title: 'Eliminar registro', message: 'Se va a borrar esta comida del registro.', confirmLabel: 'Eliminar', tone: 'danger' });
                              if (!ok) return;
                              mutateData((d) => { d.meals = d.meals.filter((m) => m.id !== meal.id); });
                              toast.success('Registro eliminado');
                            }}
                            onRepeat={() => {
                              mutateData((d) => {
                                d.meals.push(newMeal({ category: meal.category, date: today(), time: nowTime(), items: meal.items.map((i) => ({ ...i, id: uid('food') })), notes: meal.notes }));
                              });
                              toast.success('Comida repetida hoy', meal.category);
                            }}
                          />
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : null}

          {tab === 'favoritas' ? (
            <TemplatesList onLog={logTemplate} />
          ) : null}

          {tab === 'historial' ? (
            <Card className="overflow-hidden">
              <SectionHead className="px-3.5 pt-3.5" title="Últimos 14 días" subtitle="Resumen diario de lo registrado." />
              <div className="scroll-x">
                <table className="table-base min-w-[560px]">
                  <thead>
                    <tr><th>Día</th><th className="text-right">Comidas</th><th className="text-right">kcal</th><th className="text-right">Prot.</th><th className="text-right">Carb.</th><th className="text-right">Grasas</th><th className="text-right">Agua</th></tr>
                  </thead>
                  <tbody>
                    {recentDays.map((d) => (
                      <tr key={d.date} className="cursor-pointer hover:bg-panel-2" onClick={() => { setDate(d.date); setTab('dia'); }}>
                        <td className="capitalize text-ink-soft">{friendlyDay(d.date)} <span className="ml-1 text-[0.66rem] text-faint">{fmtDateShort(d.date)}</span></td>
                        <td className="num text-right">{d.meals || '—'}</td>
                        <td className="num text-right">{d.kcal ? fmtNum(d.kcal) : '—'}</td>
                        <td className="num text-right">{d.protein ? fmtNum(d.protein) : '—'}</td>
                        <td className="num text-right">{d.carbs ? fmtNum(d.carbs) : '—'}</td>
                        <td className="num text-right">{d.fat ? fmtNum(d.fat) : '—'}</td>
                        <td className="num text-right text-faint">{d.water ? fmtMl(d.water, data.profile.units) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="card-pad">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[0.83rem] font-semibold text-ink"><Droplets size={14} className="text-info" /> Agua</h3>
              <span className="text-[0.66rem] text-faint">{fmtMl(water, data.profile.units)} / {fmtMl(data.settings.waterGoalMl, data.profile.units)}</span>
            </div>
            <div className="mb-3 flex items-baseline gap-1">
              <span className="metric text-[1.7rem]">{fmtMl(water, data.profile.units)}</span>
              <span className="text-[0.7rem] text-faint">{Math.round(pct(water, data.settings.waterGoalMl))}%</span>
            </div>
            <Meter value={pct(water, data.settings.waterGoalMl)} tone="info" height={6} />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[250, 500, 750].map((ml) => (
                <button key={ml} className="btn btn-secondary btn-sm !text-[0.7rem]" onClick={() => { mutateData((d) => addWater(d, ml, date)); toast.success(`+${ml} ml`); }}>
                  +{ml}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Input
                type="number"
                value={customWater}
                onChange={(e) => setCustomWater(e.target.value)}
                placeholder="ml"
                className="!min-h-[2rem] !py-1 !text-[0.72rem]"
                aria-label="Cantidad personalizada de agua"
              />
              <button
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => {
                  const ml = Number(customWater);
                  if (ml > 0 && ml <= 3000) { mutateData((d) => addWater(d, ml, date)); setCustomWater(''); toast.success(`+${ml} ml`); }
                }}
              >
                Sumar
              </button>
              <button className="btn btn-ghost btn-icon !h-[2rem] !w-[2rem]" onClick={() => { mutateData((d) => subtractWater(d, date)); }} aria-label="Deshacer último registro"><Minus size={13} /></button>
            </div>
          </Card>

          <Card className="card-pad">
            <h3 className="mb-2 flex items-center gap-1.5 text-[0.83rem] font-semibold text-ink"><Sparkles size={14} className="text-accent" /> Equilibrio</h3>
            <div className="space-y-2">
              {[
                { label: 'Comidas', value: `${totals.meals}/3`, ok: totals.meals >= 3 },
                { label: 'Variedad de alimentos', value: `${new Set(meals.flatMap((m) => m.items.map((i) => i.name.toLowerCase()))).size}`, ok: new Set(meals.flatMap((m) => m.items.map((i) => i.name.toLowerCase()))).size >= 5 },
                { label: 'Agua', value: `${Math.round(pct(water, data.settings.waterGoalMl))}%`, ok: pct(water, data.settings.waterGoalMl) >= 60 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[0.74rem] text-muted">{item.label}</span>
                  <span className={cn('num text-[0.76rem] font-medium', item.ok ? 'text-accent' : 'text-ink-soft')}>{item.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-line pt-2.5 text-[0.7rem] leading-relaxed text-faint">
              No hay metas rígidas acá. Estos indicadores son una referencia de regularidad, no una evaluación.
            </p>
          </Card>

          <Card className="card-pad">
            <SectionHead title="Favoritas y recetas" subtitle="Para registrar en un clic."
              action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openTemplate('favorite')} aria-label="Nueva favorita"><Plus size={14} /></button>}
            />
            {data.templates.length === 0 ? (
              <p className="text-[0.73rem] leading-relaxed text-faint">Guardá combinaciones que uses seguido. Después las registrás desde acá o desde el menú rápido.</p>
            ) : (
              <div className="space-y-1">
                {data.templates.slice(0, 5).map((tpl) => (
                  <button key={tpl.id} onClick={() => logTemplate(tpl.id)} className="flex w-full items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-left hover:border-accent-line">
                    <span className="shrink-0 text-[0.75rem]">{tpl.kind === 'recipe' ? '🍲' : '★'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.75rem] font-medium text-ink-soft">{tpl.name}</span>
                      <span className="block text-[0.63rem] text-faint">{tpl.items.length} ingredientes · {fmtNum(sum(tpl.items.map((i) => i.kcal ?? 0)))} kcal</span>
                    </span>
                    <Plus size={12} className="shrink-0 text-faint" />
                  </button>
                ))}
                <button className="mt-1 text-[0.7rem] text-muted hover:text-accent" onClick={() => setTab('favoritas')}>Ver todas</button>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHead className="!mb-0" title="Evolución nutricional" subtitle="Solo se grafican los días con comidas registradas." />
        <Segmented value={range} onChange={(v) => setRange(v)} options={[{ value: '7', label: '7 d' }, { value: '30', label: '30 d' }, { value: '90', label: '90 d' }]} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Calorías registradas" subtitle="No es una meta: es el reflejo de lo que anotaste." empty={chartData.length < 2} emptyHint="Registrá comidas en al menos dos días para ver la evolución." height={210}>
          <TrendChart data={chartData} xKey="date" kind="area" xFormatter={(v) => fmtDateNumeric(String(v))} valueFormatter={(v) => `${fmtNum(v)} kcal`} series={[{ key: 'kcal', label: 'kcal', color: 'var(--accent)' }]} />
        </ChartCard>
        <ChartCard title="Macronutrientes" subtitle="Proteína, carbohidratos y grasas por día." empty={chartData.length < 2} height={210}>
          <TrendChart
            data={chartData} xKey="date" kind="line" xFormatter={(v) => fmtDateNumeric(String(v))} valueFormatter={(v) => `${fmtNum(v)} g`}
            series={[
              { key: 'protein', label: 'Proteína', color: 'var(--accent)' },
              { key: 'carbs', label: 'Carbohidratos', color: 'var(--info)' },
              { key: 'fat', label: 'Grasas', color: 'var(--warn)' },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function MealRow({ meal, onEdit, onDelete, onRepeat }: { meal: Meal; onEdit: () => void; onDelete: () => void; onRepeat: () => void }) {
  const totals = mealTotals(meal);
  return (
    <div className="group flex items-start gap-2 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-[0.79rem] text-ink-soft">{meal.items.map((i) => `${i.name}${i.qty ? ` (${fmtNum(i.qty)} ${i.unit})` : ''}`).join(' · ') || 'Comida sin alimentos'}</p>
          <span className="num text-[0.65rem] text-faint">{meal.time}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.66rem] text-faint">
          {totals.kcal ? <span className="num">{fmtNum(totals.kcal)} kcal</span> : null}
          {totals.protein ? <span className="num">P {fmtNum(totals.protein)} g</span> : null}
          {totals.carbs ? <span className="num">C {fmtNum(totals.carbs)} g</span> : null}
          {totals.fat ? <span className="num">G {fmtNum(totals.fat)} g</span> : null}
          {meal.notes ? <span className="italic">{meal.notes}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={onRepeat} aria-label="Repetir hoy"><Plus size={12} /></button>
        <button className="btn btn-ghost btn-icon !h-6 !w-6" onClick={onEdit} aria-label="Editar comida"><Pencil size={12} /></button>
        <button className="btn btn-ghost btn-icon !h-6 !w-6 hover:text-danger" onClick={onDelete} aria-label="Eliminar comida"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function TemplatesList({ onLog }: { onLog: (id: string) => void }) {
  const templates = useAppStore((s) => s.data.templates);
  const actions = useActions();
  const confirm = useConfirm();
  const toast = useToast();

  if (!templates.length) {
    return (
      <Card className="card-pad">
        <EmptyState
          icon={<Star size={20} />}
          title="Sin favoritas ni recetas todavía"
          description="Guardá una comida que repitas seguido, o armá una receta con sus ingredientes por porción."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => actions.openTemplate('favorite')}><Star size={13} /> Nueva favorita</button>
              <button className="btn btn-secondary btn-sm" onClick={() => actions.openTemplate('recipe')}><Salad size={13} /> Nueva receta</button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((tpl) => (
        <Card key={tpl.id} className="card-pad flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex gap-1">
                <Badge tone={tpl.kind === 'recipe' ? 'info' : 'accent'}>{tpl.kind === 'recipe' ? 'Receta' : 'Favorita'}</Badge>
                {tpl.kind === 'recipe' ? <Badge>{tpl.servings} porc.</Badge> : null}
              </div>
              <p className="truncate text-[0.86rem] font-medium text-ink">{tpl.name}</p>
              <p className="mt-0.5 text-[0.68rem] text-faint">
                {tpl.items.length} ingredientes · {fmtNum(sum(tpl.items.map((i) => i.kcal ?? 0)))} kcal · P {fmtNum(sum(tpl.items.map((i) => i.protein ?? 0)))} g
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => actions.openTemplate(tpl.kind === 'recipe' ? 'recipe' : 'favorite', tpl)} aria-label="Editar"><Pencil size={12} /></button>
              <button
                className="btn btn-ghost btn-icon !h-7 !w-7 hover:text-danger"
                aria-label="Eliminar"
                onClick={async () => {
                  const ok = await confirm({ title: 'Eliminar', message: `Se va a borrar “${tpl.name}”.`, confirmLabel: 'Eliminar', tone: 'danger' });
                  if (!ok) return;
                  mutateData((d) => { d.templates = d.templates.filter((x) => x.id !== tpl.id); });
                  toast.success('Eliminado');
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <p className="mt-2 line-clamp-2 text-[0.72rem] leading-snug text-muted">
            {tpl.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(' · ')}
          </p>
          {tpl.instructions ? <p className="mt-1.5 line-clamp-2 rounded-lg bg-panel-2 px-2 py-1.5 text-[0.69rem] leading-snug text-faint">{tpl.instructions}</p> : null}

          <button className="btn btn-secondary btn-sm mt-auto pt-1.5" onClick={() => onLog(tpl.id)}><Plus size={12} /> Registrar hoy</button>
        </Card>
      ))}
    </div>
  );
}

function NutrientCard({ label, value, unit, hint, icon, goal, current = 0 }: { label: string; value: string; unit: string; hint: string; icon: React.ReactNode; goal?: number | null; current?: number }) {
  const hasGoal = typeof goal === 'number' && goal > 0;
  const diff = hasGoal ? goal - current : 0;
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] font-medium text-muted">{label}</p>
        <span className="text-faint">{icon}</span>
      </div>
      {hasGoal ? (
        <>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="metric text-[1.45rem]">{value}</span>
            <span className="text-[0.66rem] text-faint">/ {fmtNum(goal)} {unit}</span>
          </div>
          <Meter value={pct(current, goal)} height={4} className="mt-2" />
          <p className="mt-1 truncate text-[0.64rem] text-faint">
            {diff >= 0 ? `${fmtNum(diff)} ${unit} restantes` : `${fmtNum(Math.abs(diff))} ${unit} sobre la meta`}
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="metric text-[1.45rem]">{value}</span>
            <span className="text-[0.68rem] text-faint">{unit}</span>
          </div>
          <p className="mt-0.5 truncate text-[0.64rem] text-faint">{hint}</p>
        </>
      )}
    </div>
  );
}

void series; void Field; void Apple; void fmtDateShort; void friendlyDay;
