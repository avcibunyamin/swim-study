import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

if (isNative) {
  try { LocalNotifications.requestPermissions(); } catch (e) { console.debug('Notification permission error:', e); }
}

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
    handleLogout: authLogout, handleDeleteAccount, changeTheme,
    createLocalUser,
  } = authHook;

  const themeObj = themes[themeKey] || themes.dark;

  // Pomodoro hook
  const pomodoroHook = usePomodoro({
    user, isOnline,
    setTotalStudySecs, setStudyHistory, refreshStudyHistory,
    notifications, t
  });
  const {
    workMins, setWorkMins, breakMins, setBreakMins,
    timeLeft, setTimeLeft, isRunning, setIsRunning,
    isOnBreak, setIsOnBreak, isFreeMode, setIsFreeMode,
    freeTime, setFreeTime, sessionWorked, setSessionWorked,
    sound, setSound, audioRef,
    pausedSessionWorkedRef,
    saveStudyTime,
    remoteDevice, remoteStart, remotePausedAt, pausedByOffline,
    selectPreset, handleStartStop, handleSkipToBreak,
    handleFinish, confirmAction: pomodoroConfirmAction, handleSliderChange
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
  const firstDay    = new Date(year, month, 1).getDay();

  // Nav konfigürasyonu
  const isVerticalNav = !isNative && (navPosition === 'left' || navPosition === 'right');
  const navConfig = useMemo(() => {
    if (isNative) return { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pb-32 px-4 pt-2', timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false };
    const c = {
      bottom: { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pb-24 p-4', timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false },
      top:    { navCls: 'fixed top-0 inset-x-0 border-b',   innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pt-20 px-4 pb-4', timerCls: 'absolute -bottom-8 left-1/2 -translate-x-1/2', vertical: false },
      left:   { navCls: 'fixed left-0 inset-y-0 border-r w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: 'pl-20 px-4 pb-4', timerCls: 'absolute -right-16 top-2 whitespace-nowrap', vertical: true },
      right:  { navCls: 'fixed right-0 inset-y-0 border-l w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: 'pr-20 px-4 pb-4', timerCls: 'absolute -left-16 top-2 whitespace-nowrap', vertical: true },
    };
    return c[navPosition] || c.bottom;
  }, [navPosition]);

  // Sayfa kalıcılığı
  useEffect(() => { localStorage.setItem('swim_page', page); }, [page]);
  useEffect(() => { if (!isNative) localStorage.setItem('swim_nav_position', navPosition); }, [navPosition]);
  const changeNavPosition = useCallback((pos) => { if (!isNative) setNavPosition(pos); }, []);

  // Toast helper
  const handleCloseToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((type, message, title) => { setToast({ type, message, title }); }, []);

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

  // Body arka planını tema ile eşitle
  useEffect(() => {
    const color = themeObj.bodyBg || '#000000';
    document.body.style.backgroundColor = color;
    document.documentElement.style.backgroundColor = color;
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
      createLocalUser(profile);
    }} />;
  }

  // iOS safe area
  const sh = window.screen.height;
  const safeTop    = isNative ? Math.round(sh >= 852 ? 59 : sh >= 812 ? 47 : 20) : 0;
  const safeBottom = isNative ? (sh >= 812 ? 34 : 0) : 0;
  if (safeBottom > 0) {
    document.documentElement.style.setProperty('--sab', safeBottom + 'px');
  }

  return (
    <div className={`${themeObj.bg} min-h-screen`} onClick={unlockAudio}>
      {safeTop > 0 && <>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: safeTop, zIndex: 9999, backgroundColor: themeObj.bodyBg, pointerEvents: 'none' }} />
        <div style={{ height: safeTop, width: '100%', flexShrink: 0 }} />
      </>}

      <Toast toast={toast} onClose={handleCloseToast} />

      <div key={page} className="animate-page-in">
        {page === 'home' && (
          <HomePage
            theme={themeObj} pagePadding={navConfig.pagePad}
            userData={userData} totalStudySecs={totalStudySecs}
            currentAchievement={currentAchievement} nextAchievement={nextAchievement}
            plans={plans} savePlans={savePlans} isOnline={isOnline}
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
            sound={sound} setSound={setSound} audioRef={audioRef}
            isOnline={isOnline} user={user} getPresetLabel={getPresetLabel}
            studyHistory={studyHistory}
            remoteDevice={remoteDevice} remoteStart={remoteStart} remotePausedAt={remotePausedAt} pausedByOffline={pausedByOffline}
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
            showSettings={showSettings} setShowSettings={setShowSettings}
            showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile}
            showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
            handleLogout={handleLogout}
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
