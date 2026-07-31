import React from 'react';
import { Target } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmtShort } from '../../utils/formatters';

// Bugünkü çalışmanın günlük hedefe oranını gösteren çubuk.
// goalMins 0 ise hedef kapalıdır ve hiçbir şey render edilmez.
const DailyGoalBar = ({ theme, todaySecs, goalMins }) => {
  const { t } = useLanguage();
  if (!goalMins) return null;

  const goalSecs = goalMins * 60;
  const pct      = Math.min((todaySecs / goalSecs) * 100, 100);
  const reached  = todaySecs >= goalSecs;

  return (
    <div className={`${theme.card} rounded-xl p-3 mb-4 border`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm flex items-center gap-1.5 text-teal-400">
          <Target size={14} />{t('goal.title')}
        </span>
        <span className={`text-xs ${theme.textMuted}`}>
          {fmtShort(todaySecs, t)} / {fmtShort(goalSecs, t)}
        </span>
      </div>
      <div className={`h-2 ${theme.input} rounded-full overflow-hidden`}>
        <div
          className={`h-full transition-all ${reached
            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
            : 'bg-gradient-to-r from-teal-600 to-cyan-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {reached && (
        <p className="text-xs text-emerald-400 mt-1.5">{t('goal.reached')}</p>
      )}
    </div>
  );
};

export default DailyGoalBar;
