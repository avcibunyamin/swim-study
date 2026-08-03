import React, { useState, useEffect, memo } from 'react';
import { Play, Pause, FastForward, Square, Volume2, CloudRain, Waves, TreePine, WifiOff, Bell, BellOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../i18n';
import { fmt, fmtSecs, localDateStr } from '../../utils/formatters';
import { applyNotificationSetting } from '../../utils/notifications';
import Logo from '../ui/Logo';
import DragSlider from '../ui/DragSlider';
import AquariumTimer from '../ui/AquariumTimer';


const isNativeApp = Capacitor.isNativePlatform();

const PomodoroPage = memo(({
  theme, pagePadding,
  notifications, setNotifications,
  workMins, breakMins, timeLeft,
  isRunning, isOnBreak, isFreeMode,
  freeTime, sessionWorked,
  totalStudySecs, selectPreset,
  handleStartStop, handleSkipToBreak, handleFinish, handleSliderChange,
  showConfirm, setShowConfirm, confirmAction,
  sound, setSound, audioRef,
  isOnline, user, studyHistory,
}) => {
  const { t } = useLanguage();

  const toggleBell = async () => {
    const newVal = !notifications;
    await applyNotificationSetting(newVal);
    setNotifications(newVal);
  };

  const circ     = 2 * Math.PI * 100;
  const totalSecs  = isOnBreak ? breakMins * 60 : workMins * 60;
  const progress   = isFreeMode ? 0 : isOnBreak
    ? (timeLeft / totalSecs) * 100
    : ((totalSecs - timeLeft) / totalSecs) * 100;
  const today       = localDateStr();
  const todaySecs   = (studyHistory || []).find(h => h.date === today)?.secs || 0;
  const displayTime = isFreeMode ? freeTime : timeLeft;
  // Oturum başlatılmışsa (çalışıyor VEYA duraklatılmış) süre ayarlarını kilitle
  const sessionLocked = isRunning || sessionWorked > 0 || isOnBreak;

  const [displaySessionWorked, setDisplaySessionWorked] = useState(0);
  useEffect(() => {
    if (sessionWorked === 0) setDisplaySessionWorked(0);
    else if (sessionWorked > displaySessionWorked) setDisplaySessionWorked(sessionWorked);
  }, [sessionWorked]);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="flex items-center justify-between py-2 px-1">
        <div className="w-8" />
        <Logo size="sm" />
        <button
          onClick={toggleBell}
          title={notifications ? t('pomodoro.bellOn') : t('pomodoro.bellOff')}
          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
            notifications ? 'text-teal-400' : theme.textMuted
          }`}
        >
          {notifications ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
      </div>

      {/* Preset Seçimi */}
      <div className="flex justify-center gap-2 mb-4">
        {[
          { w: 25, b: 5,  l: '25/5'  },
          { w: 40, b: 10, l: '40/10' },
          { w: 60, b: 15, l: '60/15' },
          { w: 0,  b: 0,  l: t('pomodoro.free'), f: true }
        ].map(p => (
          <button
            key={p.l}
            onClick={() => selectPreset(p.w, p.b, !!p.f)}
            disabled={sessionLocked}
            className={`px-3 py-1.5 rounded-xl text-sm ${sessionLocked ? 'opacity-40 cursor-not-allowed' : ''} ${
              (p.f && isFreeMode) || (!p.f && !isFreeMode && workMins === p.w && breakMins === p.b)
                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white'
                : `${theme.input} border ${theme.text}`
            }`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Timer Çemberi — Akvaryum */}
      <div className="flex justify-center mb-4">
        <AquariumTimer>
          <svg width="220" height="220" className="-rotate-90" style={{ overflow: 'visible' }}>
            <circle cx="110" cy="110" r="100" stroke={theme.slider} strokeWidth="10" fill="none" />
            <circle
              cx="110" cy="110" r="100"
              stroke={isOnBreak ? '#10b981' : '#14b8a6'}
              strokeWidth="10" fill="none" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={isFreeMode ? 0 : circ - (progress / 100) * circ}
              style={{ filter: `drop-shadow(0 0 20px ${isOnBreak ? '#10b981' : '#14b8a6'})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <span className="text-4xl font-mono font-bold">{fmt(displayTime)}</span>
            <span className={`text-sm ${isOnBreak ? 'text-emerald-400' : 'text-teal-400'}`}>
              {isOnBreak ? t('pomodoro.break') : isFreeMode ? t('pomodoro.free') : t('pomodoro.work')}
            </span>
            {sessionWorked > 0 && !isOnBreak && (
              <span className={`text-xs ${theme.textMuted} mt-1`}>+{fmtSecs(sessionWorked, t)}</span>
            )}
          </div>
        </AquariumTimer>
      </div>

      {/* Kontrol Butonları */}
      <div className="flex justify-center gap-2 mb-4 flex-wrap">
        {!isRunning ? (
            <button
              onClick={handleStartStop}
              className="px-6 py-3 rounded-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
            >
              <Play size={20} className="inline mr-1" />{t('pomodoro.start')}
            </button>
          ) : (
            <>
              <button onClick={handleStartStop} className="px-4 py-3 rounded-2xl font-bold bg-yellow-600 text-white">
                <Pause size={18} className="inline mr-1" />{t('pomodoro.pause')}
              </button>
              {!isOnBreak && !isFreeMode && (
                <button onClick={handleSkipToBreak} className="px-4 py-3 rounded-2xl font-bold bg-cyan-600 text-white">
                  <FastForward size={18} className="inline mr-1" />{t('pomodoro.toBreak')}
                </button>
              )}
              <button onClick={handleFinish} className="px-4 py-3 rounded-2xl font-bold bg-red-600 text-white">
                <Square size={18} className="inline mr-1" />{t('pomodoro.finish')}
              </button>
            </>
          )}
      </div>

      {/* Süre Ayar Slider'ları */}
      {!isFreeMode && (
        <div className={`${theme.card} rounded-xl p-4 mb-4 border transition-opacity ${sessionLocked ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-teal-400">{t('pomodoro.work')}</span>
              <span className="font-bold">{workMins} {t('time.min')}</span>
            </div>
            <DragSlider value={workMins} onChange={v => handleSliderChange('work', v)} min={1} max={180} disabled={sessionLocked} sliderBg={theme.slider} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-emerald-400">{t('pomodoro.break')}</span>
              <span className="font-bold">{breakMins} {t('time.min')}</span>
            </div>
            <DragSlider value={breakMins} onChange={v => handleSliderChange('break', v)} min={1} max={180} disabled={sessionLocked} sliderBg={theme.slider} />
          </div>
        </div>
      )}

      {/* Bugünkü Çalışma */}
      <div className="bg-teal-900/50 rounded-xl p-3 mb-4 border border-teal-500/30 text-center">
        <p className={`text-xs ${theme.textMuted}`}>{t('pomodoro.today')}</p>
        <p className="text-xl font-bold text-teal-400">
          {fmtSecs(todaySecs + (!isOnBreak ? displaySessionWorked : 0), t)}
        </p>
      </div>

      {/* Ortam Sesleri */}
      <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-1">
        <Volume2 size={16} />{t('pomodoro.ambientSounds')}
      </h3>
      <div className="flex gap-2">
        {[
          { id: 'rain',   Icon: CloudRain, n: t('pomodoro.rain')   },
          { id: 'ocean',  Icon: Waves,     n: t('pomodoro.ocean')  },
          { id: 'forest', Icon: TreePine,  n: t('pomodoro.forest') }
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSound(sound === s.id ? null : s.id)}
            className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${
              sound === s.id ? 'bg-teal-600/30 ring-2 ring-teal-400' : theme.input
            }`}
          >
            <s.Icon size={20} className={sound === s.id ? 'text-teal-400' : theme.textMuted} />
            <span className="text-[10px] mt-1">{s.n}</span>
          </button>
        ))}
      </div>

      {/* Onay Modalı */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-sm border border-slate-600`}>
            <h3 className={`text-lg font-bold text-center mb-2 ${theme.text}`}>
              {showConfirm === 'break' ? t('pomodoro.confirmBreak') : t('pomodoro.confirmFinish')}
            </h3>
            <p className={`text-center ${theme.textMuted} text-sm mb-4`}>
              {t('pomodoro.willSave')}: <span className="text-teal-400 font-bold">{fmtSecs(sessionWorked, t)}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(null)} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>
                {t('pomodoro.cancel')}
              </button>
              <button onClick={confirmAction} className={`flex-1 py-2.5 rounded-xl font-bold text-white ${showConfirm === 'break' ? 'bg-cyan-600' : 'bg-red-600'}`}>
                {t('pomodoro.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PomodoroPage;
