import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { playBell } from '../utils/audio';
import { saveOfflineData, getOfflineData, clearOfflineData } from '../utils/offlineStorage';
import { serverNow, serverISOString } from '../utils/serverTime';
import { getDeviceLabel, parseDeviceName } from '../utils/deviceName';

// Bu sekmenin/cihazın benzersiz etiketi — "Mac::a1b2c3d4" formatında.
// sessionStorage tabanlı: aynı tarayıcıda farklı sekmeler farklı etiket alır.
const DEVICE_LABEL = getDeviceLabel();

const isNative = Capacitor.isNativePlatform();
const TimerPlugin = isNative ? Capacitor.registerPlugin('TimerPlugin') : null;
const TIMER_NOTIF_ID = 9999;

const TIMER_SNAP_KEY = 'swim_timer_snap';

export default function usePomodoro({
  user, userData, isOnline,
  setTotalStudySecs, setStudyHistory, refreshStudyHistory,
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

  // Çoklu cihaz: başka bir cihazda aktif oturum varsa göster
  const [remoteDevice, setRemoteDevice]     = useState(null);
  const [remoteStart, setRemoteStart]       = useState(null);
  const [remotePausedAt, setRemotePausedAt] = useState(null); // pause anı — elapsed'ı dondurur
  // İnternet kesilince timer duraklatıldı mı? (bağlantı gelince otomatik devam eder)
  const [pausedByOffline, setPausedByOffline] = useState(false);

  const timerStartedAtRef = useRef(null);
  const pausedSessionWorkedRef = useRef(0);
  // Remote takeover sırasında durdurulduk — DB'ye yazmayı engelle (başka cihazın state'ini koruyalım)
  const remoteStoppedRef = useRef(false);
  // İnternet yokken timer duraklatıldı mı? Bağlantı gelince otomatik devam et
  const wasRunningBeforeOfflineRef = useRef(false);
  // Bu cihazın aktif oturumu var mı? (çalışıyor VEYA duraklatılmış)
  // Heartbeat bu ref'e göre gönderilir — finish'te false, pause'da true kalır
  const sessionActiveRef = useRef(false);
  // timeLeft ve freeTime'ı ref ile takip et — DB effect'i her saniye çalışmasın
  const timeLeftRef = useRef(timeLeft);
  const freeTimeRef = useRef(freeTime);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { freeTimeRef.current = freeTime; }, [freeTime]);

  // isOnline'ı ref ile tut — timer interval'ın bağımlılığına girmesin
  // (internet gelip gidince timer yeniden başlamasın)
  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // isRunning'i ref ile tut — realtime callback'de stale closure'ı önler
  const isRunningRef2 = useRef(isRunning);
  useEffect(() => { isRunningRef2.current = isRunning; }, [isRunning]);

  // ─── İnternet kesilince timer'ı otomatik duraklat, gelince devam ettir ────
  useEffect(() => {
    if (!isOnline) {
      // Bağlantı kesildi: timer çalışıyorsa duraklat
      if (isRunningRef2.current) {
        wasRunningBeforeOfflineRef.current = true;
        setPausedByOffline(true);
        setIsRunning(false);
      }
    } else {
      // Bağlantı geldi: offline yüzünden duraklatıldıysa otomatik devam et
      if (wasRunningBeforeOfflineRef.current) {
        wasRunningBeforeOfflineRef.current = false;
        setPausedByOffline(false);
        setIsRunning(true);
      }
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Session Heartbeat ────────────────────────────────────────────────────
  // Aktif oturum varken (çalışıyor VEYA duraklatılmış) her 30s nabız at.
  // Şarj bitmesi / bağlantı kesilmesi → nabız durur → get_active_session 90s
  // sonra stale session'ı temizler. Finish'te sessionActiveRef = false → nabız durur.
  useEffect(() => {
    if (!user || !isOnline) return;
    const sendHeartbeat = () => {
      if (!sessionActiveRef.current) return; // aktif oturum yok — nabız gönderme
      supabase.from('users')
        .update({ last_heartbeat_at: serverISOString() })
        .eq('id', user.id)
        .then(undefined, () => {});
    };
    const hb = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(hb);
  }, [user?.id, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────────────────────

  // Pending local veriyi DB'ye sync et — tek atomik RPC çağrısı
  // Pending offline veriyi DB'ye yaz — RPC gerektirmez, goOnline ile aynı pattern
  const syncToDB = useCallback(async () => {
    if (!user) return;
    const pending = getOfflineData(user.id);
    if (pending < 1) return;
    clearOfflineData(user.id); // önce sil — çift sync önle

    try {
      const today = serverISOString().split('T')[0];
      const [{ data: todayEntry }, { data: userData }] = await Promise.all([
        supabase.from('study_history').select('secs').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('users').select('total_study_secs').eq('id', user.id).single(),
      ]);
      if (!userData) throw new Error('user row not found');
      const newDaySecs = (todayEntry?.secs || 0) + pending;
      const newTotal   = (userData.total_study_secs || 0) + pending;
      const [r1, r2] = await Promise.all([
        supabase.from('study_history').upsert(
          { user_id: user.id, date: today, secs: newDaySecs },
          { onConflict: 'user_id,date' }
        ),
        supabase.from('users').update({ total_study_secs: newTotal }).eq('id', user.id),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
    } catch (e) {
      console.warn('syncToDB error:', e.message);
      saveOfflineData(user.id, pending); // hata olursa geri yaz
    }
  }, [user]);

  // Çalışma süresini kaydet
  const saveStudyTime = useCallback(async (secs) => {
    if (!user || secs < 1) return;
    const today = serverISOString().split('T')[0];

    // localStorage: offline/crash recovery için pending secs sakla
    saveOfflineData(user.id, secs);

    if (isOnlineRef.current) {
      await syncToDB();                                   // DB'ye yaz
      if (refreshStudyHistory) await refreshStudyHistory(); // DB'den taze çek → her iki cihaz eşitlenir
    } else {
      // Offline: optimistic güncelleme (goOnline tetiklenince DB'ye sync edilir)
      setStudyHistory(prev => {
        const arr = prev.filter(h => h.date !== today);
        const existing = prev.find(h => h.date === today);
        return [...arr, { date: today, secs: (existing?.secs || 0) + secs }]
          .sort((a, b) => b.date.localeCompare(a.date));
      });
    }
  }, [user, setStudyHistory, syncToDB, refreshStudyHistory]);

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
  // isOnline bağımlılıktan çıkarıldı — ref ile okunuyor.
  // internet gelip gidince timer yeniden başlamasın.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isOnBreak, isFreeMode, workMins, breakMins, notifications, user?.id]);

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

    // Remote takeover sırasında durdurulduk — DB'ye yazma, başka cihazın state'ini kirletme
    if (remoteStoppedRef.current) {
      remoteStoppedRef.current = false;
      return;
    }

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

    // Heartbeat ref'ini güncelle: çalışıyor veya duraklatılmışsa true, finish'ten sonra false
    sessionActiveRef.current = isRunning || isWorkPaused || isBreakPaused;

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
        // Aktif cihaz: çalışıyor veya duraklatılmışsa bu cihaz, aksi hâlde boşalt
        active_session_device: (isRunning || isWorkPaused || isBreakPaused) ? DEVICE_LABEL : null,
        // Oturum başlangıcı (get_active_session elapsed_seconds hesabı için)
        active_session_start: (isRunning || isWorkPaused || isBreakPaused)
          ? new Date(nowMs - workAlreadyElapsed * 1000).toISOString()
          : null,
        // Nabız: oturum aktifken yazılır; kesilince get_active_session temizler
        last_heartbeat_at: (isRunning || isWorkPaused || isBreakPaused)
          ? serverISOString()
          : null,
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

  // Timer snapshot'ı localStorage'a yaz — sadece timer DURUMU değişince tetiklenir.
  // KRITIK: user?.id ve isOnline bağımlılığa dahil DEĞİL. Olsaydı, sayfa yenilenince
  // kullanıcı oturumu algılandığı anda (user set edilince) mevcut snap sıfır state'le
  // üzerine yazılır ve restore bozulurdu.
  useEffect(() => {
    if (!user) return;
    const snap = {
      uid: user.id,
      deviceLabel: DEVICE_LABEL, // Bu sekme/cihaz — başka sekme bu snapshot'ı restore etmez
      isRunning, isOnBreak, isFreeMode,
      timeLeft:      timeLeftRef.current,
      freeTime:      freeTimeRef.current,
      workMins, breakMins,
      sessionWorked: pausedSessionWorkedRef.current,
      savedAt:       serverNow(),
    };
    try { localStorage.setItem(TIMER_SNAP_KEY, JSON.stringify(snap)); } catch {}
  }, [isRunning, isOnBreak, isFreeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Timer durumunu DB'den geri yükle ────────────────────────────────────
  // Sayfa yenilenince, başka cihazdan giriş yapılıp devralındığında veya
  // uygulama yeniden açıldığında son timer durumu kaldığı yerden devam eder.
  const restoredForUserRef = useRef(null);

  // Çıkış yapılınca ref'i sıfırla (tekrar giriş yapılınca restore çalışsın)
  useEffect(() => {
    if (!user) restoredForUserRef.current = null;
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (restoredForUserRef.current === user.id) return; // zaten restore edildi

    // Timer zaten aktifse (kullanıcı bizzat başlattı) — dokunma
    if (isRunning || isOnBreak || (isFreeMode && freeTime > 0) || sessionWorked > 0) {
      restoredForUserRef.current = user.id;
      return;
    }

    const now = serverNow();

    // ── Önce localStorage snapshot'ını dene (anlık, DB'den bağımsız) ──────
    try {
      const snap = JSON.parse(localStorage.getItem(TIMER_SNAP_KEY) || 'null');
      if (snap && snap.uid === user.id && snap.deviceLabel === DEVICE_LABEL && (now - snap.savedAt) < 24 * 60 * 60 * 1000) {
        const ageMs = now - snap.savedAt;
        const ageSecs = Math.floor(ageMs / 1000);

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
          if (remaining > 0) {
            setTimeLeft(remaining);
            if (snap.isRunning) setIsRunning(true);
          } else {
            setIsOnBreak(false);
            setTimeLeft(snap.workMins * 60);
          }
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
          return;
        }
        return; // snapshot var ama timer duraksız bırakılmış (normal bitiş)
      }
    } catch {}

    // ── Snapshot yoksa DB verisinden restore et ────────────────────────────
    if (!userData) return;

    const {
      is_working, is_on_break, is_paused, is_break_paused, is_free_mode,
      work_started_at, work_paused_at, break_started_at, break_paused_at,
      work_duration, break_duration, active_session_device,
    } = userData;

    // DB'de aktif timer yok — ref'i AYARLAMA, taze veri gelince tekrar dene
    if (!is_working && !is_on_break && !is_paused && !is_break_paused) return;

    // Başka cihaz aktifse bu sekmeye restore etme — remote detection zaten banner'ı gösterir.
    // restoredForUserRef'i ayarlamıyoruz: userData güncellenince tekrar kontrol edebilsin
    if (active_session_device && active_session_device !== DEVICE_LABEL) return;

    // Aktif durum bulundu — restore et ve ref'i kapat
    restoredForUserRef.current = user.id;

    // Serbest mod
    if (is_free_mode) {
      if (!work_started_at) return;
      const virtualStart = new Date(work_started_at).getTime();
      const endPoint = is_paused && work_paused_at ? new Date(work_paused_at).getTime() : now;
      const elapsed = Math.floor((endPoint - virtualStart) / 1000);
      if (elapsed <= 0) return;
      setIsFreeMode(true);
      setFreeTime(elapsed);
      setSessionWorked(elapsed);
      if (!is_paused) setIsRunning(true);
      return;
    }

    // Normal mod — çalışma seansı
    if ((is_working || is_paused) && !is_on_break) {
      if (!work_started_at) return;
      const wDur = work_duration || 25 * 60;
      const virtualStart = new Date(work_started_at).getTime();
      const endPoint = is_paused && work_paused_at ? new Date(work_paused_at).getTime() : now;
      const elapsed = Math.floor((endPoint - virtualStart) / 1000);
      const remaining = wDur - elapsed;
      setWorkMins(Math.round(wDur / 60));
      if (break_duration) setBreakMins(Math.round(break_duration / 60));
      if (remaining > 0) {
        setTimeLeft(remaining);
        setSessionWorked(elapsed);
        if (!is_paused) setIsRunning(true);
      }
      // remaining <= 0: uygulama kapalıyken seans bitti — timer varsayılanıyla başlar
      return;
    }

    // Normal mod — mola seansı
    if (is_on_break || is_break_paused) {
      if (!break_started_at) return;
      const bDur = break_duration || 5 * 60;
      const virtualStart = new Date(break_started_at).getTime();
      const endPoint = is_break_paused && break_paused_at ? new Date(break_paused_at).getTime() : now;
      const elapsed = Math.floor((endPoint - virtualStart) / 1000);
      const remaining = bDur - elapsed;
      if (work_duration) setWorkMins(Math.round(work_duration / 60));
      setBreakMins(Math.round(bDur / 60));
      setIsOnBreak(true);
      if (remaining > 0) {
        setTimeLeft(remaining);
        if (!is_break_paused) setIsRunning(true);
      } else {
        // Mola bitti, çalışma ekranına dön
        setIsOnBreak(false);
        if (work_duration) setTimeLeft(work_duration);
      }
    }
  }, [userData, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Çoklu Cihaz: Remote Session Tespiti ────────────────────────────────
  // userData değişince başka cihazın aktif olup olmadığını kontrol et
  useEffect(() => {
    if (!userData || !user) { setRemoteDevice(null); setRemoteStart(null); return; }
    const { active_session_device: dev, work_started_at: start,
            is_working, is_on_break, is_paused, is_break_paused,
            last_seen, last_heartbeat_at } = userData;
    const sessionActive = is_working || is_on_break || is_paused || is_break_paused;

    // Cihaz hayatta mı?
    // Önce last_heartbeat_at (her 30s, 90s eşiği) → yoksa last_seen fallback (60s, 5dk eşiği)
    const lastHbMs   = last_heartbeat_at ? new Date(last_heartbeat_at).getTime() : 0;
    const lastSeenMs = last_seen         ? new Date(last_seen).getTime()         : 0;
    const deviceAlive = lastHbMs > 0
      ? (serverNow() - lastHbMs)   < 90 * 1000
      : lastSeenMs > 0 && (serverNow() - lastSeenMs) < 5 * 60 * 1000;

    if (dev && dev !== DEVICE_LABEL && sessionActive) {
      if (!deviceAlive) {
        // Cihaz öldü (şarj bitti / bağlantı kesildi) — DB'yi temizle, banner'ı kaldır
        supabase.from('users').update({
          active_session_device: null,
          is_working: false, is_on_break: false,
          is_paused: false, is_break_paused: false,
          work_started_at: null, break_started_at: null,
        }).eq('id', user.id).then(() => {}).catch(() => {});
        setRemoteDevice(null);
        setRemoteStart(null);
      } else {
        setRemoteDevice(parseDeviceName(dev)); // "Mac::abc" → "Mac"
        setRemoteStart(start || null);
      }
    } else {
      setRemoteDevice(null);
      setRemoteStart(null);
    }
  }, [userData, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: başka cihaz başlatınca / durduruncaya anlık güncelleme
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`session_device_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        const { active_session_device: dev, work_started_at: start,
                work_paused_at: pausedAt,
                is_working, is_on_break, is_paused, is_break_paused,
                last_seen, last_heartbeat_at } = payload.new;
        const sessionActive = is_working || is_on_break || is_paused || is_break_paused;
        const lastHbMs   = last_heartbeat_at ? new Date(last_heartbeat_at).getTime() : 0;
        const lastSeenMs = last_seen         ? new Date(last_seen).getTime()         : 0;
        const deviceAlive = lastHbMs > 0
          ? (serverNow() - lastHbMs)   < 90 * 1000
          : lastSeenMs > 0 && (serverNow() - lastSeenMs) < 5 * 60 * 1000;

        if (dev && dev !== DEVICE_LABEL && sessionActive && deviceAlive) {
          setRemoteDevice(parseDeviceName(dev));
          setRemoteStart(start || null);
          // Pause'daysa elapsed'ı dondur, çalışıyorsa serbest bırak
          setRemotePausedAt((is_paused || is_break_paused) ? (pausedAt || null) : null);
          if (isRunningRef2.current) {
            remoteStoppedRef.current = true;
            setIsRunning(false);
          }
        } else {
          const wasRemote = !!remoteDevice;
          setRemoteDevice(null);
          setRemoteStart(null);
          setRemotePausedAt(null);
          if (wasRemote && refreshStudyHistory) {
            setTimeout(() => refreshStudyHistory(), 500);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling fallback: Realtime çalışmasa bile başka cihazın devraldığını yakala.
  // Timer çalışırken her 5sn'de bir DB'yi kontrol et.
  // Realtime varsa zaten anında durur; bu sadece güvenlik ağı.
  useEffect(() => {
    if (!user || !isOnline) return;
    const poll = setInterval(async () => {
      if (!isRunningRef2.current) return; // duraklıysa gereksiz sorgu yapma
      const { data } = await supabase
        .from('users')
        .select('active_session_device, work_started_at, work_paused_at, is_working, is_on_break, is_paused, is_break_paused, last_seen, last_heartbeat_at')
        .eq('id', user.id)
        .single();
      if (!data) return;
      const { active_session_device: dev, work_started_at: start,
              work_paused_at: pausedAt,
              is_working, is_on_break, is_paused, is_break_paused,
              last_seen, last_heartbeat_at } = data;
      const sessionActive = is_working || is_on_break || is_paused || is_break_paused;
      const lastHbMs   = last_heartbeat_at ? new Date(last_heartbeat_at).getTime() : 0;
      const lastSeenMs = last_seen         ? new Date(last_seen).getTime()         : 0;
      const deviceAlive = lastHbMs > 0
        ? (serverNow() - lastHbMs)   < 90 * 1000
        : lastSeenMs > 0 && (serverNow() - lastSeenMs) < 5 * 60 * 1000;
      if (dev && dev !== DEVICE_LABEL && sessionActive && deviceAlive) {
        if (isRunningRef2.current) {
          remoteStoppedRef.current = true;
          setIsRunning(false);
        }
        setRemoteDevice(parseDeviceName(dev));
        setRemoteStart(start || null);
        setRemotePausedAt((is_paused || is_break_paused) ? (pausedAt || null) : null);
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [user?.id, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─────────────────────────────────────────────────────────────────────────

  // Uygulama açıldığında bekleyen offline veriyi DB'ye sync et
  // (goOnline yalnızca online→offline→online geçişinde tetiklenir;
  //  baştan zaten online olan kullanıcılar için bu effect devreye girer)
  const startupSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!user || !isOnline) return;
    if (startupSyncDoneRef.current) return;
    startupSyncDoneRef.current = true;
    const pending = getOfflineData(user.id);
    if (pending >= 1) syncToDB();
  }, [user?.id, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Remote Session Bitti → study_history Hemen Güncelle ────────────────────
  // Device A oturumu bitirince active_session_device = null olur.
  // Bu cihazda (Device B) remoteDevice null'a döner → DB'den taze study_history çek.
  const prevRemoteDeviceRef = useRef(null);
  useEffect(() => {
    const prev = prevRemoteDeviceRef.current;
    prevRemoteDeviceRef.current = remoteDevice;
    if (prev && !remoteDevice && refreshStudyHistory) {
      // 500ms: Device A'nın log_study_session yazması tamamlansın, sonra çek
      const t = setTimeout(() => refreshStudyHistory(), 500);
      return () => clearTimeout(t);
    }
  }, [remoteDevice]); // eslint-disable-line react-hooks/exhaustive-deps
  // ──────────────────────────────────────────────────────────────────────────

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

  // Başka cihazdan kontrolü geri al — timer'ı bu sekmeye aktar
  const takeOver = useCallback(async () => {
    if (!user) return;

    // 1. DB'den TAZE veri çek — closure'daki userData stale olabilir, work_started_at null gelebilir
    const { data: fresh } = await supabase
      .from('users')
      .select('work_started_at, break_started_at, work_duration, break_duration, is_free_mode, is_on_break, is_break_paused')
      .eq('id', user.id)
      .single();

    // 2. Bu sekmeyi aktif cihaz olarak DB'ye yaz — çalışan sekme Realtime ile bunu görür ve durur
    await supabase
      .from('users')
      .update({ active_session_device: DEVICE_LABEL })
      .eq('id', user.id)
      .catch(() => {});

    // 3. Remote banner'ı kapat
    setRemoteDevice(null);
    setRemoteStart(null);
    restoredForUserRef.current = user.id;

    // 4. Veri kaynağı: DB'den taze veri, yoksa remoteStart / userData fallback
    const wStarted   = fresh?.work_started_at  || remoteStart || userData?.work_started_at;
    const bStarted   = fresh?.break_started_at || userData?.break_started_at;
    const wDur       = fresh?.work_duration    || userData?.work_duration   || 25 * 60;
    const bDur       = fresh?.break_duration   || userData?.break_duration  || 5 * 60;
    const isFree     = fresh?.is_free_mode     ?? userData?.is_free_mode    ?? false;
    const onBreak    = fresh?.is_on_break      ?? userData?.is_on_break     ?? false;
    const brkPaused  = fresh?.is_break_paused  ?? userData?.is_break_paused ?? false;

    const now = serverNow();
    setWorkMins(Math.round(wDur / 60));
    setBreakMins(Math.round(bDur / 60));
    setIsFreeMode(isFree);

    if (isFree) {
      // Serbest mod: wStarted varsa elapsed hesapla, yoksa 0'dan başla
      const elapsed = wStarted
        ? Math.max(0, Math.floor((now - new Date(wStarted).getTime()) / 1000))
        : 0;
      setFreeTime(elapsed);
      setSessionWorked(elapsed);
      setIsOnBreak(false);
      setIsRunning(true);
    } else if (!onBreak && !brkPaused) {
      // Çalışma modu: wStarted varsa kaldığı yerden devam et, yoksa baştan başla
      if (wStarted) {
        const elapsed   = Math.max(0, Math.floor((now - new Date(wStarted).getTime()) / 1000));
        const remaining = wDur - elapsed;
        if (remaining > 0) {
          setTimeLeft(remaining);
          setSessionWorked(elapsed);
          pausedSessionWorkedRef.current = elapsed;
        } else {
          // Süre dolmuş — baştan başlat
          setTimeLeft(wDur);
          setSessionWorked(0);
          pausedSessionWorkedRef.current = 0;
        }
      } else {
        // work_started_at hiç yazılmamış — baştan başlat (DB lag)
        setTimeLeft(wDur);
        setSessionWorked(0);
        pausedSessionWorkedRef.current = 0;
      }
      setIsOnBreak(false);
      setIsRunning(true); // "Devam et" = her koşulda başlat
    } else if (onBreak || brkPaused) {
      // Mola modu
      if (bStarted) {
        const elapsed   = Math.max(0, Math.floor((now - new Date(bStarted).getTime()) / 1000));
        const remaining = bDur - elapsed;
        setIsOnBreak(true);
        if (remaining > 0) {
          setTimeLeft(remaining);
          setIsRunning(true);
        } else {
          setIsOnBreak(false);
          setTimeLeft(wDur);
          setIsRunning(true);
        }
      } else {
        // Mola bilgisi yok — çalışma moduna geç
        setIsOnBreak(false);
        setTimeLeft(wDur);
        setIsRunning(true);
      }
    }
  }, [user, userData, remoteStart]);

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

  const handleStartStop = useCallback(async () => {
    if (isRunning) {
      // Duraklat — kilit kontrolü gerekmez
      setIsRunning(false);
      return;
    }
    // Başlatma: çevrimiçiyse önce stale session temizle, ardından atomik kilit al
    if (user && isOnlineRef.current) {
      try {
        // 1. get_active_session: nabız yoksa/eskiyse DB'yi temizler (şarj bitti vb.)
        //    Aktif oturum varsa → remote banner'ı göster, başlatma
        const { data: sessions } = await supabase.rpc('get_active_session');
        const session = Array.isArray(sessions) ? sessions[0] : sessions;
        if (session?.is_active && session?.device_name && session.device_name !== DEVICE_LABEL) {
          setRemoteDevice(parseDeviceName(session.device_name));
          return;
        }
        // 2. Stale session temizlendi ya da hiç yoktu — atomik kilit al
        const { data: deviceGot, error } = await supabase.rpc('start_study_session', { p_device_name: DEVICE_LABEL });
        if (!error && deviceGot && deviceGot !== DEVICE_LABEL) {
          // Başka cihaz henüz kilitlendi (race condition) — remote banner'a geç
          setRemoteDevice(parseDeviceName(deviceGot));
          return;
        }
        // error varsa (RPC yok / ağ sorunu) → yerel başlat
      } catch {
        // Ağ hatası → yerel başlat
      }
    }
    setIsRunning(true);
  }, [isRunning, user]);

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

    if (actionType === 'break') {
      // Break'e geç: sayacı sıfırla, break modunu aç
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
      // Bitir: timer'ı hemen durdur, state'i sıfırla
      setIsRunning(false);
      setIsOnBreak(false);
      if (isFreeMode) setFreeTime(0);
      else setTimeLeft(workMins * 60);
      setSessionWorked(0);
      pausedSessionWorkedRef.current = 0;
      timerStartedAtRef.current = null;
      sessionActiveRef.current = false;
      if (workedSecs > 0) {
        await saveStudyTime(workedSecs);
        setTotalStudySecs(prev => prev + workedSecs);
      }
    }
  }, [sessionWorked, breakMins, workMins, isFreeMode, user?.id, saveStudyTime, setTotalStudySecs]);

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
    remoteDevice, remoteStart, remotePausedAt, pausedByOffline,
    selectPreset, handleStartStop, handleSkipToBreak,
    handleFinish, confirmAction, handleSliderChange
  };
}
