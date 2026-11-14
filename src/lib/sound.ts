/** Sonidos breves generados con WebAudio: sin archivos externos y sin permisos. */

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
};

export const playBeep = (kind: 'end' | 'tick' | 'success' = 'end', enabled = true): void => {
  if (!enabled) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();

  const notes = kind === 'success' ? [660, 880] : kind === 'tick' ? [520] : [880, 880, 1174];
  const now = audio.currentTime;
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
};

export const vibrate = (pattern: number | number[] = 80): void => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* noop */ }
  }
};

export const notify = (title: string, body: string): void => {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, silent: false });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* noop */ }
  }
};
