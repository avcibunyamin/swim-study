import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { playBell } from '../utils/audio';
import { saveOfflineData } from '../utils/offlineStorage';
import { serverNow, serverISOString } from '../utils/serverTime';

const isNative = Capacitor.isNativePlatform();
const TimerPlugin = isNative ? Capacitor.registerPlugin('TimerPlugin') : null;
const TIMER_NOTIF_ID = 9999;

export default function usePomodoro({
  user, isOnline,
  setTotalStudySecs, setStudyHistory,
  notifications, t
}) {
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [freeTime, setFreeTime] = useState(0);
  const [sessionWorked, setSessionWorked] = useState(0);
  const [sound, setSound] = useState(null);
  const audioRef = useRef(null);

  const timerStartedAtRef = useRef(null);
  const pausedSessionWorkedRef = useRef(0);
  // timeLeft ve freeTime'ı ref ile takip et — DB effect'i her saniye çalışmasın
  const timeLeftRef = useRef(timeLeft);
  const freeTimeRef = useRef(freeTime);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { freeTimeRef.current = freeTime; }, [freeTime]);

  // Çalışma süresini study_history tablosuna ve users.total_study_secs'e kaydet
  const saveStudyTime = useCallback(async (secs) => {
    if (!user || secs < 1 || !isOnline) return;
    try {
      const today = serverISOString().split('T')[0];

      // Paralel: bugünkü satır + toplam süre
      const [{ data: todayEntry }, { data: userData }] = await Promise.all([
        supabase
          .from('study_history')
          .select('secs')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('users')
          .select('total_study_secs')
          .eq('id', user.id)
          .single(),
      ]);

      if (!userData) return;

      const newDaySecs = (todayEntry?.secs || 0) + secs;
      const newTotal   = (userData.total_study_secs || 0) + secs;

      // Paralel: upsert history + update toplam
      const [{ error: histErr }] = await Promise.all([
        supabase
          .from('study_history')
          .upsert({ user_id: user.id, date: today, secs: newDaySecs },
                  { onConflict: 'user_id,date' }),
        supabase
          .from('users')
          .update({ total_study_secs: newTotal })
          .eq('id', user.id),
      ]);

      if (!histErr) {
        setStudyHistory(prev => {
          const arr = prev.filter(h => h.date !== today);
          return [...arr, { date: today, secs: newDaySecs }]
            .sort((a, b) => b.date.localeCompare(a.date));
        });
      }
    } catch (e) {
      console.warn('Save error:', e.code || e.message);
    }
  }, [user, isOnline, setStudyHistory]);

  // Timer mantığı (solo)
  useEffect(() => {
    if (!isRunning) {
      if (sessionWorked > 0) pausedSessionWorkedRef.current = sessionWorked;
      timerStartedAtRef.current = null;
      return;
    }

    // Effect her çalıştığında (isOnline/notifications gibi bağımlılıklar değişse de)
    // başlangıç noktasını sıfırla. Aksi hâlde elapsed = (şimdi - orijinal T0) hesabı
    // mevcut timeLeft ile çelişerek kronometrede ani sıçramaya neden olur.
    timerStartedAtRef.current = serverNow();
    const localStartedAt = timerStartedAtRef.current;
    const initialTimeLeft = timeLeft;
    const initialFreeTime = freeTime;
    // sessionWorked state'ini direkt kullan — pausedRef sadece duraklama anında güncellenir
    // ama buradaki anlık değer her zaman doğrudur.
    pausedSessionWorkedRef.current = sessionWorked;
    const initialSessionWorked = sessionWorked;

    const i = setInterval(async () => {
      const elapsed = Math.floor((serverNow() - localStartedAt) / 1000);

      if (isFreeMode) {
        const newFreeTime = initialFreeTime + elapsed;
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
          playBell(notifications);
          if (notifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('SWIM', { body: isOnBreak ? t('room.breakOver') : t('room.breakTime') });
          }

          if (!isOnBreak) {
            const finalSessionWorked = initialSessionWorked + initialTimeLeft;
            if (finalSessionWorked > 0) {
              if (isOnline) {
                await saveStudyTime(finalSessionWorked);
              } else {
                saveOfflineData(user?.id, finalSessionWorked);
                const today = serverISOString().split('T')[0];
                setStudyHistory(prev => {
                  const arr = prev.filter(h => h.date !== today);
                  const existing = prev.find(h => h.date === today);
                  return [...arr, { date: today, secs: (existing?.secs || 0) + finalSessionWorked }]
                    .sort((a, b) => b.date.localeCompare(a.date));
                });
              }
              setTotalStudySecs(prev => prev + finalSessionWorked);
            }
            setIsOnBreak(true);
            setTimeLeft(breakMins * 60);
            setSessionWorked(0);
            pausedSessionWorkedRef.current = 0;
          } else {
            setIsRunning(false);
            setIsOnBreak(false);
            setTimeLeft(workMins * 60);
          }
          timerStartedAtRef.current = null;
        }
      }
    }, 1000);

    return () => clearInterval(i);
  }, [isRunning, isOnBreak, isFreeMode, workMins, breakMins, notifications, isOnline, user?.id]);

  // Native timer servisi
  useEffect(() => {
    if (!isNative || !TimerPlugin) return;
    if (isRunning) {
      TimerPlugin.startTimer({ timeLeft, isFreeMode, freeTime, isOnBreak }).catch(() => {});
    } else {
      TimerPlugin.stopTimer().catch(() => {});
    }
    return () => { TimerPlugin.stopTimer().catch(() => {}); };
  }, [isRunning]);

  // Native timer güncelleme (her 10s)
  useEffect(() => {
    if (!isNative || !TimerPlugin || !isRunning) return;
    const i = setInterval(() => {
      TimerPlugin.updateTimer({ timeLeft, isFreeMode, freeTime, isOnBreak }).catch(() => {});
    }, 10000);
    return () => clearInterval(i);
  }, [isRunning, timeLeft, isFreeMode, freeTime, isOnBreak]);

  // Native bildirim zamanlaması
  useEffect(() => {
    if (!isNative) return;
    if (isRunning && !isFreeMode && timeLeft > 0 && notifications) {
      const fireAt = new Date(Date.now() + timeLeft * 1000);
      LocalNotifications.schedule({
        notifications: [{
          id: TIMER_NOTIF_ID,
          title: 'SWIM',
          body: isOnBreak ? t('room.breakOver') : t('room.breakTime'),
          schedule: { at: fireAt },
          sound: 'default'
        }]
      }).catch(() => {});
    } else {
      LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] }).catch(() => {});
    }
    return () => {
      LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] }).catch(() => {});
    };
  }, [isRunning, isFreeMode, isOnBreak, notifications]);

  // Kullanıcı çalışma durumunu Supabase'e yaz
  useEffect(() => {
    if (!user || !isOnline) return;

    const nowMs = serverNow();

    // Çalışma süresi: serbest modda freeTime, normal modda elapsed = total - remaining
    const workAlreadyElapsed = isFreeMode
      ? freeTimeRef.current
      : Math.max(0, workMins * 60 - timeLeftRef.current);

    // Mola süresi: mola modundaysa elapsed = breakTotal - remaining
    const breakAlreadyElapsed = isOnBreak
      ? Math.max(0, breakMins * 60 - timeLeftRef.current)
      : 0;

    const isWorkPaused  = !isRunning && !isOnBreak && workAlreadyElapsed > 0;
    const isBreakPaused = !isRunning &&  isOnBreak && breakAlreadyElapsed > 0;

    supabase
      .from('users')
      .update({
        is_working:      isRunning && !isOnBreak,
        is_on_break:     isRunning &&  isOnBreak,
        is_paused:       isWorkPaused || isBreakPaused,
        is_break_paused: isBreakPaused,
        work_duration:   isFreeMode ? 0 : workMins * 60,
        break_duration:  isFreeMode ? 0 : breakMins * 60,
        is_free_mode:    isFreeMode,
        // Sanal çalışma başlangıcı — duraklatınca da korunur, bar doğru noktadan devam eder
        work_started_at: (isRunning && !isOnBreak) || isWorkPaused
          ? new Date(nowMs - workAlreadyElapsed * 1000).toISOString()
          : null,
        // Duraklatma anı — bar bu iki timestamp arasını ölçer (lag'dan etkilenmez)
        work_paused_at: isWorkPaused
          ? new Date(nowMs).toISOString()
          : null,
        // Mola çubuğu için sanal mola başlangıcı
        break_started_at: (isRunning && isOnBreak) || isBreakPaused
          ? new Date(nowMs - breakAlreadyElapsed * 1000).toISOString()
          : null,
        break_paused_at: isBreakPaused
          ? new Date(nowMs).toISOString()
          : null,
      })
      .eq('id', user.id)
      .then(() => {})
      .catch(() => {});
  }, [isRunning, isOnBreak, isFreeMode, user?.id, isOnline]);

  // Ses yönetimi
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

  // Timer kontrol fonksiyonları
  const selectPreset = useCallback((w, b, free) => {
    if (isRunning) return;
    setIsFreeMode(free);
    if (free) setFreeTime(0);
    else { setWorkMins(w); setBreakMins(b); setTimeLeft(w * 60); }
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

  const handleFinish = useCallback(() => {
    return 'finish';
  }, []);

  const confirmAction = useCallback(async (actionType) => {
    // Anlık değeri hemen yakala — await sonrasında state değişmiş olabilir
    const workedSecs = sessionWorked;

    // Offline için ortak history güncelleme yardımcısı
    const saveOfflineWithHistory = (secs) => {
      saveOfflineData(user?.id, secs);
      const today = serverISOString().split('T')[0];
      setStudyHistory(prev => {
        const arr = prev.filter(h => h.date !== today);
        const existing = prev.find(h => h.date === today);
        return [...arr, { date: today, secs: (existing?.secs || 0) + secs }]
          .sort((a, b) => b.date.localeCompare(a.date));
      });
    };

    if (actionType === 'break') {
      // Break'e geç: sayacı sıfırla, break modunu aç
      timerStartedAtRef.current = null;
      pausedSessionWorkedRef.current = 0;
      setSessionWorked(0);
      setTimeLeft(breakMins * 60);
      setIsOnBreak(true);
      // DB'ye yaz (state sıfırlandıktan sonra)
      if (workedSecs > 0) {
        if (isOnline) await saveStudyTime(workedSecs);
        else saveOfflineWithHistory(workedSecs);
        setTotalStudySecs(prev => prev + workedSecs);
      }
    } else {
      // Bitir: timer'ı hemen durdur, state'i sıfırla
      setIsRunning(false);
      setIsOnBreak(false);
      if (isFreeMode) setFreeTime(0);
      else setTimeLeft(workMins * 60);
      setSessionWorked(0);
      pausedSessionWorkedRef.current = 0;
      timerStartedAtRef.current = null;
      // DB'ye yaz (timer durdu, state sıfırlandı, tek kez)
      if (workedSecs > 0) {
        if (isOnline) await saveStudyTime(workedSecs);
        else saveOfflineWithHistory(workedSecs);
        setTotalStudySecs(prev => prev + workedSecs);
      }
    }
  }, [isOnline, sessionWorked, breakMins, workMins, isFreeMode, user?.id, saveStudyTime, setTotalStudySecs]);

  const handleSliderChange = useCallback((type, value) => {
    if (isRunning) return;
    if (type === 'work') {
      setWorkMins(value);
      setTimeLeft(value * 60);
    } else {
      setBreakMins(value);
    }
  }, [isRunning]);

  return {
    workMins, setWorkMins, breakMins, setBreakMins,
    timeLeft, setTimeLeft, isRunning, setIsRunning,
    isOnBreak, setIsOnBreak, isFreeMode, setIsFreeMode,
    freeTime, setFreeTime, sessionWorked, setSessionWorked,
    sound, setSound, audioRef,
    pausedSessionWorkedRef, timerStartedAtRef,
    saveStudyTime,
    selectPreset, handleStartStop, handleSkipToBreak,
    handleFinish, confirmAction, handleSliderChange
  };
}
