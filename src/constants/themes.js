// Tema: DB'de smallint (1=light, 2=ocean, 3=dark)
export const THEME_IDS  = { light: 1, ocean: 2, dark: 3 };
export const THEME_KEYS = { 1: 'light', 2: 'ocean', 3: 'dark' };

// Durum: DB'de smallint (1=available, 2=busy, 3=hidden)
export const STATUS_IDS  = { available: 1, busy: 2, hidden: 3 };
export const STATUS_KEYS = { 1: 'available', 2: 'busy', 3: 'hidden' };

export const themes = {
  light: { key: 'light', bodyBg: '#f0f9ff', statusBarColor: '#f0f9ff', bg: 'bg-gradient-to-br from-sky-50 to-cyan-50', card: 'bg-white/95 border-slate-300 shadow-sm', text: 'text-slate-800', textMuted: 'text-slate-600', input: 'bg-slate-50 border-slate-400', nav: 'bg-white border-slate-300 shadow-sm', modal: 'bg-white', slider: '#cbd5e1', accent: 'text-blue-700', accentSecondary: 'text-indigo-600', accentBreak: 'text-emerald-700', accentGrad: 'from-blue-700 to-indigo-600', accentBg: 'bg-blue-700', accentBgSecondary: 'bg-indigo-600', accentRing: 'ring-blue-500', accentBorder: 'border-blue-500/30', accentBgSoft: 'bg-blue-900/50', accentBorderSoft: 'border-blue-500/30' },
  ocean: { key: 'ocean', bodyBg: '#020617', statusBarColor: '#020617', bg: 'bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950', card: 'bg-slate-900/80 border-slate-800', text: 'text-gray-100', textMuted: 'text-gray-500', input: 'bg-slate-900 border-slate-700', nav: 'bg-slate-950 border-slate-800', modal: 'bg-slate-900', slider: '#1e293b', accent: 'text-teal-400', accentSecondary: 'text-cyan-400', accentBreak: 'text-emerald-400', accentGrad: 'from-teal-600 to-cyan-600', accentBg: 'bg-teal-600', accentBgSecondary: 'bg-cyan-600', accentRing: 'ring-teal-400', accentBorder: 'border-teal-500/30', accentBgSoft: 'bg-teal-900/50', accentBorderSoft: 'border-teal-500/30' },
  dark: { key: 'dark', bodyBg: '#000000', statusBarColor: '#000000', bg: 'bg-black', card: 'bg-zinc-950 border-zinc-800', text: 'text-gray-100', textMuted: 'text-gray-500', input: 'bg-zinc-900 border-zinc-800', nav: 'bg-black border-zinc-900', modal: 'bg-zinc-950', slider: '#18181b', accent: 'text-teal-400', accentSecondary: 'text-cyan-400', accentBreak: 'text-emerald-400', accentGrad: 'from-teal-600 to-cyan-600', accentBg: 'bg-teal-600', accentBgSecondary: 'bg-cyan-600', accentRing: 'ring-teal-400', accentBorder: 'border-teal-500/30', accentBgSoft: 'bg-teal-900/50', accentBorderSoft: 'border-teal-500/30' }
};
