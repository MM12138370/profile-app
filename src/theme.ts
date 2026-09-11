export const colors = {
  bg: '#F3F0EA',
  paper: '#FFFBF4',
  ink: '#1A1714',
  muted: '#6F675E',
  faint: '#A39A90',
  line: '#E6DFD4',
  accent: '#B44A2A',
  accentSoft: '#F4E4DC',
  good: '#2F6B4F',
  goodSoft: '#E3F0E8',
  warn: '#9A6B12',
  warnSoft: '#F6EDD8',
  danger: '#A33B2B',
  chip: '#EDE7DC',
  interviewer: '#EFE8DC',
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const type = {
  welcome: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  quote: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.muted,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
};
