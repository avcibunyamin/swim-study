export const achievements = [
  { hours: 0, title: 'achievementTitles.0', icon: '\u{1FAE7}', color: 'from-slate-300 to-slate-400' },
  { hours: 1, title: 'achievementTitles.1', icon: '\u{1F41F}', color: 'from-blue-300 to-cyan-400' },
  { hours: 10, title: 'achievementTitles.2', icon: '\u{1F420}', color: 'from-orange-400 to-amber-500' },
  { hours: 50, title: 'achievementTitles.3', icon: '\u{1F421}', color: 'from-yellow-400 to-orange-500' },
  { hours: 100, title: 'achievementTitles.4', icon: '\u{1F419}', color: 'from-purple-400 to-violet-500' },
  { hours: 200, title: 'achievementTitles.5', icon: '\u{1FABC}', color: 'from-pink-400 to-rose-500' },
  { hours: 500, title: 'achievementTitles.6', icon: '\u{1F42C}', color: 'from-cyan-400 to-blue-500' },
  { hours: 1000, title: 'achievementTitles.7', icon: '\u{1F988}', color: 'from-slate-400 to-slate-600' },
  { hours: 2000, title: 'achievementTitles.8', icon: '\u{1F40B}', color: 'from-blue-500 to-indigo-600' },
  { hours: 5000, title: 'achievementTitles.9', icon: '\u{1F409}', color: 'from-emerald-400 to-teal-500' },
  { hours: 10000, title: 'achievementTitles.10', icon: '\u{1F531}', color: 'from-amber-400 to-yellow-500' }
];

export const getAchievement = (totalMins, ta) => {
  const h = totalMins / 60;
  let c = achievements[0];
  for (const a of achievements) if (h >= a.hours) c = a;
  const titles = ta ? ta('achievementTitles') : null;
  if (titles && Array.isArray(titles)) {
    const idx = achievements.indexOf(c);
    return { ...c, title: titles[idx] || c.title };
  }
  return c;
};

export const getEarnedAchievements = (totalMins, ta) => {
  const h = totalMins / 60;
  const titles = ta ? ta('achievementTitles') : null;
  return achievements.filter(a => h >= a.hours).map((a, i) => {
    if (titles && Array.isArray(titles)) {
      const idx = achievements.indexOf(a);
      return { ...a, title: titles[idx] || a.title };
    }
    return a;
  });
};

export const getNextAchievement = (totalMins, ta) => {
  const h = totalMins / 60;
  const titles = ta ? ta('achievementTitles') : null;
  for (const a of achievements) {
    if (h < a.hours) {
      if (titles && Array.isArray(titles)) {
        const idx = achievements.indexOf(a);
        return { ...a, title: titles[idx] || a.title };
      }
      return a;
    }
  }
  return null;
};
