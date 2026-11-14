import { useRef, useState } from 'react';
import {
  AlertTriangle, Bell, Check, Database, Download, HardDrive, Moon, Music, Palette, RefreshCcw,
  Save, ShieldCheck, Sun, Trash2, Upload, User, Cloud, Info,
} from 'lucide-react';
import type { AccentTone, NutritionGoals } from '@/types';
import { useAppStore, mutateData, normalizeData } from '@/store/store';
import { exportBackup, exportHabitsCsv, exportMealsCsv, exportWeightsCsv, exportWorkoutsCsv, readBackup, countRecords, dataSizeKb } from '@/lib/backup';
import { useConfirm } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge, Card, Field, Input, SectionHead, Segmented, Select, Textarea, Toggle } from '@/components/ui/Primitives';
import { fmtDateLong, today } from '@/lib/date';
import { cn, fmtNum, parseNumber } from '@/lib/utils';
import { navigate } from '@/lib/router';

const ACCENTS: Array<{ id: AccentTone; label: string; color: string }> = [
  { id: 'lime', label: 'Lima', color: '#c7ee7c' },
  { id: 'olive', label: 'Oliva', color: '#b6c98a' },
  { id: 'sage', label: 'Salvia', color: '#a9cbb0' },
  { id: 'ice', label: 'Hielo', color: '#a9d4dd' },
];

