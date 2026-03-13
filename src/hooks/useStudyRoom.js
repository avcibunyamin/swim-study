import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { fmtSecs } from '../utils/formatters';
import { saveOfflineData } from '../utils/offlineStorage';
import { isReallyOnline } from '../utils/onlineStatus';
import { serverNow, serverISOString } from '../utils/serverTime';

export default function useStudyRoom({
  user, isOnline, currentRoom, setCurrentRoom,
  saveStudyTime, setTotalStudySecs, setRoomNotification,
  sessionWorked, setSessionWorked, setIsRunning,
  workMins, setWorkMins, breakMins, setBreakMins,
  setTimeLeft, setIsFreeMode, setIsOnBreak, setFreeTime,
  pausedSessionWorkedRef, isHostRef
}) {
  const [roomData, setRoomData] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  const [showRoomChat, setShowRoomChat] = useState(false);
  const [lastSeenRoomMsg, setLastSeenRoomMsg] = useState(0);

  const prevRoomStateRef = useRef({ isRunning: null });
  const localSessionWorkedRef = useRef(0);
  const prevMemberIdsRef = useRef([]);
  const prevBroadcastRef = useRef({ memberCount: 0, isRunning: false });
  const prevHostIdRef = useRef(null);

  // Room listener
  useEffect(() => {
    if (!currentRoom) {
      setRoomData(null);
      setRoomMembers([]);
      prevRoomStateRef.current = { isRunning: null };
      localSessionWorkedRef.current = 0;
      prevMemberIdsRef.current = [];
      prevHostIdRef.current = null;
      memberStatusRef.current = {};
      return;
    }

    // Initial fetch + subscribe to changes
    let channel;

    const handleRoomData = async (d) => {
      if (!d) {
        // Room was deleted
        const secsToSave = localSessionWorkedRef.current || sessionWorked || 0;
        if (secsToSave > 0) {
          if (isOnline) await saveStudyTime(secsToSave);
          else saveOfflineData(user?.id, secsToSave);
          setTotalStudySecs(prev => prev + secsToSave);
          setRoomNotification(`Oda kapatıldı. ${fmtSecs(secsToSave)} kaydedildi!`);
        }
        setCurrentRoom(null);
        setSessionWorked(0);
        if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
        setIsRunning(false);
        setWorkMins(25); setBreakMins(5); setTimeLeft(25 * 60);
        setIsFreeMode(false); setIsOnBreak(false);
        if (user && isOnline) {
          supabase.from('users').update({
            current_room: null, is_working: false, room_member_count: null, room_is_running: null
          }).eq('id', user.id).then(() => {});
        }
        prevRoomStateRef.current = { isRunning: null };
        localSessionWorkedRef.current = 0;
        return;
      }

      // Fetch current members from room_members table
      const { data: memberRows } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', currentRoom);
      const memberIds = (memberRows || []).map(r => r.user_id);

      // I've been removed from the room (kicked) — leave cleanly, save worked time
      if (memberIds.length > 0 && !memberIds.includes(user?.id)) {
        const secsToSave = localSessionWorkedRef.current || sessionWorked || 0;
        if (secsToSave > 0) {
          if (isOnline) await saveStudyTime(secsToSave);
          else saveOfflineData(user?.id, secsToSave);
          setTotalStudySecs(prev => prev + secsToSave);
          setRoomNotification(`Odadan çıkarıldınız. ${fmtSecs(secsToSave)} kaydedildi!`);
        }
        if (isOnline && user) {
          supabase.from('users').update({
            current_room: null, is_working: false, room_member_count: null, room_is_running: null
          }).eq('id', user.id).then(() => {});
        }
        setCurrentRoom(null);
        setSessionWorked(0);
        if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
        setIsRunning(false);
        setWorkMins(25); setBreakMins(5); setTimeLeft(25 * 60);
        setIsFreeMode(false); setIsOnBreak(false);
        prevRoomStateRef.current = { isRunning: null };
        localSessionWorkedRef.current = 0;
        return;
      }

      // Only one member left — notify but don't close room
      if (memberIds.length <= 1 && memberIds[0] === user?.id && prevMemberIdsRef.current.length > 1) {
        setRoomNotification('Odada tek kaldınız.');
      }

      const prevState = prevRoomStateRef.current;

      // Finish button (session_finished flag) - save for NON-HOST members only
      const myLocalWorked = localSessionWorkedRef.current || sessionWorked || 0;
      if (d.session_finished && myLocalWorked > 0 && d.host_id !== user?.id) {
        if (isOnline) await saveStudyTime(myLocalWorked);
        else saveOfflineData(user?.id, myLocalWorked);
        setTotalStudySecs(prev => prev + myLocalWorked);
        setRoomNotification(`${fmtSecs(myLocalWorked)} kaydedildi!`);
        localSessionWorkedRef.current = 0;
        setSessionWorked(0);
        if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
      }

      // Break transition - save for NON-HOST members only
      if (myLocalWorked > 5 && d.is_running === true && d.is_on_break === true && prevState.isRunning === true && !prevState.wasOnBreak && d.host_id !== user?.id) {
        if (isOnline) await saveStudyTime(myLocalWorked);
        else saveOfflineData(user?.id, myLocalWorked);
        setTotalStudySecs(prev => prev + myLocalWorked);
        setRoomNotification(`${fmtSecs(myLocalWorked)} kaydedildi!`);
        localSessionWorkedRef.current = 0;
        setSessionWorked(0);
        if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
      }

      prevRoomStateRef.current = { isRunning: d.is_running ?? false, wasOnBreak: d.is_on_break ?? false };

      setRoomData(d);

      // Host migration detection — notify new host
      if (prevHostIdRef.current && prevHostIdRef.current !== d.host_id && d.host_id === user?.id) {
        setRoomNotification('Oda lideri oldunuz!');
      }
      prevHostIdRef.current = d.host_id;

      // Update isHostRef for usePomodoro
      if (isHostRef) isHostRef.current = !currentRoom || d.host_id === user?.id;

      // When Supabase says session_worked=0 and room is not running,
      // sync local state to 0. Catches reconnect after finish.
      if (!d.is_running && d.session_worked === 0) {
        setSessionWorked(0);
        if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
        localSessionWorkedRef.current = 0;
      }

      setWorkMins(d.work_mins ?? 25);
      setBreakMins(d.break_mins ?? 5);
      setIsRunning(d.is_running ?? false);
      setIsOnBreak(d.is_on_break ?? false);
      setIsFreeMode(d.is_free_mode ?? false);

      if (!d.is_running) {
        setTimeLeft(d.paused_time_left ?? d.time_left ?? 25 * 60);
        setFreeTime(d.free_time ?? 0);
      }
      // When break transition happens while running, sync timeLeft to paused_time_left
      if (d.is_running && d.is_on_break && !prevState.wasOnBreak && d.paused_time_left != null) {
        setTimeLeft(d.paused_time_left);
      }

      // Refresh member data when member list changes
      const currentMemberIds = [...memberIds].sort().join(',');
      const prevMemberIds = [...prevMemberIdsRef.current].sort().join(',');
      if (currentMemberIds !== prevMemberIds) {
        const members = [];
        for (const mid of memberIds) {
          try {
            const { data: mData } = await supabase.from('users').select('*').eq('id', mid).single();
            if (mData) members.push({ ...mData, id: mid, isHost: d.host_id === mid });
          } catch (e) { console.debug('Member fetch error:', e); }
        }
        setRoomMembers(members);
        prevMemberIdsRef.current = [...memberIds];
      } else {
        // Member list same but host_id may have changed — update isHost flag
        setRoomMembers(prev => prev.map(m => ({ ...m, isHost: d.host_id === m.id })));
      }

      // Broadcast member_count/is_running only when changed — only host writes to avoid N duplicates
      if (isOnline && memberIds.length && d.host_id === user?.id) {
        const memberCount = memberIds.length;
        const running = d.is_running ?? false;
        const prev = prevBroadcastRef.current;
        if (prev.memberCount !== memberCount || prev.isRunning !== running) {
          for (const mid of memberIds) {
            supabase.from('users').update({
              room_member_count: memberCount, room_is_running: running
            }).eq('id', mid).then(() => {});
          }
          prevBroadcastRef.current = { memberCount, isRunning: running };
        }
      }
    };

    // Do initial fetch
    supabase
      .from('study_rooms')
      .select('*')
      .eq('id', currentRoom)
      .single()
      .then(({ data }) => handleRoomData(data));

    // Subscribe to realtime changes on the room row
    channel = supabase
      .channel(`study_room_${currentRoom}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_rooms', filter: `id=eq.${currentRoom}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            handleRoomData(null);
          } else {
            handleRoomData(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentRoom, user?.id, isOnline]);

  // Keep localSessionWorkedRef in sync with the component's sessionWorked state
  useEffect(() => {
    if (currentRoom) {
      localSessionWorkedRef.current = sessionWorked;
    }
  }, [sessionWorked, currentRoom]);

  // Real-time member online status listeners (UI green/red dot + notifications)
  const memberStatusRef = useRef({});
  const memberListKeyRef = useRef('');
  const memberChannelsRef = useRef([]);
  useEffect(() => {
    if (!currentRoom || !roomData?.members?.length) {
      memberStatusRef.current = {};
      memberListKeyRef.current = '';
      memberChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
      memberChannelsRef.current = [];
      return;
    }

    // Only re-subscribe when the actual sorted member list string changes
    const memberKey = [...roomData.members].sort().join(',');
    if (memberKey === memberListKeyRef.current) return;

    // Cleanup old listeners before creating new ones
    memberChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
    memberListKeyRef.current = memberKey;

    memberChannelsRef.current = roomData.members.map(mid => {
      const ch = supabase
        .channel(`user_status_${mid}_${currentRoom}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${mid}` },
          payload => {
            const mData = payload.new;
            if (!mData) return;

            setRoomMembers(prev => prev.map(m =>
              m.id === mid ? { ...m, is_online: mData.is_online, last_seen: mData.last_seen, status: mData.status } : m
            ));

            const prevStatus = memberStatusRef.current[mid];
            memberStatusRef.current[mid] = { isOnline: mData.is_online, lastSeen: mData.last_seen, displayName: mData.display_name, username: mData.username };

            if (mid === user?.id || !prevStatus) return;

            const wasOnline = isReallyOnline(prevStatus);
            const nowOnline = isReallyOnline({ isOnline: mData.is_online, lastSeen: mData.last_seen });

            const memberName = mData.display_name || mData.username || '?';

            if (wasOnline && !nowOnline) {
              setRoomNotification(`⚠️ ${memberName} bağlantısı kesildi`);
              // Auto-pause room when a member disconnects
              if (currentRoom) {
                (async () => {
                  try {
                    const { data: rd } = await supabase
                      .from('study_rooms')
                      .select('*')
                      .eq('id', currentRoom)
                      .single();
                    if (!rd) return;

                    if (rd.paused_for_disconnect) {
                      const dcm = rd.disconnected_members || [];
                      if (!dcm.includes(mid)) {
                        await supabase.from('study_rooms').update({
                          disconnected_members: [...dcm, mid]
                        }).eq('id', currentRoom);
                      }
                      return;
                    }

                    if (!rd.is_running) return;

                    const elapsed = rd.started_at
                      ? Math.floor((serverNow() - new Date(rd.started_at).getTime()) / 1000)
                      : 0;
                    const updates = {
                      is_running: false,
                      paused_for_disconnect: true,
                      disconnected_members: [mid],
                      paused_at_timestamp: serverISOString(),
                      started_at: null
                    };
                    if (rd.is_free_mode) {
                      updates.free_time = (rd.free_time || 0) + elapsed;
                    } else {
                      const total = rd.paused_time_left ?? ((rd.is_on_break ? rd.break_mins : rd.work_mins) || 25) * 60;
                      updates.paused_time_left = Math.max(0, total - elapsed);
                    }
                    await supabase.from('study_rooms').update(updates).eq('id', currentRoom);
                  } catch (e) { console.debug('Pause for disconnect error:', e); }
                })();
              }
            }
            if (!wasOnline && nowOnline) {
              setRoomNotification(`✅ ${memberName} geri bağlandı`);
              // Auto-resume if all disconnected members are back
              if (currentRoom) {
                (async () => {
                  try {
                    const { data: rd } = await supabase
                      .from('study_rooms')
                      .select('*')
                      .eq('id', currentRoom)
                      .single();
                    if (!rd || !rd.paused_for_disconnect) return;

                    const remaining = (rd.disconnected_members || []).filter(id => id !== mid);
                    if (remaining.length === 0) {
                      await supabase.from('study_rooms').update({
                        disconnected_members: [],
                        paused_for_disconnect: false,
                        is_running: true,
                        started_at: serverISOString(),
                        paused_at_timestamp: null
                      }).eq('id', currentRoom);
                    } else {
                      await supabase.from('study_rooms').update({
                        disconnected_members: remaining
                      }).eq('id', currentRoom);
                    }
                  } catch (e) { console.debug('Resume after reconnect error:', e); }
                })();
              }
            }
          }
        )
        .subscribe();
      return ch;
    });

    return () => {
      memberChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
      memberChannelsRef.current = [];
    };
  }, [currentRoom, roomData?.members, user?.id]);

  // Check if all members are online (used to decide if start is allowed)
  const allMembersOnline = useCallback(() => {
    if (!roomData?.members || roomData.members.length < 2) return true;
    const otherMembers = roomData.members.filter(mid => mid !== user?.id);
    for (const mid of otherMembers) {
      const status = memberStatusRef.current[mid];
      if (!status || !isReallyOnline(status)) return false;
    }
    return true;
  }, [roomData?.members, user?.id]);

  // Room messages listener
  useEffect(() => {
    if (!currentRoom) { setRoomMessages([]); setShowRoomChat(false); return; }

    // Initial fetch
    supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('timestamp', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRoomMessages((data || []).reverse());
      });

    const msgChannel = supabase
      .channel(`room_messages_${currentRoom}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${currentRoom}` },
        () => {
          // Re-fetch on any change to keep ordered list consistent
          supabase
            .from('room_messages')
            .select('*')
            .eq('room_id', currentRoom)
            .order('timestamp', { ascending: false })
            .limit(50)
            .then(({ data }) => {
              setRoomMessages((data || []).reverse());
            });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(msgChannel);
  }, [currentRoom]);

  // Leave room — with host migration
  const leaveRoom = useCallback(async (confirmed = false) => {
    if (!currentRoom || !roomData) return;
    if (roomData.is_running && !confirmed) return 'needConfirm';
    try {
      // Save worked time
      const secsToSave = localSessionWorkedRef.current || sessionWorked || 0;
      if (secsToSave > 0) {
        if (isOnline) await saveStudyTime(secsToSave);
        else saveOfflineData(user?.id, secsToSave);
        setTotalStudySecs(prev => prev + secsToSave);
        setRoomNotification(`${fmtSecs(secsToSave)} kaydedildi.`);
      }

      // Reset local state
      localSessionWorkedRef.current = 0;
      setSessionWorked(0);
      if (pausedSessionWorkedRef) pausedSessionWorkedRef.current = 0;
      setIsRunning(false);
      const roomId = currentRoom;
      setCurrentRoom(null);
      setWorkMins(25); setBreakMins(5); setTimeLeft(25 * 60);
      setIsFreeMode(false); setIsOnBreak(false);
      prevRoomStateRef.current = { isRunning: null };
      localSessionWorkedRef.current = 0;

      if (isOnline) {
        // Fetch current members
        const { data: memberRows } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId);
        const remaining = (memberRows || []).map(r => r.user_id).filter(m => m !== user.id);

        // Remove self from room_members
        await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id);

        if (remaining.length === 0) {
          // No one left — delete room and messages
          await supabase.from('room_messages').delete().eq('room_id', roomId);
          await supabase.from('study_rooms').delete().eq('id', roomId);
        } else {
          // Host migration: if I'm the host, pass to next member
          if (roomData.host_id === user.id) {
            await supabase.from('study_rooms').update({ host_id: remaining[0] }).eq('id', roomId);
          }
        }

        // Clean own user doc
        await supabase.from('users').update({
          current_room: null, is_working: false, room_member_count: null, room_is_running: null
        }).eq('id', user.id);
      }
    } catch (e) { console.debug('Leave room error:', e); }
  }, [currentRoom, roomData, user, sessionWorked, saveStudyTime, isOnline]);

  // Kick member (works for both online and offline members)
  const kickFromRoom = useCallback(async mid => {
    if (!currentRoom || roomData?.host_id !== user.id || !isOnline) return;
    try {
      await supabase.from('room_members').delete().eq('room_id', currentRoom).eq('user_id', mid);
      await supabase.from('users').update({
        current_room: null, is_working: false, room_member_count: null, room_is_running: null
      }).eq('id', mid);
    } catch (e) { console.debug('Kick error:', e); }
  }, [currentRoom, roomData, user, isOnline]);

  // Kick all disconnected members and resume room
  const kickDisconnectedAndResume = useCallback(async () => {
    if (!currentRoom || !roomData?.disconnected_members?.length || roomData?.host_id !== user?.id || !isOnline) return;
    try {
      for (const mid of roomData.disconnected_members) {
        await supabase.from('room_members').delete().eq('room_id', currentRoom).eq('user_id', mid);
        await supabase.from('users').update({
          current_room: null, is_working: false, room_member_count: null, room_is_running: null
        }).eq('id', mid);
      }
      await supabase.from('study_rooms').update({
        paused_for_disconnect: false,
        disconnected_members: [],
        is_running: true,
        started_at: serverISOString(),
        paused_at_timestamp: null
      }).eq('id', currentRoom);
    } catch (e) { console.debug('Kick disconnected error:', e); }
  }, [currentRoom, roomData, user, isOnline]);

  return {
    roomData, roomMembers, roomMessages,
    showRoomChat, setShowRoomChat,
    lastSeenRoomMsg, setLastSeenRoomMsg,
    leaveRoom, kickFromRoom, kickDisconnectedAndResume, allMembersOnline
  };
}
