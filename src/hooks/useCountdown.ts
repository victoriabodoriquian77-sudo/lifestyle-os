import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cuenta regresiva basada en timestamps (no acumula deriva al cambiar de
 * pestaña). Se usa en el descanso del gym, el Pomodoro y las herramientas.
 */
export function useCountdown(initialSeconds: number, onComplete?: () => void) {
  const [duration, setDuration] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const endRef = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  const firedRef = useRef(false);

  completeRef.current = onComplete;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endRef.current == null) return;
      const left = Math.max(0, (endRef.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        endRef.current = null;
        if (!firedRef.current) {
          firedRef.current = true;
          completeRef.current?.();
        }
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback((seconds?: number) => {
    const secs = seconds ?? (remaining > 0 ? remaining : duration);
    const total = Math.max(1, secs);
    setDuration(total);
    setRemaining(total);
    firedRef.current = false;
    endRef.current = Date.now() + total * 1000;
    setRunning(true);
  }, [remaining, duration]);

  const pause = useCallback(() => {
    if (endRef.current != null) setRemaining(Math.max(0, (endRef.current - Date.now()) / 1000));
    endRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback((seconds?: number) => {
    const secs = seconds ?? duration;
    setDuration(secs);
    setRemaining(secs);
    setRunning(false);
    endRef.current = null;
    firedRef.current = false;
  }, [duration]);

  const addTime = useCallback((seconds: number) => {
    setRemaining((r) => Math.max(0, r + seconds));
    if (endRef.current != null) endRef.current += seconds * 1000;
    setDuration((d) => Math.max(1, d + seconds));
  }, []);

  return { duration, remaining, running, start, pause, reset, addTime, setDuration, progress: duration > 0 ? 1 - remaining / duration : 0 };
}
