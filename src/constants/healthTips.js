// Sağlık tavsiyeleri. Çalışma sırasında belli aralıklarla toast olarak gösterilir.
// Her tavsiye türünün kendi periyodu var — son gösterimden bu kadar süre geçince
// tekrar gösterilir.

// Periyot saniye cinsinden. Tüm tavsiyeler isteğe bağlı (ayarlardan kapatılabilir).
export const HEALTH_TIPS = [
  {
    id: 'eyes',
    intervalSecs: 20 * 60, // 20-20-20 kuralı
    tr: { title: '👀 Göz molası', body: '20 saniye boyunca uzaktaki bir noktaya bak.' },
    en: { title: '👀 Eye break', body: 'Look at something far away for 20 seconds.' },
  },
  {
    id: 'water',
    intervalSecs: 30 * 60,
    tr: { title: '💧 Su iç', body: 'Bir bardak su iç, beynine iyi gelir.' },
    en: { title: '💧 Hydrate', body: 'Drink a glass of water — your brain will thank you.' },
  },
  {
    id: 'breath',
    intervalSecs: 45 * 60,
    tr: { title: '🌬 Derin nefes', body: '4 saniye al, 4 saniye tut, 6 saniye ver.' },
    en: { title: '🌬 Breathe', body: '4-sec inhale, 4-sec hold, 6-sec exhale.' },
  },
  {
    id: 'stretch',
    intervalSecs: 60 * 60,
    tr: { title: '🤸 Kısa esneme', body: 'Ayağa kalk, 1-2 dakika gerin ve hareket et.' },
    en: { title: '🤸 Quick stretch', body: 'Stand up, stretch, move for 1-2 mins.' },
  },
];

/**
 * Verilen oturum süresine ve son gösterim zamanlarına göre, şu an gösterilmesi
 * gereken sağlık tavsiyesini döner. Birden fazla tip aynı anda dolarsa rastgele biri.
 *
 * @param {number} sessionSecs   - Bu çalışmada şu ana kadar geçen saniye
 * @param {object} lastShown     - { eyes: secs, water: secs, ... } son gösterim anı
 * @returns {object|null}        - { id, intervalSecs, tr, en } veya null
 */
export function getDueHealthTip(sessionSecs, lastShown = {}) {
  const due = HEALTH_TIPS.filter(tip => {
    const last = lastShown[tip.id] || 0;
    return sessionSecs - last >= tip.intervalSecs;
  });
  if (due.length === 0) return null;
  // Birden fazla aynı anda due ise rastgele birini seç
  return due[Math.floor(Math.random() * due.length)];
}
