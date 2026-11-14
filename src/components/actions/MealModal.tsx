import { useEffect, useMemo, useState } from 'react';
import { Copy, History, Plus, Star, Trash2 } from 'lucide-react';
import type { FoodItem, Meal, MealCategory } from '@/types';
import { MEAL_CATEGORIES } from '@/types';
import { mutateData, useAppStore } from '@/store/store';
import { newMeal } from '@/lib/domain';
import { today, nowTime, fmtTime, fmtDateNumeric } from '@/lib/date';
import { parseNumber, sum, uid, cn, fmtNum } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

const UNITS = ['g', 'ml', 'unidad', 'porción', 'taza', 'cda', 'cdta', 'oz', 'scoop'];

const blankItem = (): FoodItem => ({ id: uid('food'), name: '', qty: 100, unit: 'g', kcal: null, protein: null, carbs: null, fat: null });

const toNumberOrNull = (raw: string): number | null => (raw.trim() === '' ? null : parseNumber(raw));

interface ItemRowProps {
  item: FoodItem;
  onChange: (patch: Partial<FoodItem>) => void;
  onRemove: () => void;
  suggestions: string[];
}

function ItemRow({ item, onChange, onRemove, suggestions }: ItemRowProps) {
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Alimento"
          list={`food-suggestions-${item.id}`}
          className="!min-h-[2.1rem] flex-1 !py-1 !text-[0.82rem]"
        />
        <datalist id={`food-suggestions-${item.id}`}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button type="button" className="btn btn-ghost btn-icon !h-8 !w-8 shrink-0 hover:text-danger" onClick={onRemove} aria-label="Quitar alimento">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1.1fr_1fr] gap-2">
        <Input type="number" step="any" value={item.qty} onChange={(e) => onChange({ qty: Number(e.target.value) })} placeholder="Cant." className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" aria-label="Cantidad" />
        <Select value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" aria-label="Unidad">
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
        <Input type="number" step="any" value={item.kcal ?? ''} onChange={(e) => onChange({ kcal: toNumberOrNull(e.target.value) })} placeholder="kcal" className="!min-h-[1.9rem] !py-0.5 !text-[0.75rem]" aria-label="Calorías" />
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <Input type="number" step="any" value={item.protein ?? ''} onChange={(e) => onChange({ protein: toNumberOrNull(e.target.value) })} placeholder="Prot. g" className="!min-h-[1.9rem] !py-0.5 !text-[0.73rem]" aria-label="Proteínas" />
        <Input type="number" step="any" value={item.carbs ?? ''} onChange={(e) => onChange({ carbs: toNumberOrNull(e.target.value) })} placeholder="Carb. g" className="!min-h-[1.9rem] !py-0.5 !text-[0.73rem]" aria-label="Carbohidratos" />
        <Input type="number" step="any" value={item.fat ?? ''} onChange={(e) => onChange({ fat: toNumberOrNull(e.target.value) })} placeholder="Grasas g" className="!min-h-[1.9rem] !py-0.5 !text-[0.73rem]" aria-label="Grasas" />
      </div>
    </div>
  );
}

