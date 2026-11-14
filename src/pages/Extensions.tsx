import { useMemo, useState } from 'react';
import {
  ArrowUpRight, CalendarDays, Calculator, Droplets, ExternalLink, Link2, Music, NotebookPen, Plus,
  Ruler, Sparkles, Timer, Trash2, TrendingUp,
} from 'lucide-react';
import { mutateData, useAppStore } from '@/store/store';
import { useActions } from '@/components/actions/ActionsProvider';
import { useUI } from '@/store/ui';
import { Modal } from '@/components/ui/Modal';
import { Badge, Card, EmptyState, Field, Input, Meter, SectionHead } from '@/components/ui/Primitives';
import { RestTimer, UnitConverter, LoadCalculator } from '@/components/extensions/Tools';
import { Pomodoro } from '@/components/productivity/Pomodoro';
import { fmtDateLong, fmtDateShort, greeting, monthMatrix, MONTH_LONG, today, weekday, WEEKDAY_MIN } from '@/lib/date';
import { dayHabitProgress, dayNutrition, sessionsInRange, waterDay } from '@/lib/metrics';
import { addWater } from '@/lib/domain';
import { toast, useToast } from '@/components/ui/Toast';
import { cn, fmtMl, uid } from '@/lib/utils';

type ToolId = 'rest' | 'pomodoro' | 'converter' | 'load' | null;

const SPOTIFY_ID = (url: string): string => url.match(/playlist\/([a-zA-Z0-9]+)/)?.[1] ?? '';

