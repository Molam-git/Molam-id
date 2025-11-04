/**
 * Theme configuration pour Molam ID Mobile
 * Design system identique au web
 */

export const theme = {
  colors: {
    primary: '#0066cc',
    primaryDark: '#0052a3',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',

    // Backgrounds
    background: '#ffffff',
    backgroundSecondary: '#f8f9fa',

    // Text
    text: '#212529',
    textMuted: '#6c757d',

    // Borders
    border: '#dee2e6',

    // Dark mode
    dark: {
      background: '#1a1a1a',
      backgroundSecondary: '#2a2a2a',
      text: '#ffffff',
      textMuted: '#a0a0a0',
      border: '#404040',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  fontWeight: {
    normal: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
  },
};

export type Theme = typeof theme;
