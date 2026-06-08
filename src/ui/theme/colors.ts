/** Color tokens. Brand/urgency hex come from docs/design CSS; surfaces sampled from PNG. */
export const colors = {
  text: '#2C2A26',
  textSecondary: '#5C574F',
  textMuted: '#6E6960',
  textFaint: '#8A8378',
  brandBlue: '#3E6BC8',
  screenBg: '#F7F4EF',
  cardBg: '#FFFFFF',
  surfaceSoft: '#F4F1EB',
  white: '#FFFFFF',
  urgency: {
    urgent: { base: '#C25A45', tintBg: '#F3DED9' },
    upcoming: { base: '#C2883B', tintBg: '#F2E4CC' },
    calm: { base: '#5F8A67', tintBg: '#DCE7DD' },
  },
} as const;