export function Extensions() {
  const data = useAppStore((s) => s.data);
  const actions = useActions();
  const setCommand = useUI((s) => s.setCommand);
  const [tool, setTool] = useState<ToolId>(null);
  const [spotifyEdit, setSpotifyEdit] = useState(false);
  const [linkModal, setLinkModal] = useState(false);

  const playlistUrl = data.settings.spotify.playlistUrl;
  const playlistId = data.settings.spotify.playlistId || SPOTIFY_ID(playlistUrl);
  const trainingUrl = data.settings.spotify.trainingPlaylistUrl;
  const water = waterDay(data, today());

  const quickTools: Array<{ id: string; label: string; desc: string; icon: typeof Timer; onClick: () => void; accent?: boolean }> = [
    { id: 'rest', label: 'Descanso', desc: 'Cronómetro con aviso', icon: Timer, onClick: () => setTool('rest') },
    { id: 'pomodoro', label: 'Pomodoro', desc: '25 / 5 / 15 min', icon: Sparkles, onClick: () => setTool('pomodoro') },
    { id: 'note', label: 'Nota rápida', desc: 'Capturá una idea', icon: NotebookPen, onClick: () => actions.openNote() },
    { id: 'water', label: 'Agua +250', desc: `${fmtMl(water, data.profile.units)} hoy`, icon: Droplets, onClick: () => { mutateData((d) => addWater(d, 250)); toast.success('+250 ml'); } },
    { id: 'converter', label: 'Unidades', desc: 'kg · lb · km · oz', icon: Ruler, onClick: () => setTool('converter') },
    { id: 'load', label: 'Cargas', desc: '1RM y porcentajes', icon: TrendingUp, onClick: () => setTool('load') },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Integraciones y herramientas</p>
          <h1 className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink">Todo lo que usás, a un toque.</h1>
          <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-muted">
            Herramientas que funcionan de verdad, más accesos a lo externo. Sin integraciones simuladas.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setCommand(true)}><Sparkles size={14} /> Buscar</button>
          <button className="btn btn-primary" onClick={() => setLinkModal(true)}><Plus size={14} /> Acceso directo</button>
        </div>
      </section>

      {/* quick access */}
      <section>
        <SectionHead title="Quick access" subtitle="Las herramientas que más se usan, siempre a mano." />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {quickTools.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={item.onClick} className="card card-pad group text-left transition-all hover:-translate-y-0.5 hover:border-accent-line">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel-2 text-muted transition-colors group-hover:border-accent-line group-hover:text-accent"><Icon size={15} /></span>
                <p className="mt-2 text-[0.79rem] font-medium text-ink">{item.label}</p>
                <p className="text-[0.65rem] text-faint">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* spotify */}
      <section className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <Card className="card-pad">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-[0.88rem] font-semibold text-ink"><Music size={15} className="text-accent" /> Música para entrenar</h3>
              <p className="mt-0.5 text-[0.74rem] text-muted">Playlist embebida con el reproductor oficial de Spotify.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSpotifyEdit(true)}>Configurar</button>
          </div>

          {playlistId ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              <iframe
                title="Playlist de Spotify"
                src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                width="100%"
                height="352"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                compact
                icon={<Music size={18} />}
                title="Todavía no hay playlist configurada"
                description="Pegá el link de una playlist pública de Spotify. El embed es oficial y no necesita que inicies sesión; reproducir desde el embed sí requiere cuenta de Spotify."
                action={<button className="btn btn-primary btn-sm" onClick={() => setSpotifyEdit(true)}>Agregar playlist</button>}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn btn-secondary btn-sm" href={playlistUrl || 'https://open.spotify.com'} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={12} /> Abrir Spotify Web
            </a>
            {playlistId ? (
              <a className="btn btn-secondary btn-sm" href={`spotify:playlist:${playlistId}`}>
                <Music size={12} /> Abrir en la app
              </a>
            ) : null}
            {trainingUrl ? (
              <a className="btn btn-ghost btn-sm" href={trainingUrl} target="_blank" rel="noreferrer noopener">
                <ArrowUpRight size={12} /> Playlist de entrenamiento
              </a>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-faint">Qué se puede y qué no</p>
            <ul className="mt-1 space-y-0.5 text-[0.71rem] leading-relaxed text-muted">
              <li>· El reproductor embebido es el widget oficial: funciona con playlists y álbumes públicos.</li>
              <li>· La app abre Spotify Web o la aplicación instalada mediante enlaces oficiales.</li>
              <li>· Controlar tu reproducción, leer tus playlists privadas o tu historial requiere iniciar sesión con OAuth de Spotify: no se simula acá.</li>
            </ul>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="card-pad">
            <SectionHead title="Estado del día" subtitle="Contexto rápido antes de entrenar." />
            <div className="space-y-2">
              <MiniRow label="Hábitos" value={`${dayHabitProgress(data, today()).done}/${dayHabitProgress(data, today()).scheduled}`} pct={dayHabitProgress(data, today()).pct} />
              <MiniRow label="Agua" value={fmtMl(water, data.profile.units)} pct={(water / data.settings.waterGoalMl) * 100} />
              <MiniRow label="Entrenamientos hoy" value={String(sessionsInRange(data, today(), today()).length)} pct={sessionsInRange(data, today(), today()).length ? 100 : 0} />
              <MiniRow label="Comidas registradas" value={String(dayNutrition(data, today()).meals)} pct={(dayNutrition(data, today()).meals / 3) * 100} />
            </div>
          </Card>
          <Card className="card-pad">
            <SectionHead title="Accesos personalizados" subtitle="Tus links externos." action={<button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => setLinkModal(true)} aria-label="Agregar acceso"><Plus size={14} /></button>} />
            {data.settings.quickLinks.length === 0 ? (
              <p className="text-[0.73rem] leading-relaxed text-faint">Agregá tus links (videos, planillas, campus, playlists) para tenerlos a mano.</p>
            ) : (
              <div className="space-y-1">
                {data.settings.quickLinks.map((link) => (
                  <div key={link.id} className="group flex items-center gap-2">
                    <a href={link.url} target="_blank" rel="noreferrer noopener" className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 hover:bg-panel-2">
                      <Link2 size={11} className="shrink-0 text-faint" />
                      <span className="truncate text-[0.76rem] text-ink-soft">{link.label}</span>
                      <ExternalLink size={10} className="shrink-0 text-faint" />
                    </a>
                    <button
                      className="opacity-0 transition hover:text-danger group-hover:opacity-100"
                      onClick={() => mutateData((d) => { d.settings.quickLinks = d.settings.quickLinks.filter((l) => l.id !== link.id); })}
                      aria-label="Eliminar acceso"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* tools grid */}
      <section>
        <SectionHead title="Herramientas" subtitle="Cálculos y temporizadores que se ejecutan en tu dispositivo." />
        <div className="grid gap-3 lg:grid-cols-3">
          <RestTimer />
          <UnitConverter />
          <LoadCalculator />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <MiniCalendar />
        <Card className="card-pad">
          <SectionHead title="Calendario" subtitle="Vista rápida del mes." />
          <CalendarLegend />
        </Card>
      </section>

      <Modals tool={tool} onClose={() => setTool(null)} spotifyOpen={spotifyEdit} onCloseSpotify={() => setSpotifyEdit(false)} linkOpen={linkModal} onCloseLink={() => setLinkModal(false)} />
    </div>
  );
}

function MiniRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[0.72rem]">
        <span className="text-muted">{label}</span>
        <span className="num text-ink-soft">{value}</span>
      </div>
      <Meter value={Math.min(100, pct)} height={4} />
    </div>
  );
}

function CalendarLegend() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[0.72rem]"><span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-accent" /> Tareas con vencimiento</span><span className="text-faint">punto verde</span></div>
      <div className="flex items-center justify-between text-[0.72rem]"><span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-info" /> Entrenamientos</span><span className="text-faint">punto azul</span></div>
      <div className="flex items-center justify-between text-[0.72rem]"><span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-warn" /> Check-ins</span><span className="text-faint">punto ámbar</span></div>
      <div className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-[0.71rem] leading-relaxed text-faint">
        Tocá un día para ver el detalle y saltar a la sección correspondiente. El calendario usa tus datos reales.
      </div>
      <button className="btn btn-secondary btn-sm w-full" onClick={() => window.location.assign('#/productivity')}>
        <CalendarDays size={13} /> Planificación semanal
      </button>
    </div>
  );
}

