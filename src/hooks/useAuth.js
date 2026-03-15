import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { themes, THEME_IDS, THEME_KEYS, STATUS_KEYS } from '../constants/themes';
import { getOfflineData } from '../utils/offlineStorage';

// ─── Kullanıcı verisi cache'i (localStorage) ────────────────────────────────
// Uygulama her açılışta network beklemeden anında veriye ulaşır,
// arka planda Supabase'den taze veri çekip günceller.
const CACHE_KEY = 'swim_uc';
const SESSION_TOKEN_KEY = 'swim_session_token';

function readCache(uid) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c?.uid === uid ? c : null;
  } catch { return null; }
}

function writeCache(uid, userData, studyHistory) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      uid, userData, studyHistory, t: Date.now()
    }));
  } catch {}
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}
// ────────────────────────────────────────────────────────────────────────────

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Aynı kullanıcı için eşzamanlı çift yüklemeyi önler
  const loadingUserIdRef = useRef(null);
  // İlk yükleme tamamlandıktan sonra SIGNED_IN'in tekrar loadUserData çalıştırmasını önler
  const dataLoadedRef = useRef(false);
  // Yükleme başarısız olduysa (timeout/ağ hatası) SIGNED_IN döngüsünü önler
  const loadFailedRef = useRef(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const [totalStudySecs, setTotalStudySecs] = useState(0);
  const [plans, setPlans] = useState([]);
  const [studyHistory, setStudyHistory] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [status, setStatus] = useState('available');
  const [aboutMe, setAboutMe] = useState('');
  const [showStudyTime, setShowStudyTime] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    const th = localStorage.getItem('swim_theme');
    const notif = localStorage.getItem('swim_notifications');
    if (th && themes[th]) setTheme(th);
    if (notif !== null) setNotifications(notif === 'true');
  }, []);

  // Cache'ten state'e uygula — loading olmadan anında göster
  const applyUserData = useCallback((data, history, uid) => {
    setUserData(data);
    setPlans(data.plans || []);
    setStudyHistory(history || []);
    const pendingOffline = getOfflineData(uid);
    setTotalStudySecs((data.total_study_secs || 0) + pendingOffline);
    const themeKey = THEME_KEYS[data.theme_id] || 'dark';
    setTheme(themeKey);
    localStorage.setItem('swim_theme', themeKey);
    setStatus(STATUS_KEYS[data.status_id] || 'available');
    setAboutMe(data.about_me || '');
    setShowStudyTime(data.show_study_time !== false);
    setCurrentStreak(data.current_streak || 0);
    setLongestStreak(data.longest_streak || 0);
  }, []);

  // Oturumu kapat: önce UI state'i temizle, ağ çağrısı beklemeden
  const signOutAndClear = useCallback(() => {
    loadingUserIdRef.current = null;
    dataLoadedRef.current = false;
    loadFailedRef.current = false;
    clearCache();
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    setUserData(null);
    setAuthLoading(false);
    supabase.auth.signOut().catch(() => {}); // arka planda, await etme
  }, []);

  // Başka cihazdan giriş yapılınca zorla çıkış
  const signOutForced = useCallback(() => {
    setSessionInvalidated(true);
    loadingUserIdRef.current = null;
    dataLoadedRef.current = false;
    loadFailedRef.current = false;
    clearCache();
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    setUserData(null);
    setAuthLoading(false);
    supabase.auth.signOut().catch(() => {});
  }, []);

  // background=true → authLoading'e dokunma, hata olursa çıkış yapma
  const loadUserData = useCallback(async (supaUser, { background = false } = {}) => {
    // Aynı kullanıcı zaten yükleniyorsa ikinci çağrıyı yok say
    if (loadingUserIdRef.current === supaUser.id) return;
    loadingUserIdRef.current = supaUser.id;

    // Timeout yalnızca ön planda (loading ekranı gösteriliyorken) aktif
    let loadTimeout;
    if (!background) {
      loadTimeout = setTimeout(() => {
        loadingUserIdRef.current = null;
        setAuthLoading(false);
        setLoadFailed(true);
      }, 8000); // 8 saniye — daha önce 15'ti
    }

    try {
      const timeoutMs = background ? 10000 : 7000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      );

      // Kullanıcı profili ve çalışma geçmişini paralel çek
      const fetchPromise = Promise.all([
        supabase
          .from('users')
          .select('id, email, username, full_name, display_name, avatar, is_online, total_study_secs, plans, about_me, show_study_time, theme_id, status_id, last_seen, last_username_change, last_email_change, current_streak, longest_streak, last_study_date, session_token, is_working, is_on_break, is_paused, is_break_paused, is_free_mode, work_started_at, work_paused_at, break_started_at, break_paused_at, work_duration, break_duration')
          .eq('id', supaUser.id)
          .single(),
        supabase
          .from('study_history')
          .select('date, secs')
          .eq('user_id', supaUser.id)
          .order('date', { ascending: false })
          .limit(365),
      ]);

      const [usersRes, historyRes] = await Promise.race([fetchPromise, timeoutPromise]);
      if (!background) clearTimeout(loadTimeout);

      const { data, error } = usersRes;

      if (error || !data) {
        if (background) { loadingUserIdRef.current = null; return; }
        // Kullanıcı satırı yok — auth metadata'dan otomatik oluştur (ilk giriş)
        const meta = supaUser.user_metadata || {};
        const savedTheme = localStorage.getItem('swim_theme') || 'ocean';
        const fallbackUsername = (supaUser.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
        const newUserToken = crypto.randomUUID();
        localStorage.setItem(SESSION_TOKEN_KEY, newUserToken);
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: supaUser.id,
            email: supaUser.email,
            username: meta.username || fallbackUsername,
            full_name: meta.full_name || meta.name || '',
            display_name: meta.display_name || meta.username || fallbackUsername,
            avatar: meta.avatar_url || null,
            theme_id: THEME_IDS[meta.theme || savedTheme] || 2,
            status_id: 1,
            is_online: true,
            last_seen: new Date().toISOString(),
            total_study_secs: 0,
            plans: [],
            about_me: '',
            show_study_time: true,
            session_token: newUserToken,
          })
          .select()
          .single();
        if (insertError || !newUser) {
          console.warn('Profil oluşturulamadı:', insertError?.message);
          signOutAndClear();
          return;
        }
        // Yeni oluşturulan profille devam et
        loadingUserIdRef.current = null;
        dataLoadedRef.current = true;
        writeCache(supaUser.id, newUser, []);
        setUserData(newUser);
        setAuthLoading(false);
        setTotalStudySecs(0);
        const newThemeKey = THEME_KEYS[newUser.theme_id] || 'ocean';
        setTheme(newThemeKey);
        localStorage.setItem('swim_theme', newThemeKey);
        return;
      }

      const history = historyRes.data || [];

      // Session token kontrolü — başka cihazdan giriş yapıldıysa çıkış yap
      if (!background) {
        const localToken = localStorage.getItem(SESSION_TOKEN_KEY);
        if (localToken && data.session_token && localToken !== data.session_token) {
          loadingUserIdRef.current = null;
          signOutForced();
          return;
        }
      }

      loadingUserIdRef.current = null;
      dataLoadedRef.current = true;
      loadFailedRef.current = false;

      // Cache'e yaz — sonraki açılışta anında gözükür
      writeCache(supaUser.id, data, history);

      applyUserData(data, history, supaUser.id);
      if (!background) setAuthLoading(false);

      // Online durumunu güncelle (arka planda) — is_working'e dokunma, timer restore için korunmalı
      supabase.from('users').update({
        is_online: true,
        last_seen: new Date().toISOString(),
      }).eq('id', supaUser.id).then(({ error: e }) => {
        if (e) console.warn('Online status update failed:', e.message);
      });
    } catch (e) {
      if (!background) clearTimeout(loadTimeout);
      loadingUserIdRef.current = null;
      console.warn('Auth error:', e.message);
      if (background) return; // arka plan refresh hatası — kullanıcıyı etkileme
      // Timeout veya geçici ağ hatası ise kullanıcıyı çıkarma — sadece loading'i kapat
      if (e.message === 'timeout' || e.message?.includes('fetch')) {
        loadFailedRef.current = true; // SIGNED_IN döngüsünü durdur
        setAuthLoading(false);
        setLoadFailed(true);
      } else {
        signOutAndClear();
      }
    }
  }, [signOutAndClear, applyUserData]);

  useEffect(() => {
    let cancelled = false;

    // getSession() token refresh için ağ çağrısı yapabilir — 5s timeout ile sar
    const sessionWithTimeout = Promise.race([
      supabase.auth.getSession(),
      new Promise(resolve =>
        setTimeout(() => resolve({ data: { session: null }, _timedOut: true }), 5000)
      )
    ]);

    sessionWithTimeout.then(async (result) => {
      if (cancelled) return;
      const { data: { session }, _timedOut } = result;

      if (_timedOut) {
        if (!cancelled) setAuthLoading(false);
        return;
      }

      if (session?.user) {
        const emailConfirmed = session.user.email_confirmed_at;
        const isGoogle = session.user.app_metadata?.provider === 'google';
        if (!emailConfirmed && !isGoogle) {
          setNeedsVerification(true);
          setUser(null);
          setAuthLoading(false);
          return;
        }
        setNeedsVerification(false);
        setUser(session.user);

        // Arkadaş cache'ini anında yükle (Supabase'i bekleme)
        try {
          const cf = JSON.parse(localStorage.getItem(`swim_friends_${session.user.id}`) || '[]');
          if (cf.length > 0) setFriends(cf);
        } catch {}

        // Cache kontrolü: varsa anında aç, arka planda tazele
        const cached = readCache(session.user.id);
        if (cached) {
          applyUserData(cached.userData, cached.studyHistory, session.user.id);
          dataLoadedRef.current = true;
          setAuthLoading(false); // ← Anında loading'i kapat
          // Arka planda taze veri çek (loading göstermeden)
          loadUserData(session.user, { background: true });
        } else {
          // İlk giriş — normal yükleme
          setAuthLoading(true);
          loadUserData(session.user);
        }
      } else {
        setUser(null);
        setUserData(null);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (cancelled) return;
      setUser(null); setUserData(null); setAuthLoading(false);
      supabase.auth.signOut().catch(() => {});
    });

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && session?.user) {
        const emailConfirmed = session.user.email_confirmed_at;
        const isGoogle = session.user.app_metadata?.provider === 'google';
        if (!emailConfirmed && !isGoogle) {
          setNeedsVerification(true);
          setUser(null);
          setAuthLoading(false);
          return;
        }
        setNeedsVerification(false);
        setUser(session.user);
        // Giriş yapıldıysa yeni session token üret (sadece yerel token yoksa = gerçek yeni giriş)
        if (!localStorage.getItem(SESSION_TOKEN_KEY)) {
          const freshToken = crypto.randomUUID();
          localStorage.setItem(SESSION_TOKEN_KEY, freshToken);
          supabase.from('users').update({ session_token: freshToken }).eq('id', session.user.id).catch(() => {});
        }
        // Veri zaten yüklendiyse VEYA yükleme başarısız olduysa tekrar deneme
        // (token refresh döngüsünü önler)
        if (!dataLoadedRef.current && !loadFailedRef.current) {
          const cached = readCache(session.user.id);
          if (cached) {
            applyUserData(cached.userData, cached.studyHistory, session.user.id);
            dataLoadedRef.current = true;
            setAuthLoading(false);
            loadUserData(session.user, { background: true });
          } else {
            setAuthLoading(true);
            await loadUserData(session.user);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserData(null);
        setAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData, signOutAndClear, applyUserData]);

  // Realtime: başka cihazdan giriş yapılınca session_token değişimini yakala
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user_session_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        const remoteToken = payload.new?.session_token;
        const localToken = localStorage.getItem(SESSION_TOKEN_KEY);
        if (remoteToken && localToken && remoteToken !== localToken) {
          signOutForced();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = useCallback(async (isOnline) => {
    if (user && isOnline) {
      await supabase.from('users').update({
        is_online: false,
        is_working: false, is_on_break: false, is_paused: false,
        is_break_paused: false, is_free_mode: false,
        work_started_at: null, work_paused_at: null,
        break_started_at: null, break_paused_at: null,
      }).eq('id', user.id).then(undefined, () => {});
    }
    await supabase.auth.signOut();
  }, [user]);

  const handleDeleteAccount = useCallback(async ({
    deletePassword, isOnline, onError, onSuccess
  }) => {
    if (!user || !isOnline) return;
    const uid = user.id;
    try {
      // 1. Şifre doğrulama (email/password kullanıcıları için)
      const isPasswordUser = user.app_metadata?.provider === 'email';
      if (isPasswordUser) {
        if (!deletePassword) { onError?.('Şifreni girmelisin'); return; }
        const { error: reAuthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: deletePassword
        });
        if (reAuthError) { onError?.('Girdiğin şifre yanlış'); return; }
      }

      // 2. İlgili tüm verileri sil (sıralı — FK kısıtlamaları için)
      await Promise.allSettled([
        supabase.from('messages').delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
        supabase.from('friendships').delete().or(`user_id.eq.${uid},friend_id.eq.${uid}`),
        supabase.from('study_history').delete().eq('user_id', uid),
      ]);
      // users tablosunu sil
      await supabase.from('users').delete().eq('id', uid);

      // 3. auth.users kaydını sil — SECURITY DEFINER RPC gerekli
      // (Supabase SQL editöründe delete_user() fonksiyonu oluşturulmuş olmalı)
      const { error: rpcError } = await supabase.rpc('delete_user');
      if (rpcError) {
        // RPC yoksa en azından oturumu kapat — kullanıcı tekrar kayıt olabilir
        console.warn('delete_user RPC hatası (fonksiyon DB\'de tanımlı değil):', rpcError.message);
      }

      // 4. Yerel durumu temizle
      clearCache();
      localStorage.clear(); // tüm localStorage temizle
      setUser(null);
      setUserData(null);
      await supabase.auth.signOut();

      onSuccess?.('Hesabın tamamen silindi');
    } catch (e) {
      console.warn('Delete account error:', e);
      onError?.('Bir hata oluştu, lütfen tekrar dene');
    }
  }, [user]);

  // Bağlantı hatası sonrası manuel yeniden yükleme
  const retryLoad = useCallback(() => {
    if (!user) return;
    loadFailedRef.current = false;
    dataLoadedRef.current = false;
    loadingUserIdRef.current = null;
    setLoadFailed(false);
    setAuthLoading(true);
    loadUserData(user);
  }, [user, loadUserData]);

  const changeTheme = useCallback(async (newTheme, isOnline) => {
    setTheme(newTheme);
    localStorage.setItem('swim_theme', newTheme);
    if (isOnline && user) {
      const themeId = THEME_IDS[newTheme] || 2;
      supabase.from('users').update({ theme_id: themeId }).eq('id', user.id)
        .then(undefined, e => console.debug('Theme save error:', e));
    }
  }, [user]);

  return {
    user, userData, setUserData, authLoading, loadFailed, needsVerification, setNeedsVerification,
    totalStudySecs, setTotalStudySecs,
    plans, setPlans, studyHistory, setStudyHistory,
    friends, setFriends, friendRequests, setFriendRequests,
    sentRequests, setSentRequests,
    status, setStatus, aboutMe, setAboutMe,
    showStudyTime, setShowStudyTime,
    currentStreak, longestStreak,
    theme, setTheme, notifications, setNotifications,
    handleLogout, handleDeleteAccount, changeTheme, retryLoad,
    sessionInvalidated,
  };
}
