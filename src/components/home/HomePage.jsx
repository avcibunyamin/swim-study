import React, { useState, useEffect, memo } from 'react';
import { Calendar, BarChart3, Trophy, ChevronLeft, ChevronRight, Heart, Quote, Check, WifiOff, Clock, Target } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmtSecs, fmtShort } from '../../utils/formatters';
import Logo from '../ui/Logo';

const HomePage = memo(({
  theme, pagePadding,
  userData, totalStudySecs,
  currentAchievement, nextAchievement,
  studyHistory,
  statsPeriod, setStatsPeriod, statsOffset, setStatsOffset,
  stats, plans, savePlans, isOnline,
}) => {
  const { t, ta } = useLanguage();
  const [homeTab, setHomeTab] = useState('plans');
  const maxSecs = Math.max(...(stats.chartData || []).map(d => d.secs), 1);
  const today   = new Date().toISOString().split('T')[0];
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

      {!isOnline && (
        <div className="bg-yellow-600 rounded-xl p-2 mb-4 text-white text-sm text-center flex items-center justify-center gap-2">
          <WifiOff size={16} />{t('home.offline')}
        </div>
      )}

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

      {/* Tab seçici */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setHomeTab('plans')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 ${
            homeTab === 'plans'
              ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white'
              : `${theme.input} border ${theme.text}`
          }`}
        >
          <Calendar size={16} />{t('home.plans')}
        </button>
        <button
          onClick={() => setHomeTab('stats')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 ${
            homeTab === 'stats'
              ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white'
              : `${theme.input} border ${theme.text}`
          }`}
        >
          <BarChart3 size={16} />{t('home.performance')}
        </button>
      </div>

      {/* Planlar */}
      {homeTab === 'plans' && (
        <>
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
                      {p.date === today ? t('home.today') : p.date}
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
        </>
      )}

      {/* İstatistikler */}
      {homeTab === 'stats' && (
        <div className={`${theme.card} rounded-2xl p-4 mb-4 border`}>
          {/* Periyot seçici */}
          <div className="flex gap-2 mb-3">
            {['day', 'week', 'month', 'year'].map(p => (
              <button
                key={p}
                onClick={() => { setStatsPeriod(p); setStatsOffset(0); }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                  statsPeriod === p
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white'
                    : `${theme.input} border ${theme.text}`
                }`}
              >
                {t(`stats.${p}`)}
              </button>
            ))}
          </div>

          {/* Dönem navigasyonu */}
          <div className="flex justify-between items-center mb-3">
            <button onClick={() => setStatsOffset(o => o + 1)} className={`p-2 rounded-lg ${theme.input} border`}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium">{stats.periodLabel}</span>
            <button
              onClick={() => setStatsOffset(o => Math.max(0, o - 1))}
              disabled={statsOffset === 0}
              className={`p-2 rounded-lg ${theme.input} border ${statsOffset === 0 ? 'opacity-30' : ''}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Özet kartlar */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <Clock size={16} className="mx-auto text-cyan-400 mb-1" />
              <p className="font-bold">{fmtShort(stats.totalSecs, t)}</p>
              <p className={`text-[10px] ${theme.textMuted}`}>{t('home.thisPeriod')}</p>
            </div>
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <Target size={16} className="mx-auto text-emerald-400 mb-1" />
              <p className="font-bold">{fmtShort(totalStudySecs, t)}</p>
              <p className={`text-[10px] ${theme.textMuted}`}>{t('home.total')}</p>
            </div>
          </div>

          {/* Ana sütun grafik — toplam */}
          <p className={`text-xs font-bold ${theme.textMuted} mb-2`}>{t('home.performance')}</p>
          <div className="h-40 flex items-end gap-1 mb-2">
            {(stats.chartData || []).map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className={`text-[11px] ${theme.text} mb-1 font-bold`}>{d.secs > 0 ? fmtShort(d.secs, t) : ''}</span>
                <div
                  className={`w-full rounded-t transition-all ${d.secs > 0 ? 'bg-gradient-to-t from-teal-600 to-cyan-400' : theme.input}`}
                  style={{ height: `${Math.max((d.secs / maxSecs) * 70, 4)}px`, minHeight: '4px' }}
                />
                <span className={`text-[11px] ${theme.text} mt-1 font-bold`}>{d.label}</span>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
});

export default HomePage;