function MiniCalendar() {
  const data = useAppStore((s) => s.data);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(today());
  const t = today();

  const [year, month] = useMemo(() => {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    return [d.getFullYear(), d.getMonth()];
  }, [monthOffset]);
  const matrix = useMemo(() => monthMatrix(new Date(year, month, 1), 1), [year, month]);

  const tasks = data.tasks.filter((x) => x.dueDate === selected);
  const sessions = sessionsInRange(data, selected, selected);
  const checkin = data.checkins.find((c) => c.date === selected);

  return (
    <Card className="card-pad">
      <div className="flex items-center justify-between">
        <SectionHead className="!mb-0" title="Calendario" subtitle="Tus registros por día." />
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Mes anterior">‹</button>
          <span className="min-w-[92px] text-center text-[0.72rem] capitalize text-muted">{MONTH_LONG[month]} {year}</span>
          <button className="btn btn-ghost btn-icon !h-7 !w-7" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_MIN.map((d, i) => <span key={`${d}-${i}`} className="text-center text-[0.56rem] text-faint">{d}</span>)}
        {matrix.flat().map((day) => {
          const inMonth = new Date(day + 'T12:00:00').getMonth() === month;
          const hasTask = data.tasks.some((x) => x.dueDate === day && x.status !== 'done');
          const hasSession = data.sessions.some((x) => x.date === day && x.status === 'completed');
          const hasCheckin = data.checkins.some((c) => c.date === day);
          const isToday = day === t;
          return (
            <button
              key={day}
              onClick={() => setSelected(day)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-[5px] text-[0.65rem] transition-colors',
                !inMonth && 'opacity-25',
                selected === day ? 'border border-accent-line bg-accent-soft text-ink' : isToday ? 'bg-panel-3 text-ink' : 'text-muted hover:bg-panel-2',
              )}
            >
              <span className="num">{new Date(day + 'T12:00:00').getDate()}</span>
              <span className="mt-0.5 flex gap-0.5">
                {hasTask ? <span className="h-1 w-1 rounded-full bg-accent" /> : null}
                {hasSession ? <span className="h-1 w-1 rounded-full bg-info" /> : null}
                {hasCheckin ? <span className="h-1 w-1 rounded-full bg-warn" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-line pt-2.5">
        <p className="text-[0.72rem] font-medium capitalize text-ink">{fmtDateLong(selected)}</p>
        <div className="mt-1.5 space-y-1">
          {sessions.map((s) => <p key={s.id} className="flex items-center gap-1.5 text-[0.71rem] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-info" /> {s.name}</p>)}
          {tasks.slice(0, 4).map((task) => <p key={task.id} className="flex items-center gap-1.5 text-[0.71rem] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {task.title}</p>)}
          {checkin ? <p className="flex items-center gap-1.5 text-[0.71rem] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-warn" /> Check-in: {checkin.sleepH ?? '—'} h de sueño</p> : null}
          {!sessions.length && !tasks.length && !checkin ? <p className="text-[0.71rem] text-faint">Sin registros este día.</p> : null}
        </div>
      </div>
    </Card>
  );
}

function Modals({ tool, onClose, spotifyOpen, onCloseSpotify, linkOpen, onCloseLink }: {
  tool: ToolId; onClose: () => void; spotifyOpen: boolean; onCloseSpotify: () => void; linkOpen: boolean; onCloseLink: () => void;
}) {
  return (
    <>
      <Modal open={tool === 'rest'} onClose={onClose} title="Cronómetro de descanso" size="sm"><RestTimer /></Modal>
      <Modal open={tool === 'converter'} onClose={onClose} title="Calculadora de unidades" size="sm"><UnitConverter /></Modal>
      <Modal open={tool === 'load'} onClose={onClose} title="Progresión de cargas" size="md"><LoadCalculator /></Modal>
      <Modal open={tool === 'pomodoro'} onClose={onClose} title="Pomodoro" size="sm"><Pomodoro /></Modal>
      <SpotifyModal open={spotifyOpen} onClose={onCloseSpotify} />
      <LinkModal open={linkOpen} onClose={onCloseLink} />
    </>
  );
}

function SpotifyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const spotify = useAppStore((s) => s.data.settings.spotify);
  const toast = useToast();
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [trainingUrl, setTrainingUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (open && !loaded) {
    setPlaylistUrl(spotify.playlistUrl);
    setTrainingUrl(spotify.trainingPlaylistUrl);
    setLoaded(true);
  }

  const save = () => {
    const id = SPOTIFY_ID(playlistUrl);
    if (playlistUrl && !id) return setError('El link tiene que ser de una playlist: open.spotify.com/playlist/…');
    mutateData((d) => {
      d.settings.spotify = { playlistUrl: playlistUrl.trim(), playlistId: id, trainingPlaylistUrl: trainingUrl.trim() };
    });
    toast.success('Spotify actualizado', id ? 'La playlist ya aparece embebida.' : 'Sin playlist embebida.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); setLoaded(false); }}
      title="Configurar Spotify"
      size="sm"
      description="Solo links públicos. No se piden credenciales."
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => { onClose(); setLoaded(false); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Link de la playlist" error={error} hint="Ej. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M">
          <Input value={playlistUrl} onChange={(e) => { setPlaylistUrl(e.target.value); setError(null); }} placeholder="https://open.spotify.com/playlist/…" invalid={!!error} />
        </Field>
        <Field label="Playlist para entrenar (opcional)" hint="Se abre en un clic desde Extensions.">
          <Input value={trainingUrl} onChange={(e) => setTrainingUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/…" />
        </Field>
        <div className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-[0.71rem] leading-relaxed text-faint">
          Para el embed hace falta que la playlist sea pública. Si es privada, el reproductor va a pedir iniciar sesión en Spotify.
          Controlar la reproducción desde la app requeriría OAuth oficial, que no está incluido.
        </div>
      </div>
    </Modal>
  );
}

function LinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!label.trim()) return setError('Poné un nombre.');
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      return setError('La URL no es válida.');
    }
    mutateData((d) => {
      d.settings.quickLinks.push({ id: uid('link'), label: label.trim(), url: normalized });
    });
    toast.success('Acceso agregado', label.trim());
    setLabel(''); setUrl(''); setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => { setLabel(''); setUrl(''); setError(null); onClose(); }}
      title="Nuevo acceso directo"
      size="sm"
      description="Un link externo que querés tener a mano."
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => { setLabel(''); setUrl(''); setError(null); onClose(); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Agregar</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre" required>
          <Input value={label} onChange={(e) => { setLabel(e.target.value); setError(null); }} placeholder="Ej. Campus virtual" autoFocus />
        </Field>
        <Field label="URL" required error={error}>
          <Input value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://…" invalid={!!error} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Spotify', url: 'https://open.spotify.com' },
            { label: 'Google Calendar', url: 'https://calendar.google.com' },
            { label: 'YouTube', url: 'https://youtube.com' },
          ].map((preset) => (
            <button key={preset.label} className="chip chip-outline" onClick={() => { setLabel(preset.label); setUrl(preset.url); }}>{preset.label}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

void Badge; void Calculator; void fmtDateShort; void weekday; void greeting; void EmptyState;
