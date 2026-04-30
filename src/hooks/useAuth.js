import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { themes, THEME_IDS, THEME_KEYS } from '../constants/themes';

const isNative = Capacitor.isNativePlatform();
const STREAK_MIN_SECS = 60; // En az 1 dakika çalışınca seri sayılır
const REMINDER_IDS = [8001, 8002, 8003, 8004];
const REMINDER_HOURS = [10, 14, 18, 21];

// Streak hatırlatma bildirimlerini zamanla (bugün henüz çalışmadıysa)
async function scheduleStreakReminders(studyHistory, currentStreak) {
  if (!isNative || currentStreak < 1) return;
  try {
    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) });
    const today = localDateStr();
    const todaySecs = studyHistory.find(h => h.date === today)?.secs || 0;
    if (todaySecs >= STREAK_MIN_SECS) return; // Bugün zaten çalıştı

    const now = new Date();
    const toSchedule = [];
    REMINDER_HOURS.forEach((hour, i) => {
      const fireAt = new Date();
      fireAt.setHours(hour, 0, 0, 0);
      if (fireAt > now) {
        toSchedule.push({
          id: REMINDER_IDS[i],
          title: '🔥 Seri tehlikede!',
          body: `${currentStreak} günlük serinizi korumak için bugün en az 1 dakika çalışın!`,
          schedule: { at: fireAt },
          sound: null,
        });
      }
    });
    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {}
}

// Kullanıcı bugün yeterince çalıştıysa hatırlatmaları iptal et
async function cancelStreakReminders() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) });
  } catch {}
}

// ─── Local Storage Keys ───────────────────────────────────────────────────────
const PROFILE_KEY   = 'swim_local_profile';
const HISTORY_KEY   = 'swim_local_history';
const TIMER_SNAP_KEY = 'swim_timer_snap';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
}

function saveProfile(profile) {
  try { if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

const MAX_DAY_SECS = 24 * 3600; // günlük 24 saat cap (serverTime.js ile senkron)

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    // Güvenlik: her günün süresi 0–16 saat arasında olmalı, format YYYY-MM-DD
    return raw.filter(h =>
      h && typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) &&
      typeof h.secs === 'number' && h.secs >= 0
    ).map(h => ({ ...h, secs: Math.min(h.secs, MAX_DAY_SECS) }));
  } catch { return []; }
}

