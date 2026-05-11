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
        // Brand primary — deep teal, restaurant-warm but professional
        brand: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',  // primary
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
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
