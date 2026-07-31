import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Target, Flame, Trophy } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmtShort } from '../../utils/formatters';
import Logo from '../ui/Logo';
import StudyHeatmap from './StudyHeatmap';

const PerformancePage = memo(({
  theme, pagePadding,
  totalStudySecs,
  currentStreak, longestStreak,
  currentAchievement, nextAchievement,
  statsPeriod, setStatsPeriod,
  statsOffset, setStatsOffset,
  stats,
  studyHistory, weekStart,
}) => {
  const { t } = useLanguage();
  const maxSecs = Math.max(...(stats.chartData || []).map(d => d.secs), 1);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="text-center py-2"><Logo size="sm" centered /></div>
      {/* Seri (Streak) */}
      <div className={`${theme.card} rounded-xl p-4 mb-4 border`}>
        <h3 className="font-bold text-orange-400 mb-3 flex items-center gap-2">
          <Flame size={18} />{t('streak.title')}
        </h3>
        {currentStreak === 0 && longestStreak === 0 ? (
          <p className={`text-sm ${theme.textMuted} text-center py-1`}>{t('streak.none')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <p className="text-3xl font-black text-orange-400">{currentStreak}</p>
              <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>{t('streak.current')} ({t('streak.days')})</p>
            </div>
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <p className="text-3xl font-black text-yellow-400">{longestStreak}</p>
              <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>{t('streak.longest')} ({t('streak.days')})</p>
            </div>
          </div>
        )}
      </div>

      {/* Çalışma ısı haritası */}
      <StudyHeatmap theme={theme} studyHistory={studyHistory} weekStart={weekStart} />

      {/* Rozet ilerleme */}
      {nextAchievement && (
        <div className={`${theme.card} rounded-xl p-3 mb-4 border`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-teal-400 flex items-center gap-1">
              <Trophy size={14} />{t('home.next')}
            </span>
            <span className="text-xs">{nextAchievement.icon} {nextAchievement.title}</span>
          </div>
          <div className={`h-2 ${theme.input} rounded-full overflow-hidden`}>
            <div
              className={`h-full bg-gradient-to-r ${nextAchievement.color}`}
              style={{ width: `${Math.min((totalStudySecs / 3600) / nextAchievement.hours * 100, 100)}%` }}
            />
          </div>
          <p className={`text-xs ${theme.textMuted} mt-1`}>
            {Math.floor(totalStudySecs / 3600)}{t('time.h')} / {nextAchievement.hours}{t('time.h')}
          </p>
        </div>
      )}

      {/* İstatistikler */}
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

        {/* Sütun grafik */}
        <p className={`text-xs font-bold ${theme.textMuted} mb-2`}>{t('home.performance')}</p>
        <div className="h-40 flex items-end gap-1 mb-2">
          {(stats.chartData || []).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <span className={`text-[11px] ${theme.text} mb-1 font-bold`}>
                {d.secs > 0 ? fmtShort(d.secs, t) : ''}
              </span>
              <div
                className={`w-full rounded-t transition-all ${d.secs > 0 ? 'bg-gradient-to-t from-teal-600 to-cyan-400' : theme.input}`}
                style={{ height: `${Math.max((d.secs / maxSecs) * 70, 4)}px`, minHeight: '4px' }}
              />
              <span className={`text-[11px] ${theme.text} mt-1 font-bold`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default PerformancePage;
