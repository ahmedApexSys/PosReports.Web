/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Severity palette (mapped to API insight severity 0..4) ───────────
      // Driven by docs/business-intelligence/README.md §4 — these MUST match
      // the colour codes referenced in the API insight contracts.
      colors: {
        // Brand primary — Apex red (from the Apex Systems logo, ~#E2231A),
        // deepened at 700 so white text on primary buttons passes AA contrast.
        brand: {
          50:  '#FEF2F1',
          100: '#FCE0DE',
          200: '#F9C2BD',
          300: '#F2978F',
          400: '#EC5B50',
          500: '#E2231A',  // Apex red
          600: '#C41D15',
          700: '#A81813',  // primary (white text passes AA)
          800: '#8A1410',
          900: '#71120F',
          950: '#3F0907',
        },
        // Severity tones (Good / Info / Warning / High / Critical)
        good:     { DEFAULT: '#10B981', soft: '#D1FAE5', ring: '#34D399' },
        info:     { DEFAULT: '#3B82F6', soft: '#DBEAFE', ring: '#60A5FA' },
        warning:  { DEFAULT: '#F59E0B', soft: '#FEF3C7', ring: '#FBBF24' },
        high:     { DEFAULT: '#F97316', soft: '#FFEDD5', ring: '#FB923C' },
        critical: { DEFAULT: '#EF4444', soft: '#FEE2E2', ring: '#F87171' },
        // Surface tones — warm, not stark
        surface: {
          DEFAULT:    '#FAFAF9',  // light mode body
          subtle:     '#F5F5F4',
          muted:      '#E7E5E4',
          'dark':     '#0F172A',  // dark mode body
          'dark-subtle': '#1E293B',
          'dark-muted':  '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
        ar:   ['Tajawal', 'IBM Plex Arabic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Fluid scale — sm on mobile → larger on wide screens
        'kpi':     ['clamp(1.5rem, 2vw + 1rem, 3rem)', { lineHeight: '1', fontWeight: '700' }],
        'kpi-sm':  ['clamp(1.125rem, 1.5vw + 0.75rem, 2rem)', { lineHeight: '1.1', fontWeight: '700' }],
      },
      borderRadius: {
        'card':   '14px',
        'card-sm':'10px',
        'pill':   '999px',
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-dk': '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'popover': '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
      },
      transitionDuration: {
        '180': '180ms',
        '220': '220ms',
        '300': '300ms',
      },
      animation: {
        'fade-in':  'fadeIn 0.28s ease-out both',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in':   'popIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'shimmer':  'shimmer 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        popIn:   { '0%': { transform: 'scale(0.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
      },
      // Container max-width for wide screens (so 4K doesn't blow up line length)
      maxWidth: {
        'screen-3xl': '1920px',
      },
      screens: {
        // Custom breakpoints to match the prompt's responsive spec
        'xs':  '360px',
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1536px',
        '3xl': '1920px',  // 1080p Full HD
        '4xl': '2560px',  // QHD
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
