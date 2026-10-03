/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /* ── Color Tokens ─────────────────────────────────────── */
      colors: {
        /* Design-system tokens. Values live in index.css as RGB channels so every class
           (including /opacity variants) follows the light / dark theme automatically. */
        royal: {
          900: v('royal-900'),
          700: v('royal-700'),
          500: v('royal-500'),
          100: v('royal-100'),
          DEFAULT: v('royal-500'),
        },
        cream: {
          50: v('cream-50'),
          100: v('cream-100'),
          200: v('cream-200'),
          DEFAULT: v('cream-100'),
        },
        ink: {
          900: v('ink-900'),
          500: v('ink-500'),
        },
        card: v('card'),
        sunken: v('sunken'),
        bed: {
          available: v('bed-available'),
          occupied: v('bed-occupied'),
          cleaning: v('bed-cleaning'),
          reserved: v('bed-reserved'),
          blocked: v('bed-blocked'),
        },
        /* Readable status text on either theme */
        fg: {
          ok: v('fg-ok'),
          warn: v('fg-warn'),
          bad: v('fg-bad'),
          info: v('fg-info'),
          violet: v('fg-violet'),
        },
        highlight: v('highlight'),
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },
        surface: {
          DEFAULT: v('cream-50'),
          alt: v('sunken'),
          hover: v('sunken'),
          elevated: v('cream-50'),
          sunken: v('sunken'),
          border: v('cream-200'),
          foreground: v('ink-900'),
          muted: v('ink-500'),
        },
        background: v('cream-100'),
        border: v('cream-200'),
        muted: v('ink-500'),
        'muted-foreground': v('ink-500'),
        foreground: v('ink-900'),

        /* Status colors */
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },

      /* ── Font Family ──────────────────────────────────────── */
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },

      /* ── Shadows ──────────────────────────────────────────── */
      boxShadow: {
        'card':     '0 0 0 0 transparent',
        'card-lg':  '0 0 0 0 transparent',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        'modal':    '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'glow':     '0 0 20px rgb(20 184 166 / 0.15)',
        'soft':     '0 0 0 0 transparent',
        'neon':     '0 0 10px currentColor',
      },

      /* ── Border Radius ────────────────────────────────────── */
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      /* ── Spacing (8px grid) ───────────────────────────────── */
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
        '34':  '8.5rem',
        '38':  '9.5rem',
        '42':  '10.5rem',
        'sidebar': '16.5rem',
        'sidebar-collapsed': '4.5rem',
        'topbar': '4rem',
      },

      /* ── Animations ───────────────────────────────────────── */
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(59 130 246 / 0.45)' },
          '50%':      { boxShadow: '0 0 0 8px rgb(59 130 246 / 0)' },
        },
        'pulse-root': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(239 68 68 / 0.55)' },
          '50%':      { boxShadow: '0 0 0 8px rgb(239 68 68 / 0)' },
        },
        'pulse-critical': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(239 68 68 / 0.4)' },
          '50%':      { boxShadow: '0 0 0 6px rgb(239 68 68 / 0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in':         'fade-in 200ms ease-out',
        'fade-in-up':      'fade-in-up 300ms ease-out',
        'slide-in-right':  'slide-in-right 250ms ease-out',
        'slide-in-left':   'slide-in-left 250ms ease-out',
        'scale-in':        'scale-in 200ms ease-out',
        'pulse-glow':      'pulse-glow 2s ease-in-out infinite',
        'pulse-critical':  'pulse-critical 1.5s ease-in-out infinite',
        'pulse-root':      'pulse-root 1.6s ease-in-out infinite',
        'shimmer':         'shimmer 2s linear infinite',
        'spin-slow':       'spin-slow 3s linear infinite',
      },

      /* ── Transitions ──────────────────────────────────────── */
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
};
