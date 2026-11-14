import { create } from 'zustand';

/** Estado efímero de interfaz (no se persiste). */
interface UIState {
  sidebarOpen: boolean;
  commandOpen: boolean;
  quickAddOpen: boolean;
  moreOpen: boolean;
  /** Sesión de entrenamiento que se está ejecutando en el modo entrenamiento. */
  activeSessionId: string | null;
  setSidebar: (v: boolean) => void;
  setCommand: (v: boolean) => void;
  setQuickAdd: (v: boolean) => void;
  setMore: (v: boolean) => void;
  openWorkout: (sessionId: string) => void;
  closeWorkout: () => void;
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: false,
  commandOpen: false,
  quickAddOpen: false,
  moreOpen: false,
  activeSessionId: null,
  setSidebar: (v) => set({ sidebarOpen: v }),
  setCommand: (v) => set({ commandOpen: v }),
  setQuickAdd: (v) => set({ quickAddOpen: v }),
  setMore: (v) => set({ moreOpen: v }),
  openWorkout: (sessionId) => set({ activeSessionId: sessionId }),
  closeWorkout: () => set({ activeSessionId: null }),
}));
