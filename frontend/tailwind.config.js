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
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        surface: {
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        success: { DEFAULT: '#10B981', muted: 'rgba(16,185,129,0.1)' },
        warning: { DEFAULT: '#F59E0B', muted: 'rgba(245,158,11,0.1)' },
        danger:  { DEFAULT: '#EF4444', muted: 'rgba(239,68,68,0.1)'  },
        info:    { DEFAULT: '#3B82F6', muted: 'rgba(59,130,246,0.1)' },
        violet:  '#7C3AED',
        cyan:    '#22D3EE',
        emerald: '#10B981',
        amber:   '#F59E0B',
        rose:    '#F43F5E',
        sky:     '#38BDF8',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
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
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0'  },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        shimmer:      'shimmer 2s linear infinite',
        'fade-up':    'fade-up 0.3s ease-out',
        'fade-in':    'fade-in 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      boxShadow: {
        'glow-violet': '0 0 24px rgba(124,58,237,0.25)',
        'glow-cyan':   '0 0 24px rgba(34,211,238,0.2)',
        'glow-green':  '0 0 24px rgba(16,185,129,0.2)',
        card:          '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.4)',
        modal:         '0 24px 80px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'gradient-violet': 'linear-gradient(135deg, #7C3AED, #6366F1)',
        'gradient-cyan':   'linear-gradient(135deg, #0EA5E9, #22D3EE)',
        'gradient-green':  'linear-gradient(135deg, #059669, #10B981)',
        'gradient-sunset': 'linear-gradient(135deg, #F43F5E, #F97316)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
