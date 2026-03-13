import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { serverISOString } from '../utils/serverTime';
import { getOfflineData, clearOfflineData } from '../utils/offlineStorage';

export default function usePresence({
  user, isOnline, setIsOnline,
  setTotalStudySecs, setStudyHistory, setNotification,
  setFriends, setFriendRequests, setSentRequests,
}) {
  const heartbeatRef = useRef(null);
  const channelRef = useRef(null);

  // Online/offline takibi
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      if (user) {
        await supabase.from('users').update({
          is_online: true,
          last_seen: serverISOString()
        }).eq('id', user.id).then(undefined, () => {});

        // Offline çalışma süresi varsa sync et
        const pending = getOfflineData(user.id);
        if (pending > 0) {
          const today = new Date().toISOString().split('T')[0];
          const [{ data: todayEntry }, { data: userData }] = await Promise.all([
            supabase.from('study_history').select('secs').eq('user_id', user.id).eq('date', today).maybeSingle(),
            supabase.from('users').select('total_study_secs').eq('id', user.id).single(),
          ]);
          if (userData) {
            const newDaySecs = (todayEntry?.secs || 0) + pending;
            const newTotal   = (userData.total_study_secs || 0) + pending;
            await Promise.all([
              supabase.from('study_history').upsert(
                { user_id: user.id, date: today, secs: newDaySecs },
                { onConflict: 'user_id,date' }
              ),
              supabase.from('users').update({ total_study_secs: newTotal }).eq('id', user.id),
            ]);
            // Lokal history'yi DB'deki güncel değerle hizala (sayfa yenilenmiş olabilir)
            setStudyHistory(prev => {
              const arr = prev.filter(h => h.date !== today);
              return [...arr, { date: today, secs: newDaySecs }]
                .sort((a, b) => b.date.localeCompare(a.date));
            });
            // NOT: setTotalStudySecs burada çağrılmıyor — timer bitince zaten güncellendi.
            // Çağrılırsa double-count olur.
          }
          clearOfflineData(user.id);
        }
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [user, setIsOnline, setTotalStudySecs]);

  // Heartbeat (her 60s)
  useEffect(() => {
    if (!user || !isOnline) return;
    heartbeatRef.current = setInterval(async () => {
      await supabase.from('users').update({
        is_online: true,
        last_seen: serverISOString()
      }).eq('id', user.id).then(undefined, () => {});
    }, 60000);
    return () => clearInterval(heartbeatRef.current);
  }, [user, isOnline]);

  // Sayfa kapatılırken offline yap
  useEffect(() => {
    if (!user) return;
    const handleUnload = () => {
      navigator.sendBeacon && navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
        JSON.stringify({ is_online: false })
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  // Visibility change
  useEffect(() => {
    if (!user) return;
    const handleVisibility = async () => {
      if (document.hidden) {
        await supabase.from('users').update({ last_seen: serverISOString() }).eq('id', user.id).then(undefined, () => {});
      } else if (isOnline) {
        await supabase.from('users').update({ is_online: true, last_seen: serverISOString() }).eq('id', user.id).then(undefined, () => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, isOnline]);

  // Capacitor app state
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    let listenerHandle;
    CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        // Ön plana gelince Supabase'e ping at — başarılıysa online, banner kalkar
        const { error } = await supabase
          .from('users')
          .update({ is_online: true, last_seen: serverISOString() })
          .eq('id', user.id);
        if (!error) setIsOnline(true);
        // NOT: Timer'a dokunmuyoruz — usePomodoro kendi interval'ı ile
        // elapsed süreyi otomatik hesaplayıp timeLeft'i düzeltiyor
      } else {
        // Arka plana gidince sadece presence güncelle, timer'ı durdurma
        await supabase
          .from('users')
          .update({ is_online: false, last_seen: serverISOString() })
          .eq('id', user.id)
          .then(undefined, () => {});
      }
    }).then(h => { listenerHandle = h; });
    return () => { listenerHandle?.remove(); };
  }, [user, setIsOnline]);

  // Arkadaş ve friend request realtime dinleyici
  useEffect(() => {
    if (!user) return;

    // Arkadaşları ve istekleri yükle
    const loadFriendsData = async () => {
      const [{ data: fships1 }, { data: fships2 }, { data: requests }, { data: sent }] = await Promise.all([
        // Kendi oluşturduğumuz satırlar: user_id = bizim id
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        // Karşı tarafın oluşturduğu satırlar: friend_id = bizim id
        // (RLS SELECT politikası izin veriyorsa — vermiyorsa boş döner, sorun değil)
        supabase.from('friendships').select('user_id').eq('friend_id', user.id),
        supabase.from('friend_requests').select('from_user_id, from_username, from_full_name, from_avatar, created_at').eq('to_user_id', user.id),
        supabase.from('friend_requests').select('to_user_id').eq('from_user_id', user.id),
      ]);
      // fships1 null dönerse (RLS hatası / ağ sorunu) mevcut listeyi silme
      if (fships1 !== null) {
        const ids = [...new Set([
          ...fships1.map(f => f.friend_id),
          ...(fships2?.map(f => f.user_id) || []),
        ])];
        setFriends(ids);
        // Sonraki açılışta anında göster
        try { localStorage.setItem(`swim_friends_${user.id}`, JSON.stringify(ids)); } catch {}
      }
      if (requests) setFriendRequests(requests.slice(0, 50).map(r => ({
        fromUserId: r.from_user_id,
        fromUsername: r.from_username,
        fromFullName: r.from_full_name,
        fromAvatar: r.from_avatar,
        timestamp: r.created_at
      })));
      if (sent) setSentRequests(sent.map(s => s.to_user_id));
    };

    loadFriendsData();

    // Friend requests realtime (polling yaklaşımı — bandwidth tasarrufu)
    const interval = setInterval(loadFriendsData, 30000);

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, setFriends, setFriendRequests, setSentRequests]);
}
