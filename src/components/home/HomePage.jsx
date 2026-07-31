import React, { useState, useEffect, memo } from 'react';
import { Calendar, Trophy, Heart, Quote, Check, WifiOff, Clock } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmtSecs, localDateStr } from '../../utils/formatters';
import Logo from '../ui/Logo';

const HomePage = memo(({
  theme, pagePadding,
  userData, totalStudySecs,
  currentAchievement, nextAchievement,
  plans, savePlans, isOnline,
}) => {
  const { t, ta, lang } = useLanguage();

  const fmtPlanDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric', month: 'long', weekday: 'long',
    }).format(date);
  };
  const today = localDateStr();
  const allPlans = plans || [];

  const futurePlans = allPlans
    .filter(p => p.date >= today)
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const togglePlan = (planId) => {
    if (!savePlans) return;
    savePlans(allPlans.map(p => p.id === planId ? { ...p, completed: !p.completed } : p));
  };

  const quotes     = ta('quotes')     || [];
  const healthTips = ta('healthTips') || [];
  const [quoteIdx,    setQuoteIdx]    = useState(0);
  const [healthTipIdx, setHealthTipIdx] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setQuoteIdx(q => (q + 1) % (quotes.length || 1)), 5000);
    return () => clearInterval(i);
  }, [quotes.length]);
  useEffect(() => {
    const i = setInterval(() => setHealthTipIdx(h => (h + 1) % (healthTips.length || 1)), 30000);
    return () => clearInterval(i);
  }, [healthTips.length]);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="text-center py-4">
        <Logo size="md" centered />
        <p className="text-teal-400 text-sm mt-1">{t('home.hello', { username: userData?.username })}</p>
      </div>


      {/* Rozet */}
      <div className="flex justify-center mb-4">
        <div className={`flex items-center gap-3 ${theme.card} rounded-full px-4 py-2 border`}>
          <span className="text-3xl">{userData?.avatar || '🐟'}</span>
          <div>
            <div className={`text-sm bg-gradient-to-r ${currentAchievement.color} bg-clip-text text-transparent font-bold`}>
              {currentAchievement.icon} {currentAchievement.title}
            </div>
            <div className={`text-xs ${theme.textMuted}`}>{fmtSecs(totalStudySecs, t)}</div>
          </div>
        </div>
      </div>

      {/* Sonraki rozet */}
      {nextAchievement && (
        <div className={`${theme.card} rounded-xl p-3 mb-4 border`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-teal-400 flex items-center gap-1"><Trophy size={14} />{t('home.next')}</span>
            <span className="text-xs">{nextAchievement.icon} {nextAchievement.title}</span>
          </div>
          <div className={`h-2 ${theme.input} rounded-full overflow-hidden`}>
            <div className={`h-full bg-gradient-to-r ${nextAchievement.color}`} style={{ width: `${Math.min((totalStudySecs / 3600) / nextAchievement.hours * 100, 100)}%` }} />
          </div>
          <p className={`text-xs ${theme.textMuted} mt-1`}>{Math.floor(totalStudySecs / 3600)}{t('time.h')} / {nextAchievement.hours}{t('time.h')}</p>
        </div>
      )}

      {/* Sağlık ipucu */}
      {healthTips.length > 0 && (
        <div className={`${theme.card} rounded-xl p-3 mb-4 border border-emerald-500/30 bg-emerald-900/20`}>
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">{healthTips[healthTipIdx % healthTips.length]}</p>
          </div>
        </div>
      )}

      {/* Alıntı */}
      {quotes.length > 0 && (
        <div className={`${theme.card} rounded-xl p-3 mb-4 border`}>
          <div className="flex gap-2">
            <Quote size={18} className="text-teal-400 flex-shrink-0" />
            <div>
              <p className="text-sm italic">{quotes[quoteIdx % quotes.length]?.text}</p>
              <p className="text-xs text-cyan-400 mt-1">— {quotes[quoteIdx % quotes.length]?.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Planlar */}
      <h2 className="font-bold text-cyan-400 mb-2 flex items-center gap-2 text-sm">
        <Calendar size={16} />{t('home.upcomingPlans')}
      </h2>
      <div className="space-y-2 mb-4">
        {futurePlans.length === 0 ? (
          <p className={`${theme.textMuted} text-sm text-center py-4`}>{t('home.noPlans')}</p>
        ) : (
          futurePlans.slice(0, 10).map(p => (
            <div
              key={p.id}
              className={`${theme.card} rounded-xl p-3 border-l-4 border flex items-center gap-2 ${
                p.completed
                  ? 'border-l-emerald-500 bg-emerald-900/20'
                  : p.date === today
                    ? 'border-l-emerald-500 bg-emerald-900/10'
                    : 'border-l-teal-500'
              }`}
            >
              <button onClick={() => togglePlan(p.id)} className="flex-shrink-0">
                {p.completed ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${p.completed ? 'line-through opacity-60' : ''}`}>{p.title}</p>
                <p className={`text-xs flex items-center gap-1 ${p.date === today ? 'text-emerald-400' : theme.textMuted}`}>
                  {p.date === today ? t('home.today') : fmtPlanDate(p.date)}
                  {p.time && (
                    <span className="text-cyan-400 flex items-center gap-0.5">
                      <Clock size={9} />{p.time}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default HomePage;
