/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card:        { DEFAULT: 'hsl(var(--card))',    foreground: 'hsl(var(--card-foreground))'    },
        popover:     { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary:     { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',   foreground: 'hsl(var(--muted-foreground))'   },
        accent:      { DEFAULT: 'hsl(var(--accent))',  foreground: 'hsl(var(--accent-foreground))'  },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',
        orange:  { DEFAULT: '#F97316', dark: '#EA580C', light: '#FED7AA', pale: '#FFF7ED', 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C' },
        success: { DEFAULT: '#16A34A' },
        warning: { DEFAULT: '#D97706' },
        danger:  { DEFAULT: '#DC2626' },
        info:    { DEFAULT: '#2563EB' },
        warm:    { 50: '#F5F0EB', 100: '#EDE8E2', 200: '#E0D9D2', 300: '#CCC7C0', 900: '#16100C' },
      },
      borderRadius: {
        DEFAULT: '0.875rem',
        lg: '1rem',
        xl: '1.125rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      keyframes: {
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer:   'shimmer 1.8s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out',
        'spin':    'spin 1s linear infinite',
      },
      boxShadow: {
        'orange':       '0 2px 8px rgba(249,115,22,0.3)',
        'orange-lg':    '0 8px 24px rgba(249,115,22,0.25)',
        'card':         '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover':   '0 4px 16px rgba(249,115,22,0.1), 0 1px 4px rgba(0,0,0,0.06)',
        'modal':        '0 24px 64px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
