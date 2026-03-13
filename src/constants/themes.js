// Tema: DB'de smallint (1=light, 2=ocean, 3=dark)
export const THEME_IDS  = { light: 1, ocean: 2, dark: 3 };
export const THEME_KEYS = { 1: 'light', 2: 'ocean', 3: 'dark' };

// Durum: DB'de smallint (1=available, 2=busy, 3=hidden)
export const STATUS_IDS  = { available: 1, busy: 2, hidden: 3 };
export const STATUS_KEYS = { 1: 'available', 2: 'busy', 3: 'hidden' };

export const themes = {
  light: { key: 'light', bg: 'bg-gradient-to-br from-sky-50 to-cyan-50', card: 'bg-white/95 border-slate-300 shadow-sm', text: 'text-slate-800', textMuted: 'text-slate-600', input: 'bg-slate-50 border-slate-400', nav: 'bg-white border-slate-300 shadow-sm', modal: 'bg-white', slider: '#cbd5e1', accent: 'text-blue-700', accentSecondary: 'text-indigo-600', accentBreak: 'text-emerald-700', accentGrad: 'from-blue-700 to-indigo-600', accentBg: 'bg-blue-700', accentBgSecondary: 'bg-indigo-600', accentRing: 'ring-blue-500', accentBorder: 'border-blue-500/30', accentBgSoft: 'bg-blue-900/50', accentBorderSoft: 'border-blue-500/30' },
  ocean: { key: 'ocean', bg: 'bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900', card: 'bg-gray-900 border-gray-800', text: 'text-gray-100', textMuted: 'text-gray-500', input: 'bg-gray-800 border-gray-700', nav: 'bg-gray-950 border-gray-800', modal: 'bg-gray-900', slider: '#1f2937', accent: 'text-teal-400', accentSecondary: 'text-cyan-400', accentBreak: 'text-emerald-400', accentGrad: 'from-teal-600 to-cyan-600', accentBg: 'bg-teal-600', accentBgSecondary: 'bg-cyan-600', accentRing: 'ring-teal-400', accentBorder: 'border-teal-500/30', accentBgSoft: 'bg-teal-900/50', accentBorderSoft: 'border-teal-500/30' },
  dark: { key: 'dark', bg: 'bg-black', card: 'bg-zinc-950 border-zinc-800', text: 'text-gray-100', textMuted: 'text-gray-500', input: 'bg-zinc-900 border-zinc-800', nav: 'bg-black border-zinc-900', modal: 'bg-zinc-950', slider: '#18181b', accent: 'text-teal-400', accentSecondary: 'text-cyan-400', accentBreak: 'text-emerald-400', accentGrad: 'from-teal-600 to-cyan-600', accentBg: 'bg-teal-600', accentBgSecondary: 'bg-cyan-600', accentRing: 'ring-teal-400', accentBorder: 'border-teal-500/30', accentBgSoft: 'bg-teal-900/50', accentBorderSoft: 'border-teal-500/30' }
};
