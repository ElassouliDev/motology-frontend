import type { Config } from 'tailwindcss'

/** Colours are CSS variables (RGB channels) defined in globals.css, so light and dark themes share every class. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          soft: token('brand-soft'),
          fg: token('brand-fg'),
        },
        accent: { DEFAULT: token('accent'), fg: token('accent-fg') },
        forest: token('forest'),
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        ink: token('ink'),
        muted: token('muted'),
        border: token('border'),
        ok: token('ok'),
        warn: token('warn'),
        bad: token('bad'),
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.04), 0 1px 1px rgb(var(--shadow) / 0.03)',
        lift: '0 12px 32px -12px rgb(var(--shadow) / 0.18), 0 2px 6px rgb(var(--shadow) / 0.05)',
        ring: '0 0 0 4px rgb(var(--brand) / 0.15)',
      },
      animation: {
        'msg-in': 'msgIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'scale-in': 'scaleIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fadeIn 0.4s ease',
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        msgIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
