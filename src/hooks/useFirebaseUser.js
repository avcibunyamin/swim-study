import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { serverISOString } from '../utils/serverTime';
import { getOfflineData, clearOfflineData } from '../utils/offlineStorage';

export default function usePresence({
  user, isOnline, setIsOnline,
  sessionWorked, setSessionWorked, setIsRunning,
  setTotalStudySecs, setNotification,
  setFriends, setFriendRequests, setSentRequests,
  saveStudyTime, pausedSessionWorkedRef
}) {
  const heartbeatRef = useRef(null);
  const channelRef = useRef(null);
  const sessionWorkedRef = useRef(sessionWorked);
  useEffect(() => { sessionWorkedRef.current = sessionWorked; }, [sessionWorked]);

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
          const { data } = await supabase.from('users').select('total_study_secs').eq('id', user.id).single();
          if (data) {
            await supabase.from('users').update({
              total_study_secs: (data.total_study_secs || 0) + pending
            }).eq('id', user.id);
          }
          setTotalStudySecs(prev => prev + pending);
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
      if (isActive && isOnline) {
        await supabase.from('users').update({ is_online: true, last_seen: serverISOString() }).eq('id', user.id).then(undefined, () => {});
      } else if (!isActive) {
        await supabase.from('users').update({ is_online: false, last_seen: serverISOString() }).eq('id', user.id).then(undefined, () => {});
        const sw = sessionWorkedRef.current;
        if (sw > 0) {
          await saveStudyTime?.(sw);
          pausedSessionWorkedRef.current = sw;
          setSessionWorked(0);
          setIsRunning(false);
        }
      }
    }).then(h => { listenerHandle = h; });
    return () => { listenerHandle?.remove(); };
  }, [user, isOnline, saveStudyTime, pausedSessionWorkedRef, setSessionWorked, setIsRunning]);

  // Arkadaş ve friend request realtime dinleyici
  useEffect(() => {
    if (!user) return;

    // Arkadaşları ve istekleri yükle
    const loadFriendsData = async () => {
      const [{ data: fships }, { data: requests }, { data: sent }] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        supabase.from('friend_requests').select('from_user_id, from_username, from_full_name, from_avatar, created_at').eq('to_user_id', user.id),
        supabase.from('friend_requests').select('to_user_id').eq('from_user_id', user.id),
      ]);
      if (fships) setFriends(fships.map(f => f.friend_id));
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
