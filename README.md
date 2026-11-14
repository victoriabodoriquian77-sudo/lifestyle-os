# Personal Lifestyle OS

Centro de operaciones personal para entrenamiento, nutrición, hábitos y productividad. Todo funciona en el navegador, sin cuentas ni servidores: los datos se guardan en el dispositivo y se pueden exportar cuando quieras.

## Cómo correrlo

Requiere Node 20+ (probado con Node 24).

```bash
cd lifestyle-os
npm install
npm run dev      # http://127.0.0.1:5180
npm run build    # typecheck + build de producción en dist/
npm run preview  # sirve el build en http://127.0.0.1:4180
```

En esta Mac, si `node`/`npm` no están en el PATH:

```bash
export PATH="$HOME/bin:$PATH"
export npm_config_cache=/tmp/npmcache   # ~/.npm no es escribible en esta máquina
```

## Qué incluye

### Overview
Saludo y fecha/hora en vivo, frase del día, **Daily Performance** (score compuesto con desglose), hábitos de hoy, entrenamiento del día, tareas pendientes, resumen nutricional, agua, racha, objetivos semanales, consistencia de hábitos e insights.

### Gym
- Rutinas con ejercicios, series, reps objetivo, descanso y observaciones. Crear, editar, duplicar y eliminar.
- **Importación real** de `.xlsx`, `.xls`, `.ods` y `.csv` con SheetJS (Google Sheets: Archivo → Descargar → Excel/CSV). Detecta hojas, filas de encabezado, sinónimos ES/EN, días de la semana, secciones, formatos `3x12`, descansos `1:30` / `2 min` / `90` y pesos de referencia. Muestra una vista previa editable antes de guardar.
- Modo entrenamiento a pantalla completa: ejercicio actual, series hechas/pendientes, peso anterior, reps objetivo, completar serie, descanso automático con cuenta regresiva, presets 30/60/90/120/180, tiempo personalizado, pausa, reinicio, sonido y notificación.
- Historial de sesiones, volumen, duración, progresión por ejercicio (peso máximo y 1RM estimado con Epley), récords personales y detección de PR al terminar.

### Nutrition
- Registro manual por comida (Desayuno, Almuerzo, Merienda, Cena, Snacks), comida libre o items con cantidad/unidad, kcal y macros opcionales, fecha y hora.
- Editar, eliminar, repetir una comida de otro día, guardar favoritas y recetas reutilizables.
- Navegación por día, totales, agua, balance del día, tabla de 14 días e historial; gráficos de kcal y macros por rango.
- Sin metas calóricas rígidas ni juicios: el registro es opcional y la copia lo dice explícitamente.

### Habits
- CRUD completo, frecuencia diaria / días fijos / veces por semana, veces por día, hora sugerida, ícono y color.
- Marcas por día, rachas actual y mejor racha, consistencia semanal/mensual, calendario mensual clickeable y mini-mapa de los últimos 14 días.
- Lista de hábitos sugeridos que solo se crea si la persona lo pide.

### Productivity
- Tareas con vencimiento, prioridad, categoría, proyecto, subtareas, notas y tiempo estimado.
- Vista Hoy con agenda, vencidas, próximos 7 días y sin fecha; vista de todas las tareas con filtros y búsqueda.
- Proyectos con progreso y fecha límite; categorías transversales.
- Notas con búsqueda, etiquetas y fijado.
- Planificación semanal en bloques horarios (calendario 6–24 h) con tipos, edición y vínculo a tareas.
- Pomodoro configurable (25/5/15 por defecto), registro de bloques de foco, objetivos semanales y estadísticas.

### Progress
Series y estadísticas de entrenamiento, hábitos, productividad, nutrición y bienestar (sueño, energía, ánimo, recuperación). Incluye **pesajes semanales**: un registro por semana, tendencia de peso, diferencia contra el pesaje anterior y actualización del peso del perfil. Filtros 7 / 30 / 90 / 180 días / todo el historial. Cada gráfico explica cómo empezar cuando no hay datos: **no hay datos de ejemplo ni valores inventados**.

### Extensions
- Quick access a descanso, Pomodoro, nota rápida, agua, unidades y calculadora de cargas.
- Spotify mediante el **embed oficial** de playlists públicas y enlaces a la app/web. No se simula OAuth ni control de reproducción.
- Cronómetro de descanso independiente, conversor de unidades, calculadora de 1RM con tabla de porcentajes, calendario mensual con registros y accesos directos personalizados.

