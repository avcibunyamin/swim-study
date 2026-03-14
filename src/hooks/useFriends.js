import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { normalize } from '../utils/sanitize';
import { STATUS_KEYS } from '../constants/themes';

// status_id (smallint) → status string dönüştür
const mapFriend = f => ({
  ...f,
  status: STATUS_KEYS[f.status_id] || 'available',
  lastSeen: f.last_seen,
  // camelCase alias — UI bu isimleri kullanıyor
  isWorking:      f.is_working,
  isPaused:       f.is_paused,
  isBreakPaused:  f.is_break_paused || false,
  showStudyTime:  f.show_study_time,
  workDuration:   f.work_duration,
  workStartedAt:  f.work_started_at,
  workPausedAt:   f.work_paused_at,
  breakDuration:  f.break_duration,
  breakStartedAt: f.break_started_at,
  breakPausedAt:  f.break_paused_at,
  isFreeMode:     f.is_free_mode,
  isOnBreak:      f.is_on_break,
});

const FRIENDS_DATA_KEY = uid => `swim_fdata_${uid}`;
const readFriendsDataCache = uid => { try { return JSON.parse(localStorage.getItem(FRIENDS_DATA_KEY(uid)) || 'null'); } catch { return null; } };
const writeFriendsDataCache = (uid, data) => { try { localStorage.setItem(FRIENDS_DATA_KEY(uid), JSON.stringify(data)); } catch {} };

