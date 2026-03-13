import React, { useState, useEffect, memo } from 'react';
import { useLanguage } from '../../i18n';
import { fmtSecs, fmtShort } from '../../utils/formatters';
import { serverNow } from '../../utils/serverTime';
import { isReallyOnline } from '../../utils/onlineStatus';

const WorkProgressBar = memo(({ friend, theme }) => {
  const { t } = useLanguage();
  // Hooks — koşullu return'den ÖNCE çağrılmalı (Rules of Hooks)
  const {
    workDuration, workStartedAt, workPausedAt,
    breakDuration, breakStartedAt, breakPausedAt,
    isFreeMode, isPaused, isOnBreak, isBreakPaused,
  } = friend;

  const [workElapsed, setWorkElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);

  // Çalışma süresi — duraklatınca work_paused_at ile dondur (lag'dan etkilenmez)
  useEffect(() => {
    if (!workStartedAt) { setWorkElapsed(0); return; }

    if (workPausedAt) {
      // Tam duraklatma anındaki süre: iki timestamp arası (sabit, büyümez)
      setWorkElapsed(Math.max(0, Math.floor(
        (new Date(workPausedAt).getTime() - new Date(workStartedAt).getTime()) / 1000
      )));
      return;
    }

    // Sanal başlangıçtan itibaren canlı say
    const start = new Date(workStartedAt).getTime();
    const update = () => setWorkElapsed(Math.floor((serverNow() - start) / 1000));
    update();
    if (isPaused && !isBreakPaused) return; // Eski veri: workPausedAt yok, dondur
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [workStartedAt, workPausedAt, isPaused, isBreakPaused]);

  // Mola süresi — aynı mantık
  useEffect(() => {
    if (!breakStartedAt) { setBreakElapsed(0); return; }

    if (breakPausedAt) {
      setBreakElapsed(Math.max(0, Math.floor(
        (new Date(breakPausedAt).getTime() - new Date(breakStartedAt).getTime()) / 1000
      )));
      return;
    }

    const start = new Date(breakStartedAt).getTime();
    const update = () => setBreakElapsed(Math.floor((serverNow() - start) / 1000));
    update();
    if (isBreakPaused) return; // Eski veri
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [breakStartedAt, breakPausedAt, isBreakPaused]);

  // Koşullu render — hook'lardan SONRA
  if (!isReallyOnline(friend) || friend.showStudyTime === false || friend.status === 'hidden') return null;

  const isWorkPaused = isPaused && !isBreakPaused;
  const showWork  = friend.isWorking || isWorkPaused;
  const showBreak = isOnBreak || isBreakPaused;

  if (!showWork && !showBreak) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Çalışma çubuğu */}
      {showWork && (
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className={isWorkPaused ? 'text-yellow-400' : 'text-teal-400'}>
              {isWorkPaused ? t('friends.paused') : t('friends.working')}
            </span>
            <span className={theme.textMuted}>
              {fmtSecs(workElapsed, t)}
              {!isFreeMode && workDuration > 0 && ` / ${fmtShort(workDuration, t)}`}
            </span>
          </div>
          <div className={`h-2 ${theme.input} rounded-full overflow-hidden`}>
            <div
              className={`h-full bg-gradient-to-r ${isWorkPaused ? 'from-yellow-500 to-amber-400' : 'from-teal-500 to-cyan-400'} transition-all duration-500 rounded-full`}
              style={{ width: `${isFreeMode ? 100 : (workDuration > 0 ? Math.min((workElapsed / workDuration) * 100, 100) : 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Mola çubuğu */}
      {showBreak && (
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className={isBreakPaused ? 'text-yellow-400' : 'text-blue-400'}>
              {isBreakPaused ? t('friends.paused') : t('friends.onBreak')}
            </span>
            <span className={theme.textMuted}>
              {fmtSecs(breakElapsed, t)}
              {breakDuration > 0 && ` / ${fmtShort(breakDuration, t)}`}
            </span>
          </div>
          <div className={`h-2 ${theme.input} rounded-full overflow-hidden`}>
            <div
              className={`h-full bg-gradient-to-r ${isBreakPaused ? 'from-yellow-500 to-amber-400' : 'from-blue-500 to-indigo-400'} transition-all duration-500 rounded-full`}
              style={{ width: `${breakDuration > 0 ? Math.min((breakElapsed / breakDuration) * 100, 100) : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default WorkProgressBar;
