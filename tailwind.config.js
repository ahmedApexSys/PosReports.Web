/** @type {import('tailwindcss').Config} */

// ── Palette switch ───────────────────────────────────────────────────────────
// 'neutral' = the till's "Apex POS Dark" design (owner, 2026-11-03: the reports
// the same look as the till). 'original' = the slate / navy this app shipped
// with - kept below untouched; set PALETTE to 'original' and rebuild to go back.
const PALETTE = 'neutral';

const SURFACES = {
  original: {
    DEFAULT:    '#FAFAF9',  // light mode body
    subtle:     '#F5F5F4',
    muted:      '#E7E5E4',
    'dark':     '#0F172A',  // dark mode body
    'dark-subtle': '#1E293B',
    'dark-muted':  '#334155',
  },
  // The design's page / card / raised / line, light and dark.
  neutral: {
    DEFAULT:    '#F4F4F2',
    subtle:     '#F1F1EF',
    muted:      '#E6E6E3',
    'dark':     '#202124',
    'dark-subtle': '#2A2B2F',
    'dark-muted':  '#3E3F45',
  },
};

// The app's 1,700 `slate-*` utilities (text, borders, dark cards) re-pointed at
// the design's neutral greys instead of Tailwind's blue-grey. Same steps, same
// roles: 900/800 are the dark cards, 100/200 the light lines, 500/600 muted ink.
// Type follows the palette: the till's Manrope / Bricolage Grotesque / Noto
// Sans Arabic with 'neutral', the app's own Inter / Tajawal with 'original'.
const FONTS = {
  original: {
    sans: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
    ar:   ['Tajawal', 'IBM Plex Arabic', 'system-ui', 'sans-serif'],
    display: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
  },
  neutral: {
    sans: ['Manrope', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
    ar:   ['Noto Sans Arabic', 'Manrope', 'system-ui', 'sans-serif'],
    display: ['Bricolage Grotesque', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
  },
};

const NEUTRAL_SLATE = {
  50:  '#FAFAF9',
  100: '#F4F4F2',
  200: '#E6E6E3',
  300: '#D4D4D0',
  400: '#A6A6AC',
  500: '#75746F',
  600: '#5C5B56',
  700: '#45443F',
  800: '#2A2B2F',
  900: '#202124',
  950: '#121212',
};

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
        // Surface tones - see PALETTE at the top of the file.
        surface: SURFACES[PALETTE],
        ...(PALETTE === 'neutral' ? { slate: NEUTRAL_SLATE } : {}),
      },
      fontFamily: {
        ...FONTS[PALETTE],
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
        'card-lg': '0 12px 32px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.04)',
        'popover': '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
        'glow-brand': '0 0 0 3px rgba(226,35,26,0.12)',
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