export default function useFriends({
  user, userData, isOnline,
  friends, setFriends,
  friendRequests, setFriendRequests,
  sentRequests, setSentRequests,
  status,
}) {
  const [friendsData, setFriendsData] = useState(() => readFriendsDataCache(user?.id) || []);
  const [unreadMessages, setUnreadMessages] = useState({});
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const friendsKey = useMemo(() => [...friends].sort().join(','), [friends]);

  // Arkadaş verileri — Supabase Realtime ile gerçek zamanlı
  useEffect(() => {
    if (!user || friends.length === 0) { setFriendsData([]); return; }

    // Cache varsa anında göster, Supabase'den gelince güncelle
    const cached = readFriendsDataCache(user.id);
    if (cached?.length) setFriendsData(cached.filter(f => friends.includes(f.id)));

    supabase
      .from('users')
      .select('id, username, display_name, full_name, avatar, is_online, last_seen, status_id, is_working, is_on_break, is_paused, is_break_paused, work_duration, work_started_at, work_paused_at, break_duration, break_started_at, break_paused_at, is_free_mode, show_study_time, total_study_secs')
      .in('id', friends)
      .then(({ data }) => {
        if (data) {
          const mapped = data.map(mapFriend);
          setFriendsData(mapped);
          writeFriendsDataCache(user.id, mapped);
        }
      });

    // Her arkadaş için Realtime dinleyici
    const channels = friends.map(fid =>
      supabase.channel(`friend-${fid}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${fid}` },
          payload => {
            console.log('[Realtime] friend UPDATE', fid, payload.new);
            setFriendsData(prev => {
              const idx = prev.findIndex(f => f.id === fid);
              if (idx >= 0) {
                const arr = [...prev];
                // Mevcut veriyle birleştir — payload.new eksik alan içerebilir
                arr[idx] = mapFriend({ ...arr[idx], ...payload.new });
                writeFriendsDataCache(user.id, arr);
                return arr;
              }
              return prev;
            });
          }
        )
        .subscribe(status => console.log('[Realtime] friend channel', fid, status))
    );

    return () => channels.forEach(ch => supabase.removeChannel(ch));
  }, [friendsKey, user?.id]);

  // Arkadaş listesi değişince bayat veriyi temizle
  useEffect(() => {
    setFriendsData(prev => prev.filter(f => friends.includes(f.id)));
  }, [friendsKey]);

  // Okunmamış mesaj sayıları — Realtime + ilk yükleme
  useEffect(() => {
    if (!user || friends.length === 0) return;

    const loadUnread = async () => {
      const counts = {};
      await Promise.all(friends.map(async fid => {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', fid)
          .eq('receiver_id', user.id)
          .eq('is_read', false);
        counts[fid] = count || 0;
      }));
      setUnreadMessages(counts);
    };

    loadUnread();

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => {
          const msg = payload.new;
          if (friends.includes(msg.sender_id) && !msg.is_read && statusRef.current !== 'busy') {
            setUnreadMessages(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => {
          if (payload.new.is_read && !payload.old.is_read) {
            const fid = payload.new.sender_id;
            setUnreadMessages(prev => ({ ...prev, [fid]: Math.max(0, (prev[fid] || 0) - 1) }));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [friendsKey, user?.id]);

  // Kullanıcı arama — search_users RPC (server-side, güvenli)
  // - hidden kullanıcılar (status_id=3) DB'de eleniyor
  // - friendship_status alanı ile N+1 kontrolü ortadan kalktı
  const searchUsers = useCallback(async txt => {
    if (!txt.trim() || !isOnline) return [];
    const searchQuery = normalize(txt);
    if (searchQuery.length < 2) return [];
    try {
      const { data, error } = await supabase.rpc('search_users', {
        p_query:     searchQuery,
        p_caller_id: user.id,
        p_limit:     10,
      });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.debug('Search error:', e);
      return [];
    }
  }, [isOnline, user?.id]);

  const sendFriendRequest = useCallback(async toUser => {
    if (!user || friends.includes(toUser.id) || sentRequests.includes(toUser.id) || !isOnline) return;
    try {
      // Kota kontrolü: hedef kullanıcının maksimum 50 bekleyen isteği olabilir
      const { count } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', toUser.id);
      if ((count || 0) >= 50) { alert('İstek kutusu dolu'); return; }

      // friend_requests tablosuna ekle
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id:   user.id,
          to_user_id:     toUser.id,
          from_username:  userData.username || '',
          from_full_name: userData.full_name || '',
          from_avatar:    userData.avatar || null,
        });
      if (!error) setSentRequests(prev => [...prev, toUser.id]);
    } catch (e) { console.warn('Send friend request error:', e.message); }
  }, [user, userData, friends, sentRequests, isOnline, setSentRequests]);

  const acceptFriendRequest = useCallback(async req => {
    if (!isOnline) return;
    const fromId = req.from_user_id || req.fromUserId;
    if (!fromId) return;
    try {
      // Sadece kendi satırımızı insert ediyoruz — RLS buna izin verir
      // (user_id = auth.uid() koşulunu sağlar)
      const { error: insertErr } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: fromId });

      // 23505 = duplicate key — zaten arkadaşız, sorun değil, devam et
      if (insertErr && insertErr.code !== '23505') {
        console.warn('Accept friend insert error:', insertErr.message);
        // Hata olsa bile devam et — isteği sil ve state'i güncelle
      }

      // Ters yön: karşı tarafın satırı — RLS izin vermeyebilir, best-effort
      supabase
        .from('friendships')
        .insert({ user_id: fromId, friend_id: user.id })
        .then(undefined, () => {});

      // İsteği sil
      await supabase
        .from('friend_requests')
        .delete()
        .eq('from_user_id', fromId)
        .eq('to_user_id', user.id);

      // Local state her durumda güncelle
      setFriendRequests(prev => prev.filter(r => (r.from_user_id || r.fromUserId) !== fromId));
      setFriends(prev => prev.includes(fromId) ? prev : [...prev, fromId]);

      // Optimistic: Supabase sorgusunu beklemeden arkadaşı hemen göster
      setFriendsData(prev => {
        if (prev.some(f => f.id === fromId)) return prev;
        const optimistic = mapFriend({
          id: fromId,
          username: req.from_username || req.fromUsername || '',
          display_name: req.from_full_name || req.fromFullName || '',
          full_name: req.from_full_name || req.fromFullName || '',
          avatar: req.from_avatar || req.fromAvatar || null,
          is_online: false, status_id: 1, last_seen: null,
          is_working: false, is_paused: false, is_break_paused: false,
          work_duration: 0, break_duration: 300, is_free_mode: false,
          work_started_at: null, work_paused_at: null,
          break_started_at: null, break_paused_at: null,
          show_study_time: false, total_study_secs: 0,
        });
        return [...prev, optimistic];
      });
    } catch (e) { console.warn('Accept friend error:', e.message); }
  }, [user, isOnline, setFriendRequests, setFriends]);

  const rejectFriendRequest = useCallback(async req => {
    if (!isOnline) return;
    try {
      const fromId = req.from_user_id || req.fromUserId;
      await supabase
        .from('friend_requests')
        .delete()
        .eq('from_user_id', fromId)
        .eq('to_user_id', user.id);
      setFriendRequests(prev => prev.filter(r => (r.from_user_id || r.fromUserId) !== fromId));
    } catch (e) { console.warn('Reject friend error:', e.message); }
  }, [user, isOnline, setFriendRequests]);

  const removeFriend = useCallback(async fid => {
    if (!isOnline) return;
    try {
      // Kendi satırımızı sil (RLS izin verir: user_id = auth.uid())
      await supabase.from('friendships').delete().match({ user_id: user.id, friend_id: fid });
      // Ters yön: best-effort (RLS izin vermeyebilir)
      supabase.from('friendships').delete().match({ user_id: fid, friend_id: user.id })
        .then(undefined, () => {});
      setFriends(prev => prev.filter(f => f !== fid));
      setFriendsData(prev => prev.filter(f => f.id !== fid));
    } catch (e) { console.warn('Remove friend error:', e.message); }
  }, [user, isOnline, setFriends]);

  return {
    friendsData, setFriendsData, unreadMessages, setUnreadMessages,
    searchUsers, sendFriendRequest, acceptFriendRequest,
    rejectFriendRequest, removeFriend, friendsKey
  };
}
