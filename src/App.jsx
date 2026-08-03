import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Home, Calendar, Timer, BarChart3, User, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useLanguage } from './i18n';

// Constants
import { themes } from './constants/themes';
import { getAchievement, getNextAchievement } from './constants/achievements';

// Utils
import { fmt } from './utils/formatters';
import { unlockAudio } from './utils/audio';

// Hooks
import useAuth from './hooks/useAuth';
import usePresence from './hooks/usePresence';
import usePomodoro from './hooks/usePomodoro';
import usePlans from './hooks/usePlans';
import useStats from './hooks/useStats';

// Components
import AuthScreen from './components/auth/AuthScreen';
import HomePage from './components/home/HomePage';
import PlanPage from './components/plan/PlanPage';
import PomodoroPage from './components/pomodoro/PomodoroPage';
import PerformancePage from './components/performance/PerformancePage';
import ProfilePage from './components/profile/ProfilePage';
import NavBar from './components/shared/NavBar';
import Toast from './components/ui/Toast';

const isNative = Capacitor.isNativePlatform();

// Bildirim izni artık kullanıcı bell butonunu açınca isteniyor (PomodoroPage)

const VALID_PAGES = ['home', 'plan', 'pomodoro', 'performance', 'profile'];

export default function SwimApp() {
  const { t, ta } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('swim_page');
    return saved && VALID_PAGES.includes(saved) ? saved : 'home';
  });
  const [navPosition, setNavPosition] = useState(() => {
    if (isNative) return 'bottom';
    const saved = localStorage.getItem('swim_nav_position');
    return saved && ['bottom', 'top', 'left', 'right'].includes(saved) ? saved : 'bottom';
  });
  const [weekStart, setWeekStart] = useState(() => {
    const saved = localStorage.getItem('swim_week_start');
    return saved === '0' ? 0 : 1; // 0=Pazar, 1=Pazartesi (varsayılan)
  });

  // UI modal durumları
  const [showSettings,     setShowSettings]     = useState(false);
  const [showEditProfile,  setShowEditProfile]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPlanModal,    setShowPlanModal]     = useState(false);
  const [showConfirm,      setShowConfirm]       = useState(null);
  const [selDate,          setSelDate]           = useState(null);
  const [deletePassword,   setDeletePassword]    = useState('');
  const [toast,            setToast]             = useState(null);
  const [calDate,          setCalDate]           = useState(new Date());

  // Auth hook
  const authHook = useAuth();
  const {
    user, userData, setUserData, authLoading,
    totalStudySecs, setTotalStudySecs,
    plans, setPlans, studyHistory, setStudyHistory, refreshStudyHistory,
    status, setStatus, aboutMe, setAboutMe,
    showStudyTime, setShowStudyTime,
    currentStreak, longestStreak,
    theme: themeKey, setTheme: setThemeKey, notifications, setNotifications,
    healthTips, setHealthTips,
    dailyGoalMins, setDailyGoalMins,
    handleLogout: authLogout, handleDeleteAccount, changeTheme,
    createLocalUser,
  } = authHook;

  const themeObj = themes[themeKey] || themes.dark;

  // Toast helper — pomodoro hook için ileriye taşındı
  const showToastRef = useRef(null);

  // Pomodoro hook
  const pomodoroHook = usePomodoro({
    user, isOnline,
    setTotalStudySecs, setStudyHistory, refreshStudyHistory,
    notifications, healthTips, t,
    showToast: (...args) => showToastRef.current?.(...args),
  });
  const {
    workMins, setWorkMins, breakMins, setBreakMins,
    timeLeft, setTimeLeft, isRunning, setIsRunning,
    isOnBreak, setIsOnBreak, isFreeMode, setIsFreeMode,
    freeTime, setFreeTime, sessionWorked, setSessionWorked,
    sound, setSound, audioRef,
    pausedSessionWorkedRef,
    saveStudyTime,
    selectPreset, handleStartStop, handleSkipToBreak,
    handleFinish, confirmAction: pomodoroConfirmAction, handleSliderChange,
  } = pomodoroHook;

  // Presence hook (online/offline)
  usePresence({ isOnline, setIsOnline });

  // Plans hook
  const { savePlans } = usePlans({ plans, setPlans });

  // Stats hook
  const { statsPeriod, setStatsPeriod, statsOffset, setStatsOffset, getStatsData } = useStats({ studyHistory });

  // Türetilmiş değerler
  const currentAchievement = useMemo(() => getAchievement(totalStudySecs / 60, ta), [totalStudySecs, ta]);
  const nextAchievement    = useMemo(() => getNextAchievement(totalStudySecs / 60, ta), [totalStudySecs, ta]);
  const getPresetLabel     = useCallback(() => isFreeMode ? t('pomodoro.freeMode') : `${workMins}/${breakMins}`, [isFreeMode, workMins, breakMins, t]);

  // Takvim hesaplanan değerleri
  const year        = calDate.getFullYear();
  const month       = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay(); // ham JS değeri, PlanPage içinde weekStart'a göre offset uygulanıyor

  // Nav konfigürasyonu
  //
  // COL: içerik sütununu sınırla ve ortala. Telefonda (375px) etkisi yok,
  // ekran zaten dar. iPad ve Mac'te ise bu olmadan kartlar 1000px+ genişliğe
  // yayılıyor ve uygulama gerilmiş bir telefon arayüzü gibi duruyor —
  // Apple'ın iPad uygulamalarında geri çevirme sebeplerinden biri.
  // Zemin dıştaki kapsayıcıda olduğu için burada sınırlamak arka planı bozmaz.
  const COL = 'max-w-2xl mx-auto w-full';
  const navConfig = useMemo(() => {
    if (isNative) return { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: `pb-32 px-4 pt-2 ${COL}`, timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false };
    const c = {
      bottom: { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: `pb-24 p-4 ${COL}`, timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false },
      top:    { navCls: 'fixed top-0 inset-x-0 border-b',   innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: `pt-20 px-4 pb-4 ${COL}`, timerCls: 'absolute -bottom-8 left-1/2 -translate-x-1/2', vertical: false },
      left:   { navCls: 'fixed left-0 inset-y-0 border-r w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: `pl-20 px-4 pb-4 ${COL}`, timerCls: 'absolute -right-16 top-2 whitespace-nowrap', vertical: true },
      right:  { navCls: 'fixed right-0 inset-y-0 border-l w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: `pr-20 px-4 pb-4 ${COL}`, timerCls: 'absolute -left-16 top-2 whitespace-nowrap', vertical: true },
    };
    return c[navPosition] || c.bottom;
  }, [navPosition]);

  // Sayfa kalıcılığı
  useEffect(() => { localStorage.setItem('swim_page', page); }, [page]);
  useEffect(() => { if (!isNative) localStorage.setItem('swim_nav_position', navPosition); }, [navPosition]);
  useEffect(() => { localStorage.setItem('swim_week_start', String(weekStart)); }, [weekStart]);
  const changeNavPosition = useCallback((pos) => { if (!isNative) setNavPosition(pos); }, []);

  // Toast helper
  const handleCloseToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((type, message, title) => { setToast({ type, message, title }); }, []);
  // showToast'ı pomodoro hook'una geçirmek için ref güncel tut
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // Klavye (iOS/Android)
  useEffect(() => {
    if (!isNative) return;
    let sub;
    (async () => {
      sub = await Keyboard.addListener('keyboardDidShow', () => {
        document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    })();
    return () => { sub?.remove(); };
  }, []);

  // Sayfa değişince en üstten başla
  const pageScrollRef = useRef(null);
  useEffect(() => {
    if (pageScrollRef.current) pageScrollRef.current.scrollTop = 0;
    // Fallback: window/body scroll sıfırlama
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [page]);

  // Body arka planını tema ile eşitle
  useEffect(() => {
    const color = themeObj.bodyBg || '#000000';
    document.body.style.backgroundColor = color;
    document.documentElement.style.backgroundColor = color;
    // index.css bu niteliğe bakarak vurgu paletini değiştirir; aydınlık temada
    // turkuaz tonları laciverte çevrilir (beyaz üstünde okunmuyorlardı).
    document.documentElement.setAttribute('data-theme', themeObj.key);
    if (isNative) {
      try { StatusBar.setStyle({ style: themeKey === 'light' ? Style.Dark : Style.Light }); } catch (e) {}
      try { window.webkit?.messageHandlers?.updateStatusBarStyle?.postMessage(themeKey === 'light' ? 'dark' : 'light'); } catch (e) {}
      try { window.webkit?.messageHandlers?.updateStatusBarBg?.postMessage(color); } catch (e) {}
    }
  }, [themeObj]);

  // Android geri tuşu yöneticisi
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapApp.addListener('backButton', () => {
      if (showSettings || showEditProfile || showPlanModal || showDeleteConfirm || showConfirm) {
        setShowSettings(false); setShowEditProfile(false);
        setShowPlanModal(false); setShowDeleteConfirm(false); setShowConfirm(null);
      } else if (page !== 'home') { setPage('home'); }
      else { CapApp.minimizeApp(); }
    });
    return () => { handler.then(h => h.remove()); };
  }, [page, showSettings, showEditProfile, showPlanModal, showDeleteConfirm, showConfirm]);

  // Confirm action sarmalayıcı
  const confirmAction = useCallback(async () => {
    const action = showConfirm;
    setShowConfirm(null);
    await pomodoroConfirmAction(action);
  }, [showConfirm, pomodoroConfirmAction]);

  // Çıkış sarmalayıcı
  const handleLogout = useCallback(async () => {
    await authLogout();
    setShowSettings(false);
  }, [authLogout]);

  // Yükleme ekranı
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-teal-400" />
      </div>
    );
  }

  // Auth ekranı
  if (!user) {
    return <AuthScreen onUserCreated={(profile) => {
      setShowDeleteConfirm(false);
      setShowSettings(false);
      setToast(null);
      createLocalUser(profile);
    }} />;
  }

  return (
    <div className={`${themeObj.bg} min-h-screen`} onClick={unlockAudio}>
      {/* iOS safe area — üst boşluk her cihaz için env() ile otomatik */}
      {isNative && <>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'env(safe-area-inset-top, 0px)', zIndex: 9999, backgroundColor: themeObj.bodyBg, pointerEvents: 'none' }} />
        <div style={{ height: 'env(safe-area-inset-top, 0px)', width: '100%', flexShrink: 0 }} />
      </>}

      <Toast toast={toast} onClose={handleCloseToast} />

      <div ref={pageScrollRef} key={page} className="animate-page-in" style={{ overflowY: 'auto' }}>
        {page === 'home' && (
          <HomePage
            theme={themeObj} pagePadding={navConfig.pagePad}
            userData={userData} totalStudySecs={totalStudySecs}
            currentAchievement={currentAchievement} nextAchievement={nextAchievement}
            plans={plans} savePlans={savePlans} isOnline={isOnline}
            studyHistory={studyHistory} dailyGoalMins={dailyGoalMins}
          />
        )}
        {page === 'plan' && (
          <PlanPage
            theme={themeObj} pagePadding={navConfig.pagePad}
            calDate={calDate} setCalDate={setCalDate}
            plans={plans} savePlans={savePlans}
            year={year} month={month} daysInMonth={daysInMonth} firstDay={firstDay}
            isOnline={isOnline} showPlanModal={showPlanModal} setShowPlanModal={setShowPlanModal}
            selDate={selDate} setSelDate={setSelDate}
            weekStart={weekStart}
          />
        )}
        {page === 'pomodoro' && (
          <PomodoroPage
            theme={themeObj} pagePadding={navConfig.pagePad}
            workMins={workMins} breakMins={breakMins} timeLeft={timeLeft}
            isRunning={isRunning} isOnBreak={isOnBreak} isFreeMode={isFreeMode}
            freeTime={freeTime} sessionWorked={sessionWorked}
            totalStudySecs={totalStudySecs} selectPreset={selectPreset}
            handleStartStop={handleStartStop}
            handleSkipToBreak={() => { const r = handleSkipToBreak(); if (r) setShowConfirm(r); }}
            handleFinish={() => { const r = handleFinish(); if (r) setShowConfirm(r); }}
            handleSliderChange={handleSliderChange}
            showConfirm={showConfirm} setShowConfirm={setShowConfirm}
            confirmAction={confirmAction}
            notifications={notifications} setNotifications={setNotifications}
            sound={sound} setSound={setSound} audioRef={audioRef}
            isOnline={isOnline} user={user} getPresetLabel={getPresetLabel}
            studyHistory={studyHistory}
          />
        )}
        {page === 'performance' && (
          <PerformancePage
            theme={themeObj} pagePadding={navConfig.pagePad}
            totalStudySecs={totalStudySecs}
            currentStreak={currentStreak} longestStreak={longestStreak}
            currentAchievement={currentAchievement} nextAchievement={nextAchievement}
            statsPeriod={statsPeriod} setStatsPeriod={setStatsPeriod}
            statsOffset={statsOffset} setStatsOffset={setStatsOffset}
            stats={getStatsData}
            studyHistory={studyHistory} weekStart={weekStart}
          />
        )}
        {page === 'profile' && (
          <ProfilePage
            theme={themeObj} pagePadding={navConfig.pagePad}
            navPosition={navPosition} changeNavPosition={changeNavPosition}
            user={user} userData={userData} setUserData={setUserData}
            totalStudySecs={totalStudySecs} currentAchievement={currentAchievement}
            currentStreak={currentStreak} longestStreak={longestStreak}
            showStudyTime={showStudyTime} setShowStudyTime={setShowStudyTime}
            themeKey={themeKey} changeTheme={(th) => changeTheme(th)}
            notifications={notifications} setNotifications={setNotifications}
            healthTips={healthTips} setHealthTips={setHealthTips}
            dailyGoalMins={dailyGoalMins} setDailyGoalMins={setDailyGoalMins}
            showSettings={showSettings} setShowSettings={setShowSettings}
            showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile}
            showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
            handleLogout={handleLogout}
            weekStart={weekStart} setWeekStart={setWeekStart}
            handleDeleteAccount={() => handleDeleteAccount({
              onError:   (msg) => showToast('error', msg),
              onSuccess: (msg) => { setShowDeleteConfirm(false); showToast('success', msg); }
            })}
            isOnline={isOnline} deletePassword={deletePassword} setDeletePassword={setDeletePassword}
          />
        )}
      </div>

      <NavBar
        theme={themeObj} navConfig={navConfig} page={page} setPage={setPage}
        isRunning={isRunning} isOnBreak={isOnBreak} isFreeMode={isFreeMode}
        freeTime={freeTime} timeLeft={timeLeft}
      />

      <audio ref={audioRef} loop />
    </div>
  );
}