export function MealModal({
  open,
  onClose,
  meal,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  meal?: Meal | null;
  defaults?: { date?: string; category?: MealCategory };
}) {
  const toast = useToast();
  const allMeals = useAppStore((s) => s.data.meals);
  const templates = useAppStore((s) => s.data.templates);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(nowTime());
  const [category, setCategory] = useState<MealCategory>('Almuerzo');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saveFavorite, setSaveFavorite] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHistoryOpen(false);
    setSaveFavorite(false);
    setDate(meal?.date ?? defaults?.date ?? today());
    setTime(meal?.time ?? nowTime());
    setCategory(meal?.category ?? defaults?.category ?? 'Almuerzo');
    setItems(meal ? meal.items.map((i) => ({ ...i })) : [blankItem()]);
    setNotes(meal?.notes ?? '');
    setFavoriteName('');
  }, [open, meal, defaults]);

  const suggestions = useMemo(() => {
    const names = new Set<string>();
    allMeals.forEach((m) => m.items.forEach((i) => { if (i.name) names.add(i.name); }));
    templates.forEach((t) => t.items.forEach((i) => { if (i.name) names.add(i.name); }));
    return [...names].sort((a, b) => a.localeCompare(b, 'es')).slice(0, 300);
  }, [allMeals, templates]);

  const recentMeals = useMemo(
    () => allMeals.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.time < b.time ? 1 : -1)).slice(0, 18),
    [allMeals],
  );

  const totals = {
    kcal: sum(items.map((i) => i.kcal ?? 0)),
    protein: sum(items.map((i) => i.protein ?? 0)),
    carbs: sum(items.map((i) => i.carbs ?? 0)),
    fat: sum(items.map((i) => i.fat ?? 0)),
  };

  const patchItem = (id: string, patch: Partial<FoodItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const copyItems = (source: FoodItem[]) => {
    setItems(source.map((i) => ({ ...i, id: uid('food') })));
    setHistoryOpen(false);
  };

  const save = () => {
    const cleaned = items.filter((i) => i.name.trim());
    if (!cleaned.length) return setError('Agregá al menos un alimento.');
    const payload = { date, time, category, notes: notes.trim() };

    mutateData((d) => {
      if (meal) {
        const target = d.meals.find((m) => m.id === meal.id);
        if (target) Object.assign(target, payload, { items: cleaned.map((i) => ({ ...i, name: i.name.trim() })) });
      } else {
        d.meals.push(newMeal({ ...payload, items: cleaned.map((i) => ({ ...i, name: i.name.trim() })) }));
      }
      if (saveFavorite && favoriteName.trim()) {
        d.templates.push({
          id: uid('tpl'), name: favoriteName.trim(), kind: 'favorite',
          items: cleaned.map((i) => ({ ...i, id: uid('food') })), servings: 1, instructions: '',
          createdAt: new Date().toISOString(),
        });
      }
    });

    toast.success(meal ? 'Comida actualizada' : 'Comida registrada', `${category} · ${cleaned.length} alimento${cleaned.length === 1 ? '' : 's'}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={meal ? 'Editar comida' : 'Registrar comida'}
      description="Los macros son opcionales. Lo importante es que el registro te sirva, no que sea perfecto."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{meal ? 'Guardar comida' : 'Registrar'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Momento" className="col-span-2 sm:col-span-1">
            <Select value={category} onChange={(e) => setCategory(e.target.value as MealCategory)}>
              {MEAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, blankItem()])}><Plus size={13} /> Alimento</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setHistoryOpen((v) => !v)}><History size={13} /> Reutilizar</button>
          {templates.length ? (
            <Select
              className="!min-h-[1.95rem] !w-auto !py-0.5 !text-[0.75rem]"
              value=""
              onChange={(e) => {
                const tpl = templates.find((t) => t.id === e.target.value);
                if (tpl) copyItems(tpl.items);
              }}
            >
              <option value="">Desde favoritas o recetas…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.kind === 'recipe' ? '🍲 ' : '★ '}{t.name}</option>)}
            </Select>
          ) : null}
        </div>

        {historyOpen ? (
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-panel-2 p-2">
            {recentMeals.length === 0 ? (
              <p className="px-2 py-3 text-center text-[0.76rem] text-faint">Todavía no hay comidas anteriores.</p>
            ) : (
              recentMeals.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => copyItems(m.items)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-panel-3"
                >
                  <Copy size={12} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate text-[0.76rem] text-ink-soft">
                    {m.category} · {m.items.map((i) => i.name).join(', ') || 'sin alimentos'}
                  </span>
                  <span className="shrink-0 text-[0.68rem] text-faint">{fmtDateNumeric(m.date)} {fmtTime(m.time)}</span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {error ? <p className="text-[0.75rem] font-medium text-danger">{error}</p> : null}

        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              suggestions={suggestions}
              onChange={(patch) => patchItem(item.id, patch)}
              onRemove={() => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== item.id) : [blankItem()]))}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
          <div className="flex items-baseline gap-1">
            <span className="metric text-[1.05rem]">{fmtNum(totals.kcal)}</span>
            <span className="text-[0.7rem] text-faint">kcal</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted">
            <span><span className="num font-medium text-ink-soft">{fmtNum(totals.protein)}</span> g prot.</span>
            <span><span className="num font-medium text-ink-soft">{fmtNum(totals.carbs)}</span> g carb.</span>
            <span><span className="num font-medium text-ink-soft">{fmtNum(totals.fat)}</span> g grasas</span>
          </div>
        </div>

        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Contexto: lugar, hambre, cómo te sentiste…" />
        </Field>

        {!meal ? (
          <div className="rounded-xl border border-line bg-panel-2 px-3">
            <Toggle checked={saveFavorite} onChange={setSaveFavorite} label="Guardar como comida favorita" description="Para volver a registrarla en un clic." />
            {saveFavorite ? (
              <div className="pb-3">
                <Input value={favoriteName} onChange={(e) => setFavoriteName(e.target.value)} placeholder={`Ej. ${category} de siempre`} className="!min-h-[2.1rem]" />
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-faint">
          <Star size={12} className="mt-0.5 shrink-0" />
          Registrar no es una obligación. Podés anotar solo algunas comidas y usar el historial como referencia, sin metas rígidas.
        </p>
      </div>
    </Modal>
  );
}

export function TemplateModal({ open, onClose, template, kind }: { open: boolean; onClose: () => void; template?: MealTemplateLike | null; kind: 'favorite' | 'recipe' }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [items, setItems] = useState<FoodItem[]>([blankItem()]);
  const [servings, setServings] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setItems(template ? template.items.map((i) => ({ ...i })) : [blankItem()]);
    setServings(template?.servings ?? 1);
    setInstructions(template?.instructions ?? '');
    setError(null);
  }, [open, template]);

  const totals = {
    kcal: sum(items.map((i) => i.kcal ?? 0)),
    protein: sum(items.map((i) => i.protein ?? 0)),
    carbs: sum(items.map((i) => i.carbs ?? 0)),
    fat: sum(items.map((i) => i.fat ?? 0)),
  };

  const save = () => {
    const cleaned = items.filter((i) => i.name.trim());
    if (!name.trim()) return setError('Poné un nombre.');
    if (!cleaned.length) return setError('Agregá al menos un ingrediente.');
    mutateData((d) => {
      if (template) {
        const target = d.templates.find((t) => t.id === template.id);
        if (target) Object.assign(target, { name: name.trim(), items: cleaned, servings, instructions: instructions.trim() });
      } else {
        d.templates.push({
          id: uid('tpl'), name: name.trim(), kind, servings: Math.max(1, servings),
          items: cleaned.map((i) => ({ ...i, name: i.name.trim(), id: uid('food') })),
          instructions: instructions.trim(), createdAt: new Date().toISOString(),
        });
      }
    });
    toast.success(kind === 'recipe' ? 'Receta guardada' : 'Favorita guardada', name.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={template ? (kind === 'recipe' ? 'Editar receta' : 'Editar favorita') : kind === 'recipe' ? 'Nueva receta' : 'Nueva comida favorita'}
      description={kind === 'recipe' ? 'Cargá los ingredientes por porción. Después la registrás en un clic.' : 'Una combinación de alimentos que usás seguido.'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required error={error}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder={kind === 'recipe' ? 'Ej. Bowl de pollo y arroz' : 'Ej. Desayuno de siempre'} invalid={!!error} autoFocus />
        </Field>

        {kind === 'recipe' ? (
          <Field label="Porciones que rinde" hint="Los valores de abajo son por porción.">
            <Input type="number" min={1} max={20} value={servings} onChange={(e) => setServings(Number(e.target.value))} className="!w-24" />
          </Field>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="label !mb-0">Ingredientes</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, blankItem()])}><Plus size={13} /> Agregar</button>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              suggestions={[]}
              onChange={(patch) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
              onRemove={() => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== item.id) : prev))}
            />
          ))}
        </div>

        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-panel-2 px-3 py-2 text-[0.72rem] text-muted')}>
          <span><span className="num font-medium text-ink">{fmtNum(totals.kcal)}</span> kcal</span>
          <span><span className="num font-medium text-ink">{fmtNum(totals.protein)}</span> g prot.</span>
          <span><span className="num font-medium text-ink">{fmtNum(totals.carbs)}</span> g carb.</span>
          <span><span className="num font-medium text-ink">{fmtNum(totals.fat)}</span> g grasas</span>
        </div>

        {kind === 'recipe' ? (
          <Field label="Preparación">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Pasos, tiempos, tips…" />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

type MealTemplateLike = { id: string; name: string; items: FoodItem[]; servings: number; instructions: string };
