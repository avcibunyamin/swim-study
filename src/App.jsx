import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Home, Calendar, Timer, Users, User, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';
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
import useFriends from './hooks/useFriends';
import usePlans from './hooks/usePlans';
import useStats from './hooks/useStats';

// Components
import AuthScreen from './components/auth/AuthScreen';
import HomePage from './components/home/HomePage';
import PlanPage from './components/plan/PlanPage';
import PomodoroPage from './components/pomodoro/PomodoroPage';
import FriendsPage from './components/friends/FriendsPage';
import ProfilePage from './components/profile/ProfilePage';
import NavBar from './components/shared/NavBar';
import Toast from './components/ui/Toast';

const isNative = Capacitor.isNativePlatform();

// Native platform başlangıç ayarları — React render'dan ÖNCE çalışır
if (isNative) {
  try { LocalNotifications.requestPermissions(); } catch (e) { console.debug('Notification permission error:', e); }
}

export default function SwimApp() {
  const { t, ta } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('swim_page');
    return saved && ['home', 'plan', 'pomodoro', 'friends', 'profile'].includes(saved) ? saved : 'home';
  });
  const [navPosition, setNavPosition] = useState(() => {
    if (isNative) return 'bottom';
    const saved = localStorage.getItem('swim_nav_position');
    return saved && ['bottom', 'top', 'left', 'right'].includes(saved) ? saved : 'bottom';
  });

  // UI modal durumları
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null);
  const [showRemoveFriend, setShowRemoveFriend] = useState(null);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showChat, setShowChat] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [notification, setNotification] = useState(null);
  const [toast, setToast] = useState(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [healthTipIdx, setHealthTipIdx] = useState(0);
  const [calDate, setCalDate] = useState(new Date());

  // Auth hook
  const authHook = useAuth();
  const {
    user, userData, setUserData, authLoading, loadFailed, needsVerification, setNeedsVerification,
    totalStudySecs, setTotalStudySecs,
    plans, setPlans, studyHistory, setStudyHistory, refreshStudyHistory,
    friends, setFriends, friendRequests, setFriendRequests,
    sentRequests, setSentRequests,
    status, setStatus, aboutMe, setAboutMe,
    showStudyTime, setShowStudyTime,
    currentStreak, longestStreak,
    theme: themeKey, setTheme: setThemeKey, notifications, setNotifications,
    handleLogout: authLogout, handleDeleteAccount, changeTheme, retryLoad,
    sessionInvalidated,
  } = authHook;

  const themeObj = themes[themeKey] || themes.dark;

  // Pomodoro hook
  const pomodoroHook = usePomodoro({
    user, userData, isOnline,
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

  // Presence hook (online/offline, heartbeat, görünürlük)
  usePresence({
    user, isOnline, setIsOnline,
    setTotalStudySecs, setStudyHistory, setNotification,
    setFriends, setFriendRequests, setSentRequests,
  });

  // Friends hook
  const friendsHook = useFriends({
    user, userData, isOnline,
    friends, setFriends,
    friendRequests, setFriendRequests,
    sentRequests, setSentRequests,
    status,
  });
  const {
    friendsData, unreadMessages, setUnreadMessages,
    searchUsers, sendFriendRequest, acceptFriendRequest,
    rejectFriendRequest, removeFriend
  } = friendsHook;

  // Plans hook
  const { savePlans } = usePlans({ user, isOnline, plans, setPlans });

  // Stats hook
  const { statsPeriod, setStatsPeriod, statsOffset, setStatsOffset, getStatsData } = useStats({ studyHistory });

  // Türetilmiş değerler
  const totalUnread = useMemo(() => Object.values(unreadMessages).reduce((a, b) => a + b, 0), [unreadMessages]);
  const currentAchievement = useMemo(() => getAchievement(totalStudySecs / 60, ta), [totalStudySecs, ta]);
  const nextAchievement = useMemo(() => getNextAchievement(totalStudySecs / 60, ta), [totalStudySecs, ta]);
  const getPresetLabel = useCallback(() => isFreeMode ? t('pomodoro.freeMode') : `${workMins}/${breakMins}`, [isFreeMode, workMins, breakMins, t]);

  // Takvim hesaplanan değerleri
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Nav konfigürasyonu
  const isVerticalNav = !isNative && (navPosition === 'left' || navPosition === 'right');
  const navConfig = useMemo(() => {
    if (isNative) return { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pb-32 px-4', timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false };
    const c = {
      bottom: { navCls: 'fixed bottom-0 inset-x-0 border-t', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pb-24 p-4', timerCls: 'absolute -top-8 left-1/2 -translate-x-1/2', vertical: false },
      top: { navCls: 'fixed top-0 inset-x-0 border-b', innerCls: 'grid grid-cols-5 max-w-md mx-auto', pagePad: 'pt-20 px-4 pb-4', timerCls: 'absolute -bottom-8 left-1/2 -translate-x-1/2', vertical: false },
      left: { navCls: 'fixed left-0 inset-y-0 border-r w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: 'pl-20 px-4 pb-4', timerCls: 'absolute -right-16 top-2 whitespace-nowrap', vertical: true },
      right: { navCls: 'fixed right-0 inset-y-0 border-l w-16', innerCls: 'flex flex-col items-center justify-center gap-1 h-full', pagePad: 'pr-20 px-4 pb-4', timerCls: 'absolute -left-16 top-2 whitespace-nowrap', vertical: true },
    };
    return c[navPosition] || c.bottom;
  }, [navPosition]);

  // Sayfa kalıcılığı
  useEffect(() => { localStorage.setItem('swim_page', page); }, [page]);
  useEffect(() => { if (!isNative) localStorage.setItem('swim_nav_position', navPosition); }, [navPosition]);
  const changeNavPosition = useCallback((pos) => { if (!isNative) setNavPosition(pos); }, []);

  // Toast helper
  const handleCloseToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((type, message, title) => {
    setToast({ type, message, title });
  }, []);

  // Bildirimi 4 saniye sonra kapat
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Klavye açılınca aktif input'u görünür alana getir (iOS/Android)
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
    // Native status bar rengini ve ikon stilini temaya göre güncelle
    if (isNative) {
      // overlay: true → status bar şeffaf, arkaplan görünür. Sadece ikon rengi ayarlanır.
      try { StatusBar.setStyle({ style: themeKey === 'light' ? Style.Dark : Style.Light }); } catch (e) {}
    }
  }, [themeObj]);

  // Alıntı & sağlık ipucu döngüsü
  useEffect(() => { const i = setInterval(() => setQuoteIdx(q => (q + 1) % 4), 5000); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => setHealthTipIdx(h => (h + 1) % 10), 30000); return () => clearInterval(i); }, []);

  // Google OAuth deep link callback (com.swimstudy.app://login-callback#access_token=...)
  useEffect(() => {
    if (!isNative) return;
    const handler = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith('com.swimstudy.app://')) return;
      const hashOrQuery = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
      const params = new URLSearchParams(hashOrQuery);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  // Android geri tuşu yöneticisi
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapApp.addListener('backButton', () => {
      if (showChat || showSettings || showEditProfile || showPlanModal || showRequestsModal || showDeleteConfirm || showRemoveFriend || showConfirm) {
        setShowChat(null); setShowSettings(false); setShowEditProfile(false);
        setShowPlanModal(false); setShowRequestsModal(false); setShowDeleteConfirm(false);
        setShowRemoveFriend(null); setShowConfirm(null);
      } else if (page !== 'home') { setPage('home'); }
      else { CapApp.minimizeApp(); }
    });
    return () => { handler.then(h => h.remove()); };
  }, [page, showChat, showSettings, showEditProfile, showPlanModal, showRequestsModal, showDeleteConfirm, showRemoveFriend, showConfirm]);

  // Confirm action sarmalayıcı
  const confirmAction = useCallback(async () => {
    const action = showConfirm;
    setShowConfirm(null);           // Modal anında kapanır — çift tıklamayı engeller
    await pomodoroConfirmAction(action);
  }, [showConfirm, pomodoroConfirmAction]);

  // Çıkış sarmalayıcı
  const handleLogout = useCallback(async () => {
    await authLogout(isOnline);
    setShowSettings(false);
  }, [authLogout, isOnline]);

  // Yükleme ekranı
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-teal-400" />
      </div>
    );
  }

  // Bağlantı hatası ekranı — sadece açık hata durumunda göster (geçici loading sırasında değil)
  if (user && !userData && loadFailed) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 size={40} className="text-slate-600" />
        <p className="text-slate-300 font-medium">Sunucuya bağlanılamadı</p>
        <p className="text-slate-500 text-sm">İnternet bağlantını kontrol et ve tekrar dene.</p>
        <button
          onClick={retryLoad}
          className="mt-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  // Auth ekranı
  if (!user) {
    return (
      <>
        {sessionInvalidated && (
          <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-sm text-center py-3 px-4 font-medium">
            Hesabın başka bir cihazda açıldığı için oturum kapatıldı.
          </div>
        )}
        <AuthScreen />
      </>
    );
  }

  return (
    <div className={`${themeObj.bg} min-h-screen`} onClick={unlockAudio}>
      {/* Native: Dynamic Island / safe area boşluğu — gradient arkada devam eder, içerik aşağıda başlar */}
      {isNative && <div style={{ height: 'env(safe-area-inset-top, 62px)', minHeight: 44 }} />}
      <Toast toast={toast} onClose={handleCloseToast} />
      <div key={page} className="animate-page-in">
      {page === 'home' && (
        <HomePage
          theme={themeObj} pagePadding={navConfig.pagePad}
          userData={userData} totalStudySecs={totalStudySecs}
          currentAchievement={currentAchievement} nextAchievement={nextAchievement}
          studyHistory={studyHistory} statsPeriod={statsPeriod} setStatsPeriod={setStatsPeriod}
          statsOffset={statsOffset} setStatsOffset={setStatsOffset} stats={getStatsData}
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
          notification={notification} setNotification={setNotification}
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
      {page === 'friends' && (
        <FriendsPage
          theme={themeObj} pagePadding={navConfig.pagePad}
          user={user} userData={userData} isOnline={isOnline}
          friends={friends} friendsData={friendsData}
          friendRequests={friendRequests} sentRequests={sentRequests}
          unreadMessages={unreadMessages} status={status} setStatus={setStatus}
          searchUsers={searchUsers} sendFriendRequest={sendFriendRequest}
          acceptFriendRequest={acceptFriendRequest} rejectFriendRequest={rejectFriendRequest}
          removeFriend={removeFriend}
          showRemoveFriend={showRemoveFriend} setShowRemoveFriend={setShowRemoveFriend}
          showRequestsModal={showRequestsModal} setShowRequestsModal={setShowRequestsModal}
          showChat={showChat} setShowChat={setShowChat}
          setUnreadMessages={setUnreadMessages}
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
themeKey={themeKey} changeTheme={(th) => changeTheme(th, isOnline)}
          notifications={notifications} setNotifications={setNotifications}
          showSettings={showSettings} setShowSettings={setShowSettings}
          showEditProfile={showEditProfile} setShowEditProfile={setShowEditProfile}
          showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm}
          handleLogout={handleLogout}
          handleDeleteAccount={() => handleDeleteAccount({
            deletePassword, isOnline,
            onError: (msg) => showToast('error', msg),
            onSuccess: (msg) => showToast('success', msg)
          })}
          isOnline={isOnline} deletePassword={deletePassword} setDeletePassword={setDeletePassword}
        />
      )}

      </div>
      <NavBar
        theme={themeObj} navConfig={navConfig} page={page} setPage={setPage}
        isRunning={isRunning} isOnBreak={isOnBreak} isFreeMode={isFreeMode}
        freeTime={freeTime} timeLeft={timeLeft}
        friendRequests={friendRequests}
        totalUnread={totalUnread}
      />

      <audio ref={audioRef} loop />
    </div>
  );
}