function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreaks(history) {
  if (!history?.length) return { current: 0, longest: 0 };
  const dates = new Set(history.filter(h => h.secs >= STREAK_MIN_SECS).map(h => h.date));

  // Mevcut seri: bugün çalışmadıysa 0, çalıştıysa geriye say
  const today = localDateStr();
  let current = 0;
  if (dates.has(today)) {
    let d = new Date();
    while (dates.has(localDateStr(d))) {
      current++;
      d.setDate(d.getDate() - 1);
    }
  }

  // En uzun seri — tüm geçmişten hesapla
  const sorted = [...dates].sort();
  let longest = 0, cur = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      cur = 1;
    } else {
      const prev = new Date(sorted[i - 1]);
      prev.setDate(prev.getDate() + 1);
      cur = localDateStr(prev) === sorted[i] ? cur + 1 : 1;
    }
    longest = Math.max(longest, cur);
  }

  // En uzun seriyi localStorage'a kaydet (history silinse bile korunsun)
  const savedLongest = parseInt(localStorage.getItem('swim_longest_streak') || '0', 10);
  const newLongest = Math.max(longest, savedLongest);
  if (newLongest > savedLongest) localStorage.setItem('swim_longest_streak', String(newLongest));

  return { current, longest: newLongest };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function useAuth() {
  const [user, setUser]               = useState(null);
  const [userData, setUserDataState]  = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [totalStudySecs, setTotalStudySecs] = useState(0);
  const [plans, setPlans]             = useState([]);
  const [studyHistory, setStudyHistory] = useState([]);
  const [status, setStatus]           = useState('available');
  const [aboutMe, setAboutMe]         = useState('');
  const [showStudyTime, setShowStudyTime] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [theme, setTheme]             = useState('dark');
  const [notifications, setNotifications] = useState(true);
  const [healthTips, setHealthTips] = useState(true);

  // Ref to always have latest plans for safe persistence
  const plansRef = useRef(plans);
  useEffect(() => { plansRef.current = plans; }, [plans]);

  // ─── Mount: load from localStorage ─────────────────────────────────────────
  useEffect(() => {
    const profile = loadProfile();
    if (profile) {
      setUser({ id: profile.id, email: null });
      setUserDataState(profile);
      setPlans(profile.plans || []);
      setTotalStudySecs(profile.total_study_secs || 0);
      setAboutMe(profile.about_me || '');
      setShowStudyTime(profile.show_study_time !== false);

      const th = THEME_KEYS[profile.theme_id] || localStorage.getItem('swim_theme') || 'dark';
      setTheme(th);

      const history = loadHistory();
      setStudyHistory(history);
      const { current, longest } = calcStreaks(history);
      setCurrentStreak(current);
      setLongestStreak(longest);
    } else {
      const th = localStorage.getItem('swim_theme') || 'dark';
      if (themes[th]) setTheme(th);
    }

    const notif = localStorage.getItem('swim_notifications');
    if (notif !== null) setNotifications(notif === 'true');

    const tips = localStorage.getItem('swim_health_tips');
    if (tips !== null) setHealthTips(tips === 'true');

    setAuthLoading(false);
  }, []);

  // ─── Persist study history → update streaks + bildirim yönetimi ─────────────
  useEffect(() => {
    if (!user) return;
    saveHistory(studyHistory);
    const { current, longest } = calcStreaks(studyHistory);
    setCurrentStreak(current);
    setLongestStreak(longest);

    // Bugün yeterince çalışıldıysa hatırlatmaları iptal et, yoksa zamanla
    const today = localDateStr();
    const todaySecs = studyHistory.find(h => h.date === today)?.secs || 0;
    if (todaySecs >= STREAK_MIN_SECS) {
      cancelStreakReminders();
    } else if (current >= 1) {
      scheduleStreakReminders(studyHistory, current);
    }
  }, [studyHistory, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist totalStudySecs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    try {
      const profile = loadProfile();
      if (profile) { profile.total_study_secs = totalStudySecs; saveProfile(profile); }
    } catch {}
  }, [totalStudySecs, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist plans ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    try {
      const profile = loadProfile();
      if (profile) { profile.plans = plans; saveProfile(profile); }
    } catch {}
  }, [plans, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── setUserData: update state + persist ─────────────────────────────────────
  const setUserData = useCallback((newData) => {
    setUserDataState(newData);
    if (newData) saveProfile({ ...newData, plans: plansRef.current });
  }, []);

  // ─── Create user (called from AuthScreen) ────────────────────────────────────
  const createLocalUser = useCallback((profile) => {
    saveProfile(profile);
    saveHistory([]);
    setUser({ id: profile.id, email: null });
    setUserDataState(profile);
    setPlans(profile.plans || []);
    setTotalStudySecs(profile.total_study_secs || 0);
    setAboutMe(profile.about_me || '');
    setShowStudyTime(true);
    setStudyHistory([]);
    setCurrentStreak(0);
    setLongestStreak(0);
    const th = THEME_KEYS[profile.theme_id] || 'dark';
    setTheme(th);
  }, []);

  // ─── refreshStudyHistory: re-read from localStorage ──────────────────────────
  const refreshStudyHistory = useCallback(async () => {
    const history = loadHistory();
    setStudyHistory(history);
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    setUser(null);
    setUserDataState(null);
    setPlans([]);
    setStudyHistory([]);
    setTotalStudySecs(0);
  }, []);

  // ─── Delete account ───────────────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(async ({ onSuccess }) => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(TIMER_SNAP_KEY);
    localStorage.removeItem('swim_page');
    setUser(null);
    setUserDataState(null);
    onSuccess?.('Hesabın silindi');
  }, []);

  // ─── changeTheme ──────────────────────────────────────────────────────────────
  const changeTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('swim_theme', newTheme);
    setUserDataState(prev => {
      if (!prev) return prev;
      const updated = { ...prev, theme_id: THEME_IDS[newTheme] || 2 };
      saveProfile(updated);
      return updated;
    });
  }, []);

  const retryLoad = useCallback(() => {}, []);

  return {
    user, userData, setUserData, authLoading,
    loadFailed: false, needsVerification: false, setNeedsVerification: () => {},
    totalStudySecs, setTotalStudySecs,
    plans, setPlans, studyHistory, setStudyHistory, refreshStudyHistory,
    friends: [], setFriends: () => {},
    friendRequests: [], setFriendRequests: () => {},
    sentRequests: [], setSentRequests: () => {},
    status, setStatus, aboutMe, setAboutMe,
    showStudyTime, setShowStudyTime,
    currentStreak, longestStreak,
    theme, setTheme, notifications, setNotifications,
    healthTips, setHealthTips,
    handleLogout, handleDeleteAccount, changeTheme, retryLoad,
    sessionInvalidated: false,
    createLocalUser,
  };
}
