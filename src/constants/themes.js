// Tema: profilde smallint olarak tutulur (1=light, 2=ocean, 3=dark)
export const THEME_IDS  = { light: 1, ocean: 2, dark: 3 };
export const THEME_KEYS = { 1: 'light', 2: 'ocean', 3: 'dark' };

// Durum: smallint (1=available, 2=busy, 3=hidden)
export const STATUS_IDS  = { available: 1, busy: 2, hidden: 3 };
export const STATUS_KEYS = { 1: 'available', 2: 'busy', 3: 'hidden' };

// ─────────────────────────────────────────────────────────────────────────────
// Cam (frosted glass) yüzeyler
//
// Kartlar ve çubuklar arka planı bulanıklaştırıp altındaki rengi geçirir; derinlik
// tek renk bir yüzeyden değil, katmanlardan gelir. Bunun okunur olabilmesi için
// zeminin düz renk değil gradyan olması şart, yoksa bulanıklaştıracak bir şey
// kalmaz ve yüzey donuk görünür.
//
// backdrop-blur GPU'da compositor katmanı açar. Çok sayıda küçük öğeye
// uygulanırsa düşük donanımda kare düşürür; bu yüzden yalnızca büyük ve az
// sayıdaki yüzeylerde (kart, nav, modal) kullanılıyor — liste satırlarında değil.
// ─────────────────────────────────────────────────────────────────────────────

export const themes = {
  // Aydınlık — soğuk beyaz yerine hafif sıcak, katmanlı bir zemin.
  // Eski hali sky-50→cyan-50 üstünde white/95 kart kullanıyordu; kart ile zemin
  // arasında neredeyse hiç kontrast yoktu ve slate-400 kenarlıklar sert kalıyordu.
  light: {
    key: 'light',
    bodyBg: '#eef4fb',
    statusBarColor: '#eef4fb',
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100',
    card: 'bg-white/70 backdrop-blur-xl border-white/60 shadow-lg shadow-slate-900/5',
    // Yoğun içerikli yüzeyler (ısı haritası gibi) için blur'suz varyant
    cardSolid: 'bg-white border-slate-200 shadow-lg shadow-slate-900/5',
    // Isı haritasının boş hücresi. theme.input KULLANILMAMALI: içindeki
    // backdrop-blur 364 hücrede 364 compositor katmanı açar.
    heatEmpty: 'bg-slate-200/70',
    text: 'text-slate-900',
    // slate-500 beyaz üstünde 4.76:1 veriyordu — AA eşiğini (4.5) kıl payı
    // geçiyor ve etiketlerin çoğu 10px. slate-600 ile 7.4:1'e çıkıyor.
    textMuted: 'text-slate-600',
    input: 'bg-white/60 backdrop-blur-md border-slate-200/80',
    nav: 'bg-white/70 backdrop-blur-2xl border-white/60 shadow-lg shadow-slate-900/5',
    modal: 'bg-white/85 backdrop-blur-2xl',
    slider: '#cbd5e1',
    // Lacivert. Turkuaz beyaz üstünde 1.86:1 veriyordu — AA eşiğinin (4.5)
    // üçte biri, yani pratikte görünmüyordu. Bu tonlar 9-11:1 aralığında.
    accent: 'text-blue-900',
    accentSecondary: 'text-indigo-800',
    accentBreak: 'text-emerald-800',
    accentGrad: 'from-blue-900 to-indigo-700',
    accentBg: 'bg-blue-900',
    accentBgSecondary: 'bg-indigo-800',
    accentRing: 'ring-blue-800',
    accentBorder: 'border-blue-900/30',
    accentBgSoft: 'bg-blue-50',
    accentBorderSoft: 'border-blue-900/20',
    // Isı haritası yoğunluk basamakları da temaya bağlı: aydınlıkta lacivert,
    // koyu temalarda teal. Bileşende sabit kodlanırsa tema değişimi işlemez.
    heatLevels: ['bg-blue-900/20', 'bg-blue-900/45', 'bg-blue-900/70', 'bg-blue-900'],
  },

  // Okyanus — eskiden slate-950/gray-950 idi, yani Gece temasından ayırt
  // edilemiyordu. Artık gerçekten mavi: derin lacivertten teal'e inen bir zemin.
  ocean: {
    key: 'ocean',
    bodyBg: '#04121f',
    statusBarColor: '#04121f',
    bg: 'bg-gradient-to-br from-[#04121f] via-[#062a3d] to-[#02141c]',
    card: 'bg-cyan-950/40 backdrop-blur-xl border-cyan-400/15 shadow-lg shadow-black/40',
    cardSolid: 'bg-[#07202e] border-cyan-400/15 shadow-lg shadow-black/40',
    heatEmpty: 'bg-cyan-400/10',
    text: 'text-cyan-50',
    // /45 zemin üstünde 3.59:1 veriyordu, AA eşiğinin (4.5) altında.
    // /70 ile ~5.4:1'e çıkıyor ve hâlâ ana metinden belirgin şekilde soluk.
    textMuted: 'text-cyan-200/70',
    input: 'bg-cyan-950/50 backdrop-blur-md border-cyan-400/15',
    nav: 'bg-[#04121f]/75 backdrop-blur-2xl border-cyan-400/15',
    modal: 'bg-[#062331]/90 backdrop-blur-2xl',
    slider: '#0b3a4d',
    accent: 'text-teal-300',
    accentSecondary: 'text-cyan-300',
    accentBreak: 'text-emerald-300',
    accentGrad: 'from-teal-500 to-cyan-500',
    accentBg: 'bg-teal-600',
    accentBgSecondary: 'bg-cyan-600',
    accentRing: 'ring-teal-300',
    accentBorder: 'border-teal-400/30',
    accentBgSoft: 'bg-teal-500/15',
    accentBorderSoft: 'border-teal-400/25',
    heatLevels: ['bg-teal-500/25', 'bg-teal-500/50', 'bg-teal-500/75', 'bg-teal-500'],
  },

  // Gece — OLED ekranlarda siyah pikselin kapanması için saf siyah korunuyor.
  // Cam etkisi burada bilinçli olarak zayıf: arkada bulanıklaştıracak renk yok.
  dark: {
    key: 'dark',
    bodyBg: '#000000',
    statusBarColor: '#000000',
    bg: 'bg-black',
    card: 'bg-zinc-900/60 backdrop-blur-xl border-white/10',
    cardSolid: 'bg-zinc-900 border-white/10',
    heatEmpty: 'bg-zinc-800',
    text: 'text-gray-100',
    textMuted: 'text-gray-500',
    input: 'bg-zinc-900/70 backdrop-blur-md border-white/10',
    nav: 'bg-black/80 backdrop-blur-2xl border-white/10',
    modal: 'bg-zinc-900/90 backdrop-blur-2xl',
    slider: '#18181b',
    accent: 'text-teal-400',
    accentSecondary: 'text-cyan-400',
    accentBreak: 'text-emerald-400',
    accentGrad: 'from-teal-600 to-cyan-600',
    accentBg: 'bg-teal-600',
    accentBgSecondary: 'bg-cyan-600',
    accentRing: 'ring-teal-400',
    accentBorder: 'border-teal-500/30',
    accentBgSoft: 'bg-teal-900/50',
    accentBorderSoft: 'border-teal-500/30',
    heatLevels: ['bg-teal-500/25', 'bg-teal-500/50', 'bg-teal-500/75', 'bg-teal-500'],
  },
};
