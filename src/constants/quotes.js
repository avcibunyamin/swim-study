// Çalışma süresine göre motivasyon sözleri.
// Çalışma bitince (work session sona erince) toast olarak gösterilir.

const QUOTES_TR = {
  short: [   // 1-9 dk
    'İyi bir başlangıç! 🌱',
    'Her dakika bir adım. 👣',
    'Devam et, ısınıyorsun. 🔥',
    'Kısa da olsa odaklandın, helal! 🧠',
    'Az çok demeden devam. 💪',
  ],
  medium: [  // 10-24 dk
    'Güzel iş! Beynin ısındı. 🧠✨',
    'Tutarlı çalışmak başarıyı getirir. 🎯',
    'Bu temponu seviyorum, devam! 🔥',
    'Odakta kalmak süper güç. ⚡️',
    'Mola hak ettin, sonra döneriz. ☕️',
  ],
  good: [    // 25-44 dk
    'Mükemmel pomodoro! 🍅 Tam 25+ dk odak.',
    'Beynin teşekkür ediyor. 🧠❤️',
    'Bir akış (flow) bulduğun belli oldu. 🌊',
    'Bu odak seviyesi disiplinin meyvesi. 🍎',
    'Sürdürülebilir tempo budur işte. ⚡️',
  ],
  great: [   // 45-89 dk
    'Vay be, gerçekten iş çıkardın! 🚀',
    'Derin odak. Bunun karşılığı büyük. 💎',
    'Mola çok hak edildi, hak ediyorsun. ☕️🏆',
    'Konsantrasyon piri sensin. 🧘',
    'Bugün gelecekteki sana yatırım yaptın. 📈',
  ],
  legend: [  // 90+ dk
    'EFSANE! 🏆 90+ dk kesintisiz odak.',
    'Bu seviyede çalışmak ayrı bir lig. 🥇',
    'Tebrikler, bu sıradan bir gün değil. 🌟',
    'Effort. Bunun karşılığı kesinlikle gelir. 💯',
    'Beynine teşekkür et, sen de çok iyisin. 🙌',
  ],
};

const QUOTES_EN = {
  short: [
    'Great start! 🌱',
    'Every minute counts. 👣',
    'Keep going, you\'re warming up. 🔥',
    'Even short focus is real focus. 🧠',
    'No focus is too small. 💪',
  ],
  medium: [
    'Nice work! Brain is warmed up. 🧠✨',
    'Consistency wins the long game. 🎯',
    'Loving this pace, keep at it! 🔥',
    'Focus is a superpower. ⚡️',
    'Break time — earned. ☕️',
  ],
  good: [
    'Perfect pomodoro! 🍅 25+ min of focus.',
    'Your brain thanks you. 🧠❤️',
    'You found flow. 🌊',
    'This is the fruit of discipline. 🍎',
    'Sustainable focus, right here. ⚡️',
  ],
  great: [
    'Wow, real work happened! 🚀',
    'Deep focus pays compound interest. 💎',
    'You\'ve earned this break, big time. ☕️🏆',
    'A focus champion. 🧘',
    'Future-you just got an upgrade. 📈',
  ],
  legend: [
    'LEGEND! 🏆 90+ min of pure focus.',
    'This is another league. 🥇',
    'Today is not an ordinary day. 🌟',
    'Pure effort. It will pay off. 💯',
    'Thank your brain — you\'re elite. 🙌',
  ],
};

const tierFor = (minutes) => {
  if (minutes < 10)  return 'short';
  if (minutes < 25)  return 'medium';
  if (minutes < 45)  return 'good';
  if (minutes < 90)  return 'great';
  return 'legend';
};

/**
 * Çalışma süresine göre rastgele motivasyon sözü döndürür.
 * @param {number} secs - çalışılan saniye
 * @param {string} lang - 'tr' | 'en'
 */
export function getMotivationQuote(secs, lang = 'tr') {
  const minutes = Math.floor(secs / 60);
  const tier = tierFor(minutes);
  const pool = (lang === 'tr' ? QUOTES_TR : QUOTES_EN)[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}
