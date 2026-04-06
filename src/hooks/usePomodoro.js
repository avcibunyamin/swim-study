import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { playBell } from '../utils/audio';
import { serverNow } from '../utils/serverTime';

const isNative = Capacitor.isNativePlatform();
const TimerPlugin = isNative ? Capacitor.registerPlugin('TimerPlugin') : null;
const TIMER_NOTIF_ID = 9999;
const TIMER_SNAP_KEY = 'swim_timer_snap';

export default function usePomodoro({
  user, isOnline,
  setTotalStudySecs, setStudyHistory,
  notifications, t
}) {
  const [workMins, setWorkMins]       = useState(25);
  const [breakMins, setBreakMins]     = useState(5);
  const [timeLeft, setTimeLeft]       = useState(25 * 60);
  const [isRunning, setIsRunning]     = useState(false);
  const [isOnBreak, setIsOnBreak]     = useState(false);
  const [isFreeMode, setIsFreeMode]   = useState(false);
  const [freeTime, setFreeTime]       = useState(0);
  const [sessionWorked, setSessionWorked] = useState(0);
  const [sound, setSound]             = useState(null);
  const audioRef                      = useRef(null);

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

  // ─── Çalışma süresini localStorage'a kaydet ───────────────────────────────
  const saveStudyTime = useCallback(async (secs) => {
    if (!user || secs < 1) return;
    const today = new Date().toISOString().split('T')[0];
    setStudyHistory(prev => {
      const existing = prev.find(h => h.date === today);
      const filtered = prev.filter(h => h.date !== today);
      return [...filtered, { date: today, secs: (existing?.secs || 0) + secs }]
        .sort((a, b) => b.date.localeCompare(a.date));
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
          playBell(notifications);
          if (notifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('SWIM', { body: isOnBreak ? t('room.breakOver') : t('room.breakTime') });
          }
          if (!isOnBreak) {
            const finalSessionWorked = initialSessionWorked + initialTimeLeft;
            if (finalSessionWorked > 0) {
              await saveStudyTime(finalSessionWorked);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isOnBreak, isFreeMode, workMins, breakMins, notifications, user?.id]);

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

  // ─── Native bildirim zamanlaması ──────────────────────────────────────────
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
  }, [isRunning, isOnBreak, isFreeMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }
  }, [sessionWorked, breakMins, workMins, isFreeMode, saveStudyTime, setTotalStudySecs]);

  const handleSliderChange = useCallback((type, value) => {
    if (isRunning) return;
    if (type === 'work') { setWorkMins(value); setTimeLeft(value * 60); }
    else { setBreakMins(value); }
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
    handleFinish, confirmAction, handleSliderChange
  };
}
