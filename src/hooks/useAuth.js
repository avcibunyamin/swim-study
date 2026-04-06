import { useState, useEffect, useCallback, useRef } from 'react';
import { themes, THEME_IDS, THEME_KEYS } from '../constants/themes';

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

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function calcStreaks(history) {
  if (!history?.length) return { current: 0, longest: 0 };
  const dates = new Set(history.filter(h => h.secs > 0).map(h => h.date));

  // Current streak: start from today, fallback to yesterday (grace period)
  const today = new Date().toISOString().split('T')[0];
  let d = new Date();
  if (!dates.has(today)) d.setDate(d.getDate() - 1);

  let current = 0;
  while (dates.has(d.toISOString().split('T')[0])) {
    current++;
    d.setDate(d.getDate() - 1);
  }

  // Longest streak
  const sorted = [...dates].sort();
  let longest = 0, cur = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      cur = 1;
    } else {
      const prev = new Date(sorted[i - 1]);
      prev.setDate(prev.getDate() + 1);
      cur = prev.toISOString().split('T')[0] === sorted[i] ? cur + 1 : 1;
    }
    longest = Math.max(longest, cur);
  }

  return { current, longest };
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

    setAuthLoading(false);
  }, []);

  // ─── Persist study history → update streaks ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    saveHistory(studyHistory);
    const { current, longest } = calcStreaks(studyHistory);
    setCurrentStreak(current);
    setLongestStreak(longest);
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
    handleLogout, handleDeleteAccount, changeTheme, retryLoad,
    sessionInvalidated: false,
    createLocalUser,
  };
}