### Smart Insights
Reglas determinísticas sobre datos reales: frecuencia y volumen de entrenamiento, progreso/estancamiento, PR, desbalance muscular, hábitos, tareas postergadas, foco, sueño, recuperación, regularidad alimentaria y agua. Sin diagnósticos médicos, sin dietas extremas, sin recomendaciones de privación de sueño.

### Settings
Perfil, foco, objetivo, altura/peso, unidades, tema claro/oscuro, cuatro acentos, metas (agua, sueño, entrenamientos, descanso, calorías y macros opcionales), sonido/vibración, notificaciones del navegador, exportación JSON/CSV, importación con reemplazo confirmado, borrado total, estado de integraciones y accesos al contenido.

## Persistencia y privacidad

- Adaptador en `src/store/storage.ts`: **IndexedDB** (`personal-lifestyle-os` / store `kv`) con espejo en `localStorage` (`plos-data-v1`) y escrituras debounced (300 ms). Se hace flush en `pagehide`, `beforeunload` y `visibilitychange`.
- No hay backend, analytics ni requests de datos. Las fuentes Inter se sirven desde el bundle.
- Exportación completa en JSON y CSV por dominio. La importación pasa por `normalizeData()` para tolerar versiones viejas.
- Si `localStorage` supera su límite, IndexedDB sigue siendo la fuente principal; la app muestra el tamaño aproximado en Settings.

### Migrar a Supabase

`storage.ts` expone una interfaz mínima (`getItem`/`setItem`). Para sincronizar:

1. Crear un proyecto Supabase y una tabla `app_state (user_id uuid primary key, data jsonb, updated_at timestamptz)` con RLS por usuario.
2. Reemplazar el adaptador local por uno que lea/escriba esa fila (o el mapa completo `AppData`).
3. Mantener el mismo `AppData` serializable: no hay clases ni funciones en el estado.
4. Añadir autenticación (magic link o email) y migrar el JSON existente con la exportación actual.

No se incluyen credenciales ni configuración de Supabase porque no fue provista.

## Configurar Spotify

En **Extensions → Configurar** se pega el link de una playlist pública:

```
https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
```

Se extrae el ID y se muestra el iframe oficial (`open.spotify.com/embed/playlist/<id>`). Para playlists privadas el embed pide iniciar sesión. Controlar la reproducción, leer playlists privadas o el historial requiere OAuth de Spotify (Client ID + redirect URI + backend de intercambio de tokens), que **no** está incluido y no se simula.

## Arquitectura

```
src/
  types.ts              modelo AppData completo (serializable)
  lib/
    metrics.ts          estadísticas derivadas puras
    insights.ts         reglas de Smart Insights
    importer.ts         parseo XLSX/CSV y heurísticas
    muscle.ts           detección de grupo muscular (sin cargar xlsx)
    domain.ts           mutaciones de dominio
    backup.ts           exportación JSON/CSV
    date.ts, utils.ts   fechas y formato es-AR
  store/                zustand + persist + IndexedDB
  components/           UI kit, layout, charts, modales, gym, productivity
  pages/                una página por sección
  hooks/                countdown y recordatorios
```

- Estado único `AppData` con zustand + immer; todas las escrituras pasan por `mutateData`.
- Router propio por hash (`#/gym`) con `useSyncExternalStore`, sin dependencia de react-router.
- Tailwind 3 con tokens en variables CSS (`--bg`, `--panel`, `--accent`, …) y tema por `data-theme`/`data-accent`.
- Recharts para series, barras, donuts y sparklines.
- El importador se carga con `import()` dinámico: SheetJS no entra en el bundle inicial.

## Notas del entorno de desarrollo

En esta Mac el Node firmado por el harness no puede cargar módulos nativos de Rollup/LightningCSS (`different Team IDs`). Por eso:

- `rollup` está aliaseado a `@rollup/wasm-node` en `overrides` de `package.json`.
- Se usa Tailwind 3 + PostCSS (JS puro) en lugar de Tailwind 4 + LightningCSS.

En una instalación normal de Node se puede volver a Tailwind 4 y al Rollup nativo quitando el override y el pipeline de PostCSS.

## Estado

v1.0. Todas las secciones, formularios, botones y persistencia fueron probados de punta a punta: alta de hábito con racha persistida, comida con macros, rutina creada a mano, sesión completa con serie y descanso, importación real de XLSX/CSV, backup JSON restaurado, temas y perfil persistentes, y layouts sin desborde horizontal en 390 px y 1440 px.