export function Settings() {
  const data = useAppStore((s) => s.data);
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({
    name: data.profile.name,
    focus: data.profile.focus,
    goal: data.profile.goal,
    heightCm: data.profile.heightCm != null ? String(data.profile.heightCm) : '',
    weightKg: data.profile.weightKg != null ? String(data.profile.weightKg) : '',
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(() => { try { return localStorage.getItem('plos-last-backup'); } catch { return null; } });

  const GOAL_MAX: Record<keyof NutritionGoals, number> = { kcal: 10000, protein: 1000, carbs: 1500, fat: 1000 };
  const setNutritionGoal = (key: keyof NutritionGoals, raw: string) => {
    const parsed = parseNumber(raw);
    const value = parsed != null && parsed > 0 ? Math.min(Math.round(parsed), GOAL_MAX[key]) : null;
    mutateData((d) => { d.settings.nutritionGoals[key] = value; });
  };
  const hasNutritionGoals = Object.values(data.settings.nutritionGoals).some((v) => typeof v === 'number' && v > 0);

  const saveProfile = () => {
    mutateData((d) => {
      d.profile.name = profile.name.trim();
      d.profile.focus = profile.focus.trim();
      d.profile.goal = profile.goal.trim();
      d.profile.heightCm = profile.heightCm ? Number(profile.heightCm) : null;
      d.profile.weightKg = profile.weightKg ? Number(profile.weightKg) : null;
    });
    toast.success('Perfil guardado', profile.name.trim() ? `Hola, ${profile.name.trim().split(' ')[0]}.` : 'Datos actualizados.');
  };

  const requestNotifications = async (enabled: boolean) => {
    if (!enabled) {
      mutateData((d) => { d.settings.notifications.enabled = false; });
      return;
    }
    if (typeof Notification === 'undefined') {
      toast.error('Este navegador no soporta notificaciones');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      mutateData((d) => { d.settings.notifications.enabled = true; });
      toast.success('Notificaciones activadas', 'El navegador va a pedir permiso por cada sitio.');
    } else {
      toast.warning('Permiso denegado', 'Podés habilitarlo desde la configuración del navegador.');
    }
  };

  const importFile = async (file: File) => {
    setImportError(null);
    try {
      const raw = await readBackup(file);
      const normalized = normalizeData(raw);
      const total = normalized.habits.length + normalized.sessions.length + normalized.tasks.length + normalized.meals.length;
      if (!total && !normalized.routines.length) throw new Error('El archivo no contiene registros reconocibles.');
      const ok = await confirm({
        title: 'Reemplazar todos los datos',
        message: `El archivo contiene ${normalized.habits.length} hábitos, ${normalized.routines.length} rutinas, ${normalized.sessions.length} sesiones, ${normalized.meals.length} comidas y ${normalized.tasks.length} tareas. Se van a reemplazar los datos actuales.`,
        confirmLabel: 'Importar y reemplazar',
        tone: 'danger',
      });
      if (!ok) return;
      useAppStore.getState().replaceAll(normalized);
      toast.success('Respaldo restaurado', 'Los datos del archivo ya están activos.');
    } catch (err) {
      console.error(err);
      setImportError('No se pudo leer el archivo. Tiene que ser un JSON exportado por esta app.');
    }
  };

  return (
    <div className="space-y-5">
      <section>
        <p className="eyebrow">Configuración</p>
        <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Tu sistema, tus reglas.</h1>
        <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
          Perfil, metas personales, apariencia y respaldos. Todo se guarda en este dispositivo.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* perfil */}
        <Card className="card-pad">
          <SectionHead title={<span className="flex items-center gap-1.5"><User size={14} className="text-accent" /> Perfil</span>} subtitle="Se usa para saludarte y personalizar unidades." />
          <div className="space-y-3">
            <Field label="Nombre">
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Cómo querés que te llame" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Foco actual">
                <Input value={profile.focus} onChange={(e) => setProfile({ ...profile, focus: e.target.value })} placeholder="Fuerza, volumen, recomposición…" />
              </Field>
              <Field label="Unidades corporales" hint="Altura, peso corporal y agua. Las cargas de entrenamiento se registran en kg.">
                <Select
                  value={data.profile.units}
                  onChange={(e) => { mutateData((d) => { d.profile.units = e.target.value as 'metric' | 'imperial'; }); toast.success('Unidades actualizadas', e.target.value === 'metric' ? 'Sistema métrico (kg, cm, ml)' : 'Sistema imperial (lb, in, oz)'); }}
                >
                  <option value="metric">Métrico (kg / cm / ml)</option>
                  <option value="imperial">Imperial (lb / in / oz)</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Altura (cm)">
                <Input type="number" value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })} placeholder="170" />
              </Field>
              <Field label="Peso (kg)">
                <Input type="number" step="0.1" value={profile.weightKg} onChange={(e) => setProfile({ ...profile, weightKg: e.target.value })} placeholder="65" />
              </Field>
            </div>
            <Field label="Objetivo principal" hint="En tus palabras. No se usa para calcular nada automáticamente.">
              <Textarea value={profile.goal} onChange={(e) => setProfile({ ...profile, goal: e.target.value })} rows={2} placeholder="Ej. Ganar fuerza sosteniendo el descanso y el estudio" />
            </Field>
            <button className="btn btn-primary w-full" onClick={saveProfile}><Save size={14} /> Guardar perfil</button>
          </div>
        </Card>

        <div className="space-y-4">
          {/* apariencia */}
          <Card className="card-pad">
            <SectionHead title={<span className="flex items-center gap-1.5"><Palette size={14} className="text-accent" /> Apariencia</span>} subtitle="Tema oscuro por defecto, pensado para uso nocturno." />
            <div className="flex items-center gap-2">
              <Segmented
                value={data.settings.theme}
                onChange={(v) => { mutateData((d) => { d.settings.theme = v; }); }}
                options={[
                  { value: 'dark', label: <span className="flex items-center gap-1"><Moon size={12} /> Oscuro</span> },
                  { value: 'light', label: <span className="flex items-center gap-1"><Sun size={12} /> Claro</span> },
                ]}
              />
            </div>
            <div className="mt-3">
              <span className="label">Color de acento</span>
              <div className="flex gap-2">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.id}
                    onClick={() => mutateData((d) => { d.settings.accent = accent.id; })}
                    className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.72rem] transition-colors', data.settings.accent === accent.id ? 'border-accent-line bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink')}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: accent.color }} />
                    {accent.label}
                    {data.settings.accent === accent.id ? <Check size={11} className="text-accent" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* metas */}
          <Card className="card-pad">
            <SectionHead title="Metas y preferencias" subtitle="Referencias que la app usa para mostrarte progreso relativo." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agua diaria (ml)">
                <Input type="number" step={100} value={data.settings.waterGoalMl} onChange={(e) => mutateData((d) => { d.settings.waterGoalMl = Math.max(200, Number(e.target.value) || 2500); })} />
              </Field>
              <Field label="Sueño objetivo (h)">
                <Input type="number" step={0.5} min={4} max={12} value={data.settings.sleepGoalH} onChange={(e) => mutateData((d) => { d.settings.sleepGoalH = Math.max(4, Math.min(12, Number(e.target.value) || 8)); })} />
              </Field>
              <Field label="Entrenamientos por semana">
                <Input type="number" min={1} max={14} value={data.settings.weeklyWorkoutGoal} onChange={(e) => mutateData((d) => { d.settings.weeklyWorkoutGoal = Math.max(1, Math.min(14, Number(e.target.value) || 4)); })} />
              </Field>
              <Field label="Descanso por defecto (s)">
                <Input type="number" step={15} min={10} max={600} value={data.settings.restDefaultSec} onChange={(e) => mutateData((d) => { d.settings.restDefaultSec = Math.max(10, Math.min(900, Number(e.target.value) || 90)); })} />
              </Field>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label">Metas nutricionales</p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-faint">Opcionales. Podés cargar solo calorías o también macros; si están vacías, la app no muestra objetivos.</p>
                </div>
                {hasNutritionGoals ? (
                  <button
                    className="btn btn-ghost btn-sm shrink-0"
                    onClick={() => mutateData((d) => { d.settings.nutritionGoals = { kcal: null, protein: null, carbs: null, fat: null }; })}
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <Field label="Calorías (kcal)">
                  <Input type="number" min={0} step={50} value={data.settings.nutritionGoals.kcal ?? ''} onChange={(e) => setNutritionGoal('kcal', e.target.value)} placeholder="Ej. 2000" />
                </Field>
                <Field label="Proteína (g)">
                  <Input type="number" min={0} step={5} value={data.settings.nutritionGoals.protein ?? ''} onChange={(e) => setNutritionGoal('protein', e.target.value)} placeholder="Ej. 120" />
                </Field>
                <Field label="Carbohidratos (g)">
                  <Input type="number" min={0} step={5} value={data.settings.nutritionGoals.carbs ?? ''} onChange={(e) => setNutritionGoal('carbs', e.target.value)} placeholder="Ej. 220" />
                </Field>
                <Field label="Grasas (g)">
                  <Input type="number" min={0} step={5} value={data.settings.nutritionGoals.fat ?? ''} onChange={(e) => setNutritionGoal('fat', e.target.value)} placeholder="Ej. 65" />
                </Field>
              </div>
            </div>

            <div className="mt-1 divide-y divide-line">
              <Toggle checked={data.settings.autoRest} onChange={(v) => mutateData((d) => { d.settings.autoRest = v; })} label="Descanso automático" description="Inicia el cronómetro al completar una serie." />
              <Toggle checked={data.settings.sound} onChange={(v) => mutateData((d) => { d.settings.sound = v; })} label="Sonidos y vibración" description="Aviso al terminar descansos y bloques de foco." />
            </div>
          </Card>

          {/* notificaciones */}
          <Card className="card-pad">
            <SectionHead title={<span className="flex items-center gap-1.5"><Bell size={14} className="text-accent" /> Notificaciones</span>} subtitle="Se piden permisos del navegador, no de un servidor." />
            <Toggle
              checked={data.settings.notifications.enabled}
              onChange={requestNotifications}
              label="Notificaciones activas"
              description="Requiere aceptar el permiso del navegador."
            />
            <div className="mt-1 divide-y divide-line">
              <Toggle checked={data.settings.notifications.restTimer} onChange={(v) => mutateData((d) => { d.settings.notifications.restTimer = v; })} label="Fin del descanso" />
              <Toggle checked={data.settings.notifications.taskReminders} onChange={(v) => mutateData((d) => { d.settings.notifications.taskReminders = v; })} label="Recordatorio de tareas vencidas" description="Al abrir la app." />
              <Toggle checked={data.settings.notifications.dailyCheckin} onChange={(v) => mutateData((d) => { d.settings.notifications.dailyCheckin = v; })} label="Recordatorio de check-in" />
            </div>
          </Card>
        </div>
      </div>

      {/* sistema */}
      <Card className="card-pad">
        <SectionHead title="Tu sistema" subtitle="Accesos directos a lo que ya tenés cargado." />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SystemCard label="Hábitos activos" value={String(data.habits.filter((h) => !h.archived).length)} detail={`${data.habitLogs.length} marcas registradas`} action={() => navigate('habits')} />
          <SystemCard label="Rutinas" value={String(data.routines.length)} detail={`${data.sessions.filter((x) => x.status === 'completed').length} sesiones completadas`} action={() => navigate('gym')} />
          <SystemCard label="Tareas abiertas" value={String(data.tasks.filter((x) => x.status !== 'done').length)} detail={`${data.projects.length} proyectos`} action={() => navigate('productivity')} />
          <SystemCard label="Comidas registradas" value={String(data.meals.length)} detail={`${data.templates.length} favoritas y recetas`} action={() => navigate('nutrition')} />
        </div>
      </Card>

      {/* datos */}
      <Card className="card-pad">
        <SectionHead
          title={<span className="flex items-center gap-1.5"><Database size={14} className="text-accent" /> Datos y respaldo</span>}
          subtitle="IndexedDB con espejo en localStorage. Exportá un respaldo antes de cambiar de dispositivo."
          action={<Badge tone="accent"><ShieldCheck size={10} /> 100% local</Badge>}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="grid grid-cols-3 gap-1.5">
              {countRecords(data).slice(0, 9).map((r) => (
                <div key={r.label} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5">
                  <p className="num text-[0.85rem] font-semibold text-ink">{r.value}</p>
                  <p className="truncate text-[0.58rem] uppercase tracking-[0.04em] text-faint">{r.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.72rem] text-faint">
              <span className="flex items-center gap-2"><HardDrive size={12} /> Tamaño aproximado: {fmtNum(dataSizeKb(data))} KB</span>
              {dataSizeKb(data) > 3500 ? <span className="text-warn">· cerca del límite del espejo local</span> : null}
            </div>
            <p className="mt-1 text-[0.7rem] text-faint">
              {lastBackup ? `Última exportación: ${fmtDateLong(lastBackup.slice(0, 10))}.` : 'Todavía no exportaste una copia desde este dispositivo.'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-primary btn-sm" onClick={() => { const f = exportBackup(data); setLastBackup(new Date().toISOString()); toast.success('Respaldo descargado', f); }}>
                <Download size={13} /> Exportar JSON
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> Importar JSON
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { exportWorkoutsCsv(data); toast.success('CSV de entrenamientos descargado'); }}>
                CSV entrenamientos
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { exportMealsCsv(data); toast.success('CSV de nutrición descargado'); }}>
                CSV nutrición
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { exportHabitsCsv(data); toast.success('CSV de hábitos descargado'); }}>
                CSV hábitos
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { exportWeightsCsv(data); toast.success('CSV de pesajes descargado'); }}>
                CSV pesajes
              </button>
            </div>
            {importError ? <p className="text-[0.72rem] text-danger">{importError}</p> : null}
            <p className="text-[0.7rem] leading-relaxed text-faint">
              La importación reemplaza todo el contenido actual por el del archivo. Si usás la app en dos dispositivos,
              exportá de uno e importá en el otro.
            </p>
            <div className="rounded-xl border border-danger/25 bg-danger/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[0.73rem] font-medium text-danger"><AlertTriangle size={12} /> Zona sensible</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    const ok = await confirm({ title: 'Borrar todos los datos', message: 'Se van a eliminar hábitos, rutinas, sesiones, comidas, tareas, notas y registros. Exportá un respaldo antes. Esta acción no se puede deshacer.', confirmLabel: 'Borrar todo', tone: 'danger' });
                    if (!ok) return;
                    useAppStore.getState().resetAll();
                    toast.success('Datos borrados', 'La app volvió a su estado inicial.');
                  }}
                >
                  <Trash2 size={12} /> Borrar todo
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
                  <RefreshCcw size={12} /> Recargar app
                </button>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-pad">
          <SectionHead title={<span className="flex items-center gap-1.5"><Music size={14} className="text-accent" /> Integraciones</span>} subtitle="Solo mecanismos oficiales." />
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-line bg-panel-2 px-3 py-2">
              <div>
                <p className="text-[0.8rem] font-medium text-ink">Spotify</p>
                <p className="text-[0.68rem] text-faint">{data.settings.spotify.playlistId ? 'Playlist conectada vía embed oficial' : 'Sin playlist configurada'}</p>
              </div>
              <Badge tone={data.settings.spotify.playlistId ? 'accent' : 'outline'}>{data.settings.spotify.playlistId ? 'Activo' : 'Opcional'}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-panel-2 px-3 py-2">
              <div>
                <p className="text-[0.8rem] font-medium text-ink">Supabase</p>
                <p className="text-[0.68rem] text-faint">Arquitectura lista; falta configurar proyecto y claves</p>
              </div>
              <Badge tone="outline"><Cloud size={10} /> No configurado</Badge>
            </div>
            <button className="btn btn-secondary btn-sm w-full" onClick={() => navigate('extensions')}>Ir a Extensions</button>
          </div>
        </Card>

        <Card className="card-pad">
          <SectionHead title={<span className="flex items-center gap-1.5"><Info size={14} className="text-accent" /> Acerca de</span>} subtitle="Personal Lifestyle OS · v1.0" />
          <p className="text-[0.75rem] leading-relaxed text-muted">
            Sin cuentas, sin servidores y sin datos saliendo de tu dispositivo. Las estadísticas se calculan en el
            navegador a partir de tus registros. Si en el futuro querés sincronizar entre dispositivos, el modelo de
            datos y el adaptador de persistencia están preparados para Supabase.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="outline">React 19</Badge>
            <Badge tone="outline">TypeScript</Badge>
            <Badge tone="outline">Tailwind CSS</Badge>
            <Badge tone="outline">Recharts</Badge>
            <Badge tone="outline">IndexedDB</Badge>
          </div>
          <p className="mt-3 border-t border-line pt-2.5 text-[0.7rem] text-faint">
            Última fecha del sistema: {fmtDateLong(today())}. Los recordatorios del navegador dependen de que la app esté abierta.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SystemCard({ label, value, detail, action }: { label: string; value: string; detail: string; action: () => void }) {
  return (
    <button onClick={action} className="group rounded-xl border border-line bg-panel-2 p-3 text-left transition-colors hover:border-accent-line">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-medium text-muted">{label}</p>
        <span className="text-faint transition-colors group-hover:text-accent"><Check size={12} /></span>
      </div>
      <p className="num mt-1 text-[1.2rem] font-semibold text-ink">{value}</p>
      <p className="truncate text-[0.63rem] text-faint">{detail}</p>
    </button>
  );
}
