import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { playBell } from '../utils/audio';
import { serverNow, MAX_DAY_SECS } from '../utils/serverTime';
import { startLiveActivity, updateLiveActivity, endLiveActivity } from '../utils/liveActivity';

const isNative = Capacitor.isNativePlatform();
const TimerPlugin = isNative ? Capacitor.registerPlugin('TimerPlugin') : null;
const TIMER_NOTIF_ID   = 9999;
const BG_NOTIF_ID      = 9998;
const SESSION_END_NOTIF_ID = 9997; // çalışma/mola sonu bildirimi
const TIMER_SNAP_KEY   = 'swim_timer_snap';

export default function usePomodoro({
  user, isOnline,
  setTotalStudySecs, setStudyHistory,
  notifications, t
}) {
  const [workMins, setWorkMins]       = useState(() => Number(localStorage.getItem('swim_work_mins'))  || 25);
  const [breakMins, setBreakMins]     = useState(() => Number(localStorage.getItem('swim_break_mins')) || 5);
  const [isFreeMode, setIsFreeMode]   = useState(() => localStorage.getItem('swim_free_mode') === '1');
  const [timeLeft, setTimeLeft]       = useState(() => {
    const w = Number(localStorage.getItem('swim_work_mins')) || 25;
    return w * 60;
  });
  const [isRunning, setIsRunning]     = useState(false);
  const [isOnBreak, setIsOnBreak]     = useState(false);
  const [freeTime, setFreeTime]       = useState(0);
  const [sessionWorked, setSessionWorked] = useState(0);
  const [sound, setSound]             = useState(null);
  const audioRef                      = useRef(null);
  const [cheatNotification, setCheatNotification] = useState(null);

  const timerStartedAtRef             = useRef(null);
  const pausedSessionWorkedRef        = useRef(0);
  const timeLeftRef                   = useRef(timeLeft);
  const freeTimeRef                   = useRef(freeTime);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { freeTimeRef.current = freeTime; }, [freeTime]);

  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const isRunningRef2 = useRef(isRunning);
  useEffect(() => { isRunningRef2.current = isRunning; }, [isRunning]);

  const isOnBreakRef = useRef(isOnBreak);
  useEffect(() => { isOnBreakRef.current = isOnBreak; }, [isOnBreak]);

  const isFreeModeRef = useRef(isFreeMode);
  useEffect(() => { isFreeModeRef.current = isFreeMode; }, [isFreeMode]);

  // ─── Çalışma süresini localStorage'a kaydet (gece yarısı bölme destekli) ──
  const saveStudyTime = useCallback(async (secs) => {
    if (!user || secs < 1) return;
    const now     = new Date();
    const dateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // Oturum başlangıcını hesapla
    const startAt = new Date(now.getTime() - secs * 1000);

    // Gece yarısı geçildi mi?
    const startDay = dateStr(startAt);
    const endDay   = dateStr(now);

    const chunks = [];
    if (startDay === endDay) {
      // Aynı gün — hepsi tek parça
      chunks.push({ date: startDay, secs });
    } else {
      // Gece yarısını geç — gün başlangıcını bul
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      const secsAfterMidnight  = Math.floor((now - midnight) / 1000);
      const secsBeforeMidnight = secs - secsAfterMidnight;
      if (secsBeforeMidnight > 0) chunks.push({ date: startDay, secs: secsBeforeMidnight });
      if (secsAfterMidnight  > 0) chunks.push({ date: endDay,   secs: secsAfterMidnight  });
    }

    setStudyHistory(prev => {
      let updated = [...prev];
      for (const { date, secs: s } of chunks) {
        const existing = updated.find(h => h.date === date);
        updated = updated.filter(h => h.date !== date);
        const newSecs = Math.min((existing?.secs || 0) + s, MAX_DAY_SECS); // günlük 16 saat cap
        updated.push({ date, secs: newSecs });
      }
      return updated.sort((a, b) => b.date.localeCompare(a.date));
    });
  }, [user?.id, setStudyHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Timer mantığı ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (sessionWorked > 0) pausedSessionWorkedRef.current = sessionWorked;
      timerStartedAtRef.current = null;
      return;
    }

    timerStartedAtRef.current = serverNow();
    const localStartedAt    = timerStartedAtRef.current;
    const initialTimeLeft   = timeLeft;
    const initialFreeTime   = freeTime;
    pausedSessionWorkedRef.current = sessionWorked;
    const initialSessionWorked = sessionWorked;

    const i = setInterval(async () => {
      // Gerçek geçen süreyi duvar saatiyle ölç — arka planda yavaşlayan
      // setInterval tiklarının neden olduğu drift'i önler
      const elapsed = Math.floor((serverNow() - localStartedAt) / 1000);

      if (isFreeMode) {
        const newFreeTime      = initialFreeTime + elapsed;
        const newSessionWorked = isOnBreak ? initialSessionWorked : initialSessionWorked + elapsed;
        setFreeTime(newFreeTime);
        if (!isOnBreak) setSessionWorked(newSessionWorked);
      } else {
        const remaining = initialTimeLeft - elapsed;
        if (remaining > 0) {
          setTimeLeft(remaining);
          if (!isOnBreak) setSessionWorked(initialSessionWorked + elapsed);
        } else {
          clearInterval(i);
          // JS uyanık → planlanmış bildirimi iptal et, native bell çalsın (çift ses olmasın)
          if (isNative) {
            LocalNotifications.cancel({ notifications: [{ id: SESSION_END_NOTIF_ID }] }).catch(() => {});
          }
          playBell(notifications);
          if (!isOnBreak) {
            const finalSessionWorked = initialSessionWorked + initialTimeLeft;
            // Molayı hemen başlat — Live Activity isOnBreak effect tarafından güncellenir
            // (ara finishedType: 1 güncellemesi kaldırıldı — iOS onu "bitti" sayıp kapatıyordu)
            setIsOnBreak(true);
            setTimeLeft(breakMins * 60);
            setSessionWorked(0);
            pausedSessionWorkedRef.current = 0;
            // Çalışma süresini arka planda kaydet (non-blocking)
            if (finalSessionWorked > 0) {
              saveStudyTime(finalSessionWorked).then(() => {
                setTotalStudySecs(prev => prev + finalSessionWorked);
              });
            }
          } else {
            // Mola bitti — isRunning effect Live Activity'yi günceller
            setIsRunning(false);
            setIsOnBreak(false);
            setTimeLeft(workMins * 60);
          }
          timerStartedAtRef.current = null;
        }
      }
    }, 1000);

    return () => clearInterval(i);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isOnBreak, isFreeMode, workMins, breakMins, notifications, user?.id]);

  // ─── iOS Live Activity ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    if (isRunning) {
      // Başlat veya devam et
      startLiveActivity({
        timeLeft:  isFreeMode ? 0 : timeLeft,
        totalSecs: isFreeMode ? 0 : (isOnBreak ? breakMins * 60 : workMins * 60),
        isOnBreak,
        isFreeMode,
        freeTime,
        isRunning: true,
      });
    } else {
      // Duraklatıldı — widget'ı kaldırma, donuk göster
      updateLiveActivity({
        timeLeft,
        totalSecs: isOnBreak ? breakMins * 60 : workMins * 60,
        isOnBreak,
        isFreeMode,
        freeTime,
        isRunning: false,
      });
    }
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Work → Break geçişinde Live Activity'yi güncelle
  useEffect(() => {
    if (!isNative || !isRunning) return;
    updateLiveActivity({
      timeLeft:  isFreeMode ? 0 : timeLeft,
      totalSecs: isFreeMode ? 0 : (isOnBreak ? breakMins * 60 : workMins * 60),
      isOnBreak,
      isFreeMode,
      freeTime,
      isRunning: true,
    });
  }, [isOnBreak, isFreeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serbest modda freeTime'ı her 60sn'de sync et (endDate drift'ini önler)
  useEffect(() => {
    if (!isNative || !isRunning || !isFreeMode) return;
    if (freeTime % 60 !== 0 || freeTime === 0) return;
    updateLiveActivity({ timeLeft: 0, totalSecs: 0, isOnBreak: false, isFreeMode: true, freeTime, isRunning: true });
  }, [freeTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Native timer servisi ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative || !TimerPlugin) return;
    if (isRunning) {
      TimerPlugin.startTimer({ timeLeft, isFreeMode, freeTime, isOnBreak }).catch(() => {});
    } else {
      TimerPlugin.stopTimer().catch(() => {});
    }
    return () => { TimerPlugin.stopTimer().catch(() => {}); };
  }, [isRunning]);

  useEffect(() => {
    if (!isNative || !TimerPlugin || !isRunning) return;
    const i = setInterval(() => {
      TimerPlugin.updateTimer({ timeLeft, isFreeMode, freeTime, isOnBreak }).catch(() => {});
    }, 10000);
    return () => clearInterval(i);
  }, [isRunning, timeLeft, isFreeMode, freeTime, isOnBreak]);

  // ─── Eski timer bildirimlerini uygulama açılışında temizle ─────────────────
  useEffect(() => {
    if (!isNative) return;
    LocalNotifications.cancel({
      notifications: [{ id: TIMER_NOTIF_ID }, { id: BG_NOTIF_ID }, { id: SESSION_END_NOTIF_ID }]
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Oturum bitiş bildirimi (arka plan ses) ──────────────────────────────
  // Native plugin (BellPlugin) sadece uygulama önde iken çalışır; arka planda
  // iOS audio session'ı durdurur. Bu yüzden oturum başlangıcında tam bitiş
  // anına bir LocalNotification zamanlıyoruz. Sistem sessize saygı duyar.
  // JS interval bitiş anında uyanırsa (uygulama önde) bildirimi iptal edip
  // native bell çalıyor → çift ses olmaz.
  useEffect(() => {
    if (!isNative) return;
    if (!isRunning || !notifications || isFreeMode) {
      // Çalışma yoksa / bildirim kapalı / serbest mod → planlama yok
      LocalNotifications.cancel({ notifications: [{ id: SESSION_END_NOTIF_ID }] }).catch(() => {});
      return;
    }

    const endAt = new Date(serverNow() + timeLeftRef.current * 1000);
    const title = isOnBreak ? (t('pomodoro.breakDoneNotif') || 'Mola bitti!') : (t('pomodoro.workDoneNotif') || 'Çalışma bitti!');
    const body  = isOnBreak ? (t('pomodoro.breakDoneBody')  || 'Çalışmaya devam.') : (t('pomodoro.workDoneBody') || 'Mola zamanı.');

    LocalNotifications.schedule({
      notifications: [{
        id: SESSION_END_NOTIF_ID,
        title,
        body,
        schedule: { at: endAt },
        sound: 'default',
      }]
    }).catch(() => {});

    return () => {
      // isRunning kapanınca / mola-iş geçişinde / unmount'ta iptal et
      LocalNotifications.cancel({ notifications: [{ id: SESSION_END_NOTIF_ID }] }).catch(() => {});
    };
  }, [isRunning, isOnBreak, isFreeMode, notifications, workMins, breakMins]); // eslint-disable-line react-hooks/exhaustive-deps


  // ─── Timer snapshot → localStorage ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const snap = {
      uid: user.id,
      isRunning, isOnBreak, isFreeMode,
      timeLeft:      timeLeftRef.current,
      freeTime:      freeTimeRef.current,
      workMins, breakMins,
      sessionWorked: pausedSessionWorkedRef.current,
      savedAt:       serverNow(),
    };
    try { localStorage.setItem(TIMER_SNAP_KEY, JSON.stringify(snap)); } catch {}
  }, [isRunning, isOnBreak, isFreeMode, workMins, breakMins]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Timer snapshot'tan geri yükle ────────────────────────────────────────
  const restoredForUserRef = useRef(null);
  useEffect(() => { if (!user) restoredForUserRef.current = null; }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (restoredForUserRef.current === user.id) return;
    if (isRunning || isOnBreak || (isFreeMode && freeTime > 0) || sessionWorked > 0) {
      restoredForUserRef.current = user.id;
      return;
    }

    try {
      const snap = JSON.parse(localStorage.getItem(TIMER_SNAP_KEY) || 'null');
      const now = serverNow();
      if (snap?.uid === user.id && (now - snap.savedAt) < 24 * 60 * 60 * 1000) {
        const ageSecs = Math.floor((now - snap.savedAt) / 1000);
        restoredForUserRef.current = user.id;
        setWorkMins(snap.workMins);
        setBreakMins(snap.breakMins);

        // Aktif session yoksa timeLeft'i de snap'teki workMins'e göre ayarla
        if (!snap.isRunning && !snap.isOnBreak && !snap.sessionWorked && !snap.isFreeMode) {
          setTimeLeft(snap.workMins * 60);
          return;
        }

        if (snap.isFreeMode && (snap.isRunning || snap.freeTime > 0)) {
          setIsFreeMode(true);
          const newFree = snap.freeTime + (snap.isRunning ? ageSecs : 0);
          setFreeTime(newFree);
          setSessionWorked(newFree);
          if (snap.isRunning) setIsRunning(true);
          return;
        }
        if (snap.isOnBreak) {
          setIsOnBreak(true);
          const remaining = snap.timeLeft - (snap.isRunning ? ageSecs : 0);
          if (remaining > 0) { setTimeLeft(remaining); if (snap.isRunning) setIsRunning(true); }
          else { setIsOnBreak(false); setTimeLeft(snap.workMins * 60); }
          return;
        }
        if (snap.isRunning || snap.sessionWorked > 0) {
          const newTimeLeft = snap.timeLeft - (snap.isRunning ? ageSecs : 0);
          const newWorked   = snap.sessionWorked + (snap.isRunning ? ageSecs : 0);
          if (newTimeLeft > 0) {
            setTimeLeft(newTimeLeft);
            setSessionWorked(newWorked);
            if (snap.isRunning) setIsRunning(true);
          }
        }
      }
    } catch {}
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ses yönetimi ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    if (sound) {
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      audio.src = `/sounds/${sound}.mp3`;
      audio.loop = true;
      audio.load();
      const playWhenReady = () => { audio.play().catch(() => {}); };
      audio.addEventListener('canplaythrough', playWhenReady, { once: true });
      return () => { audio.removeEventListener('canplaythrough', playWhenReady); };
    } else {
      audioRef.current.pause();
    }
  }, [sound]);

  // ─── Timer kontrol fonksiyonları ──────────────────────────────────────────
  const selectPreset = useCallback((w, b, free) => {
    if (isRunning) return;
    setIsFreeMode(free);
    localStorage.setItem('swim_free_mode', free ? '1' : '0');
    if (free) setFreeTime(0);
    else {
      setWorkMins(w); setBreakMins(b); setTimeLeft(w * 60);
      localStorage.setItem('swim_work_mins',  String(w));
      localStorage.setItem('swim_break_mins', String(b));
    }
    setIsOnBreak(false);
    setSessionWorked(0);
    pausedSessionWorkedRef.current = 0;
  }, [isRunning]);

  const handleStartStop = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const handleSkipToBreak = useCallback(() => {
    if (sessionWorked === 0) return;
    return 'break';
  }, [sessionWorked]);

  const handleFinish = useCallback(() => 'finish', []);

  const confirmAction = useCallback(async (actionType) => {
    const workedSecs = sessionWorked;

    if (actionType === 'break') {
      timerStartedAtRef.current = null;
      pausedSessionWorkedRef.current = 0;
      setSessionWorked(0);
      setTimeLeft(breakMins * 60);
      setIsOnBreak(true);
      if (workedSecs > 0) {
        await saveStudyTime(workedSecs);
        setTotalStudySecs(prev => prev + workedSecs);
      }
    } else {
      setIsRunning(false);
      setIsOnBreak(false);
      if (isFreeMode) setFreeTime(0);
      else setTimeLeft(workMins * 60);
      setSessionWorked(0);
      pausedSessionWorkedRef.current = 0;
      timerStartedAtRef.current = null;
      if (workedSecs > 0) {
        await saveStudyTime(workedSecs);
        setTotalStudySecs(prev => prev + workedSecs);
      }
      // "Çalışma bitti" göster sonra kapat
      if (isNative) {
        updateLiveActivity({ timeLeft: 0, totalSecs: workMins*60, isOnBreak: false, isFreeMode, freeTime, isRunning: false, finishedType: 1 });
        setTimeout(() => endLiveActivity(), 4000);
      }
    }
  }, [sessionWorked, breakMins, workMins, isFreeMode, saveStudyTime, setTotalStudySecs]);

  const handleSliderChange = useCallback((type, value) => {
    if (isRunning) return;
    if (type === 'work') {
      setWorkMins(value); setTimeLeft(value * 60);
      localStorage.setItem('swim_work_mins', String(value));
    } else {
      setBreakMins(value);
      localStorage.setItem('swim_break_mins', String(value));
    }
  }, [isRunning]);

  return {
    workMins, setWorkMins, breakMins, setBreakMins,
    timeLeft, setTimeLeft, isRunning, setIsRunning,
    isOnBreak, setIsOnBreak, isFreeMode, setIsFreeMode,
    freeTime, setFreeTime, sessionWorked, setSessionWorked,
    sound, setSound, audioRef,
    pausedSessionWorkedRef,
    saveStudyTime,
    remoteDevice: null, remoteStart: null, remotePausedAt: null, pausedByOffline: false,
    selectPreset, handleStartStop, handleSkipToBreak,
    handleFinish, confirmAction, handleSliderChange,
    cheatNotification, setCheatNotification,
  };
}
