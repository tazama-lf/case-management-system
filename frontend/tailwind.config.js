/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Brand Colors for Tazama Case Management System
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Main primary
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Secondary accent colors
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569', // Main secondary
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Success colors (for approved actions, completed cases)
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a', // Main success
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Warning colors (for pending alerts, review needed)
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706', // Main warning
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Danger/Error colors (for critical alerts, failed actions)
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626', // Main danger
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Alert priority colors
        priority: {
          low: '#22c55e',    // Green
          medium: '#f59e0b', // Amber
          high: '#f97316',   // Orange
          critical: '#dc2626', // Red
        },
        // Case status colors
        status: {
          draft: '#6b7280',
          pending: '#f59e0b',
          assigned: '#3b82f6',
          progress: '#8b5cf6',
          suspended: '#ef4444',
          closed: '#22c55e',
          reopened: '#f97316',
        },
        // Neutral grays for backgrounds and text
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      // Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      // Spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // Border radius
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      // Box shadows
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'popup': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      // Animation
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' },
        },
      },
      // Backdrop blur
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      // Grid template columns
      gridTemplateColumns: {
        'sidebar': '250px 1fr',
        'sidebar-collapsed': '64px 1fr',
        'dashboard': 'repeat(auto-fit, minmax(300px, 1fr))',
      },
      // Z-index
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },
    },
  },
  plugins: [
    // Custom component classes
    function({ addComponents, theme }) {
      addComponents({
        // Button variants
        '.btn': {
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.md'),
          fontWeight: theme('fontWeight.medium'),
          fontSize: theme('fontSize.sm'),
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
        '.btn-primary': {
          backgroundColor: theme('colors.primary.600'),
          color: theme('colors.white'),
          '&:hover': {
            backgroundColor: theme('colors.primary.700'),
          },
          '&:focus': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${theme('colors.primary.200')}`,
          },
        },
        '.btn-secondary': {
          backgroundColor: theme('colors.secondary.100'),
          color: theme('colors.secondary.800'),
          '&:hover': {
            backgroundColor: theme('colors.secondary.200'),
          },
          '&:focus': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${theme('colors.secondary.200')}`,
          },
        },
        '.btn-danger': {
          backgroundColor: theme('colors.danger.600'),
          color: theme('colors.white'),
          '&:hover': {
            backgroundColor: theme('colors.danger.700'),
          },
          '&:focus': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${theme('colors.danger.200')}`,
          },
        },
        '.btn-outline': {
          backgroundColor: 'transparent',
          color: theme('colors.primary.600'),
          borderWidth: '1px',
          borderColor: theme('colors.primary.600'),
          '&:hover': {
            backgroundColor: theme('colors.primary.600'),
            color: theme('colors.white'),
          },
        },
        
        // Card components
        '.card': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.lg'),
          boxShadow: theme('boxShadow.card'),
          padding: theme('spacing.6'),
          border: `1px solid ${theme('colors.gray.200')}`,
        },
        '.card-dark': {
          backgroundColor: theme('colors.gray.800'),
          borderColor: theme('colors.gray.700'),
          color: theme('colors.gray.100'),
        },
        
        // Form elements
        '.input': {
          width: '100%',
          padding: `${theme('spacing.2')} ${theme('spacing.3')}`,
          borderRadius: theme('borderRadius.md'),
          borderWidth: '1px',
          borderColor: theme('colors.gray.300'),
          fontSize: theme('fontSize.sm'),
          '&:focus': {
            outline: 'none',
            borderColor: theme('colors.primary.500'),
            boxShadow: `0 0 0 3px ${theme('colors.primary.200')}`,
          },
          '&::placeholder': {
            color: theme('colors.gray.400'),
          },
        },
        
        // Priority badges
        '.badge-priority-low': {
          backgroundColor: theme('colors.success.100'),
          color: theme('colors.success.800'),
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.md'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.medium'),
        },
        '.badge-priority-medium': {
          backgroundColor: theme('colors.warning.100'),
          color: theme('colors.warning.800'),
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.md'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.medium'),
        },
        '.badge-priority-high': {
          backgroundColor: theme('colors.orange.100'),
          color: theme('colors.orange.800'),
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.md'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.medium'),
        },
        '.badge-priority-critical': {
          backgroundColor: theme('colors.danger.100'),
          color: theme('colors.danger.800'),
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.md'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.medium'),
        },
        
        // Status badges
        '.badge-status': {
          padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
          borderRadius: theme('borderRadius.md'),
          fontSize: theme('fontSize.xs'),
          fontWeight: theme('fontWeight.medium'),
        },
        
        // Layout helpers
        '.page-container': {
          maxWidth: theme('maxWidth.7xl'),
          margin: '0 auto',
          padding: `${theme('spacing.6')} ${theme('spacing.4')}`,
        },
        '.sidebar-width': {
          width: '250px',
        },
        '.sidebar-collapsed-width': {
          width: '64px',
        },
      })
    }
  ],
}
