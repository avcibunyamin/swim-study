import React, { useState, useEffect, memo } from 'react';
import { Play, Pause, FastForward, Square, Volume2, CloudRain, Waves, TreePine, WifiOff, Smartphone } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmt, fmtSecs } from '../../utils/formatters';
import { serverNow } from '../../utils/serverTime';
import Logo from '../ui/Logo';
import DragSlider from '../ui/DragSlider';
import AquariumTimer from '../ui/AquariumTimer';


const PomodoroPage = memo(({
  theme, pagePadding,
  notification, setNotification,
  workMins, breakMins, timeLeft,
  isRunning, isOnBreak, isFreeMode,
  freeTime, sessionWorked,
  totalStudySecs, selectPreset,
  handleStartStop, handleSkipToBreak, handleFinish, handleSliderChange,
  showConfirm, setShowConfirm, confirmAction,
  sound, setSound, audioRef,
  isOnline, user, studyHistory,
  remoteDevice, remoteStart, remotePausedAt, pausedByOffline,
  cheatNotification, setCheatNotification,
}) => {
  const { t } = useLanguage();
  const circ     = 2 * Math.PI * 100;
  const totalSecs  = isOnBreak ? breakMins * 60 : workMins * 60;
  const progress   = isFreeMode ? 0 : isOnBreak
    ? (timeLeft / totalSecs) * 100
    : ((totalSecs - timeLeft) / totalSecs) * 100;
  const today       = new Date().toISOString().split('T')[0];
  const todaySecs   = (studyHistory || []).find(h => h.date === today)?.secs || 0;
  const displayTime = isFreeMode ? freeTime : timeLeft;
  // Oturum başlatılmışsa (çalışıyor VEYA duraklatılmış) süre ayarlarını kilitle
  const sessionLocked = isRunning || sessionWorked > 0 || isOnBreak || !!remoteDevice;

  const [displaySessionWorked, setDisplaySessionWorked] = useState(0);
  useEffect(() => {
    if (sessionWorked === 0) setDisplaySessionWorked(0);
    else if (sessionWorked > displaySessionWorked) setDisplaySessionWorked(sessionWorked);
  }, [sessionWorked]);

  // Remote cihazın geçen süresi — pause'da dondurulur, banner'da gösterilmez
  const [remoteElapsed, setRemoteElapsed] = useState(0);
  useEffect(() => {
    if (!remoteStart) { setRemoteElapsed(0); return; }
    // Pause anı varsa o noktada dondur, yoksa canlı say
    const endMs = remotePausedAt ? new Date(remotePausedAt).getTime() : null;
    const calc  = () => Math.floor(((endMs ?? serverNow()) - new Date(remoteStart).getTime()) / 1000);
    setRemoteElapsed(calc());
    if (endMs) return; // pause'da interval başlatma — değer sabit
    const i = setInterval(() => setRemoteElapsed(calc()), 1000);
    return () => clearInterval(i);
  }, [remoteStart, remotePausedAt]);

  // Remote session bitince elapsed'ı geçici tut — study_history Realtime'dan todaySecs
  // güncellenene kadar ekranda sıfır görünmesini önler
  const [savedRemoteElapsed, setSavedRemoteElapsed] = useState(0);
  const prevRemoteDeviceRef = React.useRef(null);
  const prevTodaySecsRef    = React.useRef(todaySecs);
  useEffect(() => {
    const wasRemote = prevRemoteDeviceRef.current;
    prevRemoteDeviceRef.current = remoteDevice;
    if (wasRemote && !remoteDevice && remoteElapsed > 0) {
      setSavedRemoteElapsed(remoteElapsed); // session bitti → koru
    }
    if (remoteDevice) setSavedRemoteElapsed(0); // yeni session başladı → sıfırla
  }, [remoteDevice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (savedRemoteElapsed > 0 && todaySecs > prevTodaySecsRef.current) {
      setSavedRemoteElapsed(0); // todaySecs güncellendi → artık gerekmez
    }
    prevTodaySecsRef.current = todaySecs;
  }, [todaySecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stopwatch ve bugün için kullanılacak nihai elapsed
  const effectiveRemoteElapsed = remoteDevice ? remoteElapsed : savedRemoteElapsed;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="text-center py-2"><Logo size="sm" centered /></div>


      {cheatNotification && (
        <div className="bg-red-600/90 rounded-xl p-3 mb-4 text-white text-sm text-center animate-fade-in cursor-pointer backdrop-blur-sm"
          onClick={() => setCheatNotification(null)}>
          {cheatNotification}
        </div>
      )}

      {notification && (() => {
        const isError   = notification.includes('kesildi') || notification.includes('çıkarıl');
        const isSuccess = notification.includes('senkronize') || notification.includes('kaydedildi') || notification.includes('✅');
        const bgColor   = isError ? 'bg-red-600/90' : isSuccess ? 'bg-emerald-600/90' : 'bg-slate-700/90';
        return (
          <div
            className={`${bgColor} rounded-xl p-3 mb-4 text-white text-sm text-center animate-fade-in cursor-pointer backdrop-blur-sm`}
            onClick={() => setNotification(null)}
          >
            {notification}
          </div>
        );
      })()}

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
            {effectiveRemoteElapsed > 0 ? (
              <span className={`text-xs ${theme.textMuted} mt-1`}>+{fmtSecs(effectiveRemoteElapsed, t)}</span>
            ) : sessionWorked > 0 && !isOnBreak ? (
              <span className={`text-xs ${theme.textMuted} mt-1`}>+{fmtSecs(sessionWorked, t)}</span>
            ) : null}
          </div>
        </AquariumTimer>
      </div>

      {/* Kontrol Butonları veya Remote Mode Banner */}
      {remoteDevice ? (
        <div className="bg-indigo-900/60 border border-indigo-500/40 rounded-2xl p-5 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-indigo-300 text-sm mb-2">
            <Smartphone size={16} />
            <span>{t('pomodoro.remoteActiveSession')}</span>
          </div>
          <p className="text-white font-semibold mb-3">
            <span className="text-indigo-400 font-bold">{remoteDevice}</span> {t('pomodoro.remoteDevice')}
          </p>
          <p className="text-indigo-300/70 text-xs">
            {t('pomodoro.remoteStop')}
          </p>
        </div>
      ) : pausedByOffline ? (
        <div className="bg-yellow-900/40 border border-yellow-600/40 rounded-2xl p-4 mb-4 text-center">
          <p className="text-yellow-300 text-sm font-semibold">⏸ {t('pomodoro.waitingConnection')}</p>
          <p className="text-yellow-300/70 text-xs mt-1">{t('pomodoro.waitingConnectionDesc')}</p>
        </div>
      ) : (
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
      )}

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
          {fmtSecs(todaySecs + (effectiveRemoteElapsed > 0 ? effectiveRemoteElapsed : (!isOnBreak ? displaySessionWorked : 0)), t)}
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
