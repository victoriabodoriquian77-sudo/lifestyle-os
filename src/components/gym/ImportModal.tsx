import { useRef, useState } from 'react';
import { AlertTriangle, Check, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import type { ImportResult } from '@/lib/importer';
import { routineFromDraft } from '@/lib/domain';
import { mutateData } from '@/store/store';
import { WEEKDAY_LONG } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekdays, setWeekdays] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setResult(null);
    setSelected(new Set());
    setWeekdays({});
    setError(null);
    setBusy(false);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { parseWorkoutFile } = await import('@/lib/importer');
      const parsed = await parseWorkoutFile(file);
      setResult(parsed);
      setSelected(new Set(parsed.routines.map((r) => r.tempId)));
      setWeekdays(Object.fromEntries(parsed.routines.map((r) => [r.tempId, r.weekday != null ? String(r.weekday) : ''])));
      if (!parsed.routines.length) setError('No se encontraron ejercicios en el archivo. Revisá el formato o probá con un CSV.');
    } catch (err) {
      console.error(err);
      setError('No se pudo leer el archivo. Asegurate de que sea .xlsx, .xls o .csv válido.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const confirm = () => {
    if (!result) return;
    const picked = result.routines.filter((r) => selected.has(r.tempId));
    if (!picked.length) return setError('Seleccioná al menos una rutina.');
    mutateData((d) => {
      picked.forEach((draft) => {
        const wd = weekdays[draft.tempId];
        d.routines.push(routineFromDraft({ ...draft, weekday: wd === '' || wd == null ? null : Number(wd) }));
      });
    });
    toast.success('Rutinas importadas', `${picked.length} rutina${picked.length === 1 ? '' : 's'} creada${picked.length === 1 ? '' : 's'} desde ${result.fileName}`);
    reset();
    onClose();
  };

  const close = () => { reset(); onClose(); };

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Importar rutinas desde Excel o CSV"
      description="Se detectan hojas, días, ejercicios, series, repeticiones y descansos. Nada se guarda hasta que confirmes."
      footer={
        <>
          <button className="btn btn-secondary" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirm} disabled={!result || !selected.size || busy}>
            Importar {selected.size ? `(${selected.size})` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.ods"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
        />

        {!result ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-panel-2/40',
            )}
          >
            {busy ? <Loader2 size={22} className="mb-3 animate-spin text-accent" /> : <FileSpreadsheet size={22} className="mb-3 text-faint" />}
            <p className="text-[0.86rem] font-medium text-ink">Arrastrá tu planilla acá</p>
            <p className="mt-1 max-w-md text-[0.75rem] leading-relaxed text-faint">
              Acepta .xlsx, .xls y .csv. Cada hoja puede ser un día de entrenamiento. Se buscan columnas como
              <span className="text-muted"> Ejercicio, Series, Reps, Peso, Descanso y Observaciones</span>.
            </p>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => inputRef.current?.click()}><Upload size={13} /> Elegir archivo</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[0.82rem] font-medium text-ink">{result.fileName || 'Archivo'} </p>
                <p className="text-[0.7rem] text-faint">
                  {result.sheets.length} hoja{result.sheets.length === 1 ? '' : 's'} · {result.routines.reduce((a, r) => a + r.exercises.length, 0)} ejercicios detectados
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={reset}>Cambiar archivo</button>
            </div>

            {result.sheets.some((s) => s.notes.length) ? (
              <div className="space-y-1 rounded-xl border border-line bg-panel-2/50 px-3 py-2">
                {result.sheets.filter((s) => s.notes.length).map((s) => (
                  <p key={s.sheet} className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-faint">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0 text-warn" />
                    <span><strong className="font-medium text-muted">{s.sheet}:</strong> {s.notes.join(' ')}</span>
                  </p>
                ))}
              </div>
            ) : null}

            {result.routines.length ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-faint">Rutinas detectadas</p>
                  <button
                    className="text-[0.7rem] text-muted hover:text-ink"
                    onClick={() => setSelected(selected.size === result.routines.length ? new Set() : new Set(result.routines.map((r) => r.tempId)))}
                  >
                    {selected.size === result.routines.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>
                <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                  {result.routines.map((r) => {
                    const checked = selected.has(r.tempId);
                    return (
                      <div key={r.tempId} className={cn('rounded-xl border p-3 transition-colors', checked ? 'border-accent-line bg-accent-soft/40' : 'border-line bg-panel-2/40')}>
                        <div className="flex items-start gap-2.5">
                          <button
                            className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line-strong')}
                            onClick={() => {
                              const next = new Set(selected);
                              if (checked) next.delete(r.tempId); else next.add(r.tempId);
                              setSelected(next);
                            }}
                            aria-label={checked ? 'No importar' : 'Importar'}
                          >
                            {checked ? <Check size={10} strokeWidth={3} /> : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.84rem] font-medium text-ink">{r.name}</p>
                            <p className="mt-0.5 text-[0.7rem] text-faint">
                              {r.exercises.length} ejercicios · {r.muscleGroups.join(', ') || 'sin grupo'} · {r.source}
                            </p>
                          </div>
                          <Select
                            value={weekdays[r.tempId] ?? ''}
                            onChange={(e) => setWeekdays({ ...weekdays, [r.tempId]: e.target.value })}
                            className="!min-h-[1.9rem] !w-[118px] !py-0.5 !text-[0.72rem]"
                          >
                            <option value="">Sin día</option>
                            {WEEKDAY_LONG.slice(1).map((d) => <option key={d} value={WEEKDAY_LONG.indexOf(d)}>{d}</option>)}
                            <option value={0}>domingo</option>
                          </Select>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.exercises.slice(0, 8).map((ex, i) => (
                            <span key={i} className="chip !text-[0.65rem]">{ex.name} · {ex.sets}×{ex.repsTarget}</span>
                          ))}
                          {r.exercises.length > 8 ? <span className="chip !text-[0.65rem]">+{r.exercises.length - 8}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}

        {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[0.75rem] text-danger">{error}</p> : null}

        <div className="rounded-xl border border-line bg-panel-2/40 px-3 py-2.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-faint">Formatos que entiende</p>
          <ul className="mt-1 space-y-0.5 text-[0.71rem] leading-relaxed text-muted">
            <li>· Una hoja por día (“Lunes”, “Push A”, “Día 1”) o una sola hoja con todos los ejercicios.</li>
            <li>· Encabezados en cualquier fila de las primeras 14, con sinónimos en español o inglés.</li>
            <li>· Series como <span className="num">4</span> o <span className="num">4x10</span>; descanso <span className="num">90</span>, <span className="num">1:30</span> o <span className="num">2 min</span>.</li>
            <li>· Si no hay encabezados se interpreta el orden: ejercicio, series, reps, peso, descanso, notas.</li>
            <li>· ¿Google Sheets? Archivo → Descargar → Excel (.xlsx) o CSV, y subí ese archivo acá.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
