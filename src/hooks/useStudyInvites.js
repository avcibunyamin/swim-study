import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { canDoAction } from '../utils/rateLimit';
import { serverNow } from '../utils/serverTime';

export default function useStudyInvites({
  user, userData, isOnline, isRunning,
  currentRoom, setCurrentRoom
}) {
  const [studyInvites, setStudyInvites] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [ignoreToday, setIgnoreToday] = useState({});

  // Refs for canSendInvite/canAcceptInvite - set from outside after useFriends initializes
  const canSendInviteRef = useRef(null);
  const canAcceptInviteRef = useRef(null);

  // Load ignoreToday from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('swim_ignoreToday') || '{}');
      if (saved.date === new Date().toDateString()) {
        setIgnoreToday(saved.users || {});
      }
    } catch (e) { console.debug('Ignore today parse error:', e); }
  }, []);

  // Incoming invites listener
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    const fetchIncoming = async () => {
      const { data } = await supabase
        .from('study_invites')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      const now = serverNow();
      const invites = (data || []).filter(i => {
        if (ignoreToday[i.from_user_id]) return false;
        const ts = new Date(i.timestamp);
        if (now - ts.getTime() > 15000) {
          supabase.from('study_invites').delete().eq('id', i.id).then(() => {});
          return false;
        }
        return true;
      });
      setStudyInvites(invites);
    };

    fetchIncoming();

    const channel = supabase
      .channel(`study_invites_incoming_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_invites', filter: `to_user_id=eq.${user.id}` },
        () => fetchIncoming()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id, ignoreToday]);

  // Expired invite cleanup — runs once 16s after each invite arrives (not every second)
  useEffect(() => {
    if (!user || studyInvites.length === 0) return;
    const timer = setTimeout(() => {
      const now = serverNow();
      studyInvites.forEach(i => {
        const ts = new Date(i.timestamp);
        if (now - ts.getTime() > 15000) {
          supabase.from('study_invites').delete().eq('id', i.id).then(() => {});
        }
      });
    }, 16000);
    return () => clearTimeout(timer);
  }, [user?.id, studyInvites]);

  // Sent invites listener
  useEffect(() => {
    if (!user) return;

    const fetchSent = async () => {
      const { data } = await supabase
        .from('study_invites')
        .select('*')
        .eq('from_user_id', user.id);

      const now = serverNow();
      setSentInvites(
        (data || []).filter(i => {
          if (i.status !== 'pending') return false;
          const ts = new Date(i.timestamp);
          return (now - ts.getTime()) < 15000;
        })
      );
    };

    fetchSent();

    const channel = supabase
      .channel(`study_invites_sent_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_invites', filter: `from_user_id=eq.${user.id}` },
        () => fetchSent()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const sendStudyInvite = useCallback(async (fid, friend) => {
    if (!isOnline) return;
    if (!canDoAction('invite_' + fid, 5000)) return;
    // Use the ref to check canSendInvite - if not set yet, skip the check
    const canSend = canSendInviteRef.current;
    if (canSend && !canSend(friend)) {
      return;
    }
    try {
      const isJoinRequest = !currentRoom && friend.currentRoom;
      await supabase.from('study_invites').insert({
        from_user_id: user.id,
        from_username: userData.username,
        from_avatar: userData.avatar,
        to_user_id: fid,
        room_id: currentRoom || friend.currentRoom || null,
        type: isJoinRequest ? 'join_request' : 'invite',
        status: 'pending',
        timestamp: new Date().toISOString()
      });
    } catch (e) { console.debug('Send invite error:', e); }
  }, [user, userData, currentRoom, isOnline]);

  const acceptStudyInvite = useCallback(async inv => {
    if (!isOnline) return;

    // Join request: host accepts, sender joins room
    if (inv.type === 'join_request') {
      try {
        await supabase.from('study_invites').update({ status: 'accepted' }).eq('id', inv.id);
        const roomId = inv.room_id;
        if (!roomId) return;
        const { data: rd } = await supabase
          .from('study_rooms')
          .select('*, room_members(*)')
          .eq('id', roomId)
          .single();
        if (!rd) return;
        if ((rd.room_members || []).length >= 5) return;
        // Note: is_running check removed — host accepted the join request, so allow joining running rooms
        const { data: senderData } = await supabase.from('users').select('current_room').eq('id', inv.from_user_id).single();
        if (senderData && senderData.current_room) return;
        await supabase.from('room_members').insert({ room_id: roomId, user_id: inv.from_user_id });
        await supabase.from('users').update({ current_room: roomId }).eq('id', inv.from_user_id);
        // Clean sender's pending invites
        try {
          await supabase.from('study_invites').delete().eq('to_user_id', inv.from_user_id).eq('status', 'pending');
          await supabase.from('study_invites').delete().eq('from_user_id', inv.from_user_id).eq('status', 'pending');
        } catch (e) { console.debug('Invite cleanup error:', e); }
      } catch (e) { console.warn('Invite accept error:', e.message); }
      return;
    }

    // Normal invite: acceptor joins room
    if (isRunning) return; // Can't accept while working
    try {
      await supabase.from('study_invites').update({ status: 'accepted' }).eq('id', inv.id);

      // Check if we're already in a room (use Supabase for fresh data, not stale local state)
      const { data: myData } = await supabase.from('users').select('current_room').eq('id', user.id).single();
      const myCurrentRoom = myData ? myData.current_room : null;
      if (myCurrentRoom) {
        // Already in a room — check if it's the same room as the invite
        if (myCurrentRoom === inv.room_id) {
          // Same room — just sync local state
          setCurrentRoom(inv.room_id);
          return;
        }
        return; // In a different room, can't join
      }

      // Find or determine the room to join
      let roomId = inv.room_id;

      if (!roomId) {
        // Invite has no room_id — check inviter's current room
        const { data: inviterData } = await supabase.from('users').select('current_room').eq('id', inv.from_user_id).single();
        if (inviterData && inviterData.current_room) {
          roomId = inviterData.current_room;
        }
      }

      if (roomId) {
        // Room exists — try to join it
        const { data: rd } = await supabase
          .from('study_rooms')
          .select('*, room_members(*)')
          .eq('id', roomId)
          .single();
        if (!rd) {
          roomId = null; // Room was deleted, will create new one below
        } else {
          if ((rd.room_members || []).length >= 5) return;
          // Note: is_running check removed — host explicitly invited, so allow joining running rooms
          await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id });
        }
      }

      if (!roomId) {
        // No valid room — create a new one
        const { data: newRoom } = await supabase.from('study_rooms').insert({
          host_id: inv.from_user_id,
          created_at: new Date().toISOString(),
          work_mins: 25, break_mins: 5, is_running: false,
          paused_time_left: 25 * 60, is_on_break: false, is_free_mode: false,
          free_time: 0, session_worked: 0, started_at: null, session_finished: false,
          paused_for_disconnect: false, disconnected_members: [], paused_at_timestamp: null
        }).select().single();
        roomId = newRoom.id;
        // Insert both members into room_members
        await supabase.from('room_members').insert([
          { room_id: roomId, user_id: inv.from_user_id },
          { room_id: roomId, user_id: user.id }
        ]);
        await supabase.from('users').update({ current_room: roomId }).eq('id', inv.from_user_id);
      }

      // Update own user doc and local state
      await supabase.from('users').update({ current_room: roomId }).eq('id', user.id);
      setCurrentRoom(roomId);

      // Clean pending invites
      try {
        await supabase.from('study_invites').delete().eq('to_user_id', user.id).eq('status', 'pending');
      } catch (e) { console.debug('Invite cleanup error:', e); }
    } catch (e) { console.warn('Accept invite error:', e.message); }
  }, [user, isOnline, isRunning]);

  const rejectStudyInvite = useCallback(async (inv, ignoreForToday = false) => {
    try {
      await supabase.from('study_invites').delete().eq('id', inv.id);
      if (ignoreForToday) {
        const ni = { ...ignoreToday, [inv.from_user_id]: true };
        setIgnoreToday(ni);
        localStorage.setItem('swim_ignoreToday', JSON.stringify({ date: new Date().toDateString(), users: ni }));
      }
    } catch (e) { console.debug('Reject invite error:', e); }
  }, [ignoreToday]);

  return {
    studyInvites, sentInvites, setSentInvites,
    sendStudyInvite, acceptStudyInvite, rejectStudyInvite,
    canSendInviteRef, canAcceptInviteRef
  };
}
