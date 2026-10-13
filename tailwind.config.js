/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        editorial: {
          ground: '#FAFAF9',
          surface: '#FFFFFF',
          elevated: '#F4F4F5',
          ink: '#090D16',
          muted: '#52525B',
          subtle: '#71717A',
          hairline: '#E4E4E7',
          strong: '#D4D4D8',
          active: '#2563EB',
        },
        spectrum: {
          cobalt: '#2563EB',
          downstream: '#10B981',
          upstream: '#06B6D4',
          video: '#8B5CF6',
          fault: '#EF4444',
          jacket: '#FACC15',
        },
        // Legacy `noc-*` utilities now resolve to the light engineering-lab palette,
        // keeping existing component layouts while replacing the dark NOC theme.
        noc: {
          950: '#F8FAFC',
          900: '#FFFFFF',
          850: '#F8FAFC',
          800: '#F1F5F9',
          700: '#E2E8F0',
          600: '#CBD5E1',
          500: '#64748B',
          400: '#64748B',
          300: '#475569',
          200: '#0F172A',
          100: '#0F172A',
        },
        optical: {
          green: '#16A34A',
          amber: '#A16207',
          red: '#DC2626',
          purple: '#7C3AED',
          idle: '#64748B',
          cyan: '#2563EB',
        },
        // Use AA-friendly text shades for status/accent utilities that were
        // originally selected for a dark surface.
        sky: {
          200: '#1D4ED8',
          300: '#2563EB',
          400: '#1D4ED8',
        },
        emerald: {
          200: '#166534',
          300: '#166534',
          400: '#15803D',
        },
        amber: {
          200: '#92400E',
          300: '#92400E',
          400: '#A16207',
        },
        red: {
          200: '#991B1B',
          300: '#B91C1C',
          400: '#B91C1C',
        },
        purple: {
          200: '#6B21A8',
          300: '#7E22CE',
          400: '#7E22CE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Newsreader', 'Instrument Serif', 'Iowan Old Style', 'Palatino Linotype', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(37,99,235,0.22), 0 4px 16px -8px rgba(37,99,235,0.28)',
        panel: '0 1px 2px rgba(15,23,42,0.06), 0 12px 26px -20px rgba(15,23,42,0.22)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.6' },
          '70%': { transform: 'scale(2.1)', opacity: '0' },
          '100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        'sweep': {
          '0%': { opacity: '0.25' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.25' },
        },
        'mission-check-in': {
          '0%': { transform: 'scale(0.7)', opacity: '0.4' },
          '65%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'mission-drawer-in': {
          '0%': { transform: 'translateX(24px)', opacity: '0.8' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24,0,0.38,1) infinite',
        sweep: 'sweep 1.4s ease-in-out infinite',
        'mission-check-in': 'mission-check-in 260ms cubic-bezier(0.2,0.8,0.2,1) both',
        'mission-drawer-in': 'mission-drawer-in 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
