import type { Config } from 'tailwindcss';

/** Los colores viven en variables CSS (tema claro/oscuro y acentos). */
const token = (name: string): string =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('--bg'),
        'bg-deep': token('--bg-deep'),
        panel: token('--panel'),
        'panel-2': token('--panel-2'),
        'panel-3': token('--panel-3'),
        line: token('--line'),
        'line-strong': token('--line-strong'),
        ink: token('--text'),
        'ink-soft': token('--text-soft'),
        muted: token('--muted'),
        faint: token('--faint'),
        accent: token('--accent'),
        'accent-bright': token('--accent-bright'),
        'accent-ink': token('--accent-ink'),
        'accent-soft': token('--accent-soft'),
        'accent-line': token('--accent-line'),
        ok: token('--ok'),
        warn: token('--warn'),
        danger: token('--danger'),
        info: token('--info'),
        'ring-track': token('--ring-track'),
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
} satisfies Config;
