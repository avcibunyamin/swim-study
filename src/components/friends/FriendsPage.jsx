import React, { useState, useEffect } from 'react';
import { Users, Search, Inbox, Loader2, Check, X, UserPlus, UserCheck, UserX, MessageCircle, WifiOff } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { STATUS_IDS } from '../../constants/themes';
import { fmtShort } from '../../utils/formatters';
import { isReallyOnline } from '../../utils/onlineStatus';
import { getAchievement } from '../../constants/achievements';
import Logo from '../ui/Logo';
import StatusDot from '../ui/StatusDot';
import WorkProgressBar from '../ui/WorkProgressBar';
import ChatModal from './ChatModal';

export default function FriendsPage({
  theme, pagePadding, user, userData, isOnline,
  friends, friendsData, friendRequests, sentRequests,
  unreadMessages, setUnreadMessages, status, setStatus,
  searchUsers, sendFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeFriend,
  showRemoveFriend, setShowRemoveFriend,
  showRequestsModal, setShowRequestsModal,
  showChat, setShowChat
}) {
  const { t, ta } = useLanguage();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);

  // Sohbet açıkken gelen bildirim sayacını hemen sıfırla
  useEffect(() => {
    if (!showChat) return;
    if ((unreadMessages[showChat.id] || 0) > 0) {
      setUnreadMessages(prev => ({ ...prev, [showChat.id]: 0 }));
    }
  }, [showChat?.id, unreadMessages]);

  const handleSearch = async () => {
    if (!isOnline || !searchText.trim()) return;
    setIsSearching(true);
    const results = await searchUsers(searchText);
    setSearchResults(results);
    setIsSearching(false);
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="text-center py-2"><Logo size="sm" centered /></div>

      {!isOnline && (
        <div className="flex flex-col items-center justify-center py-16">
          <WifiOff size={64} className="text-slate-500 mb-4" />
          <h3 className={`text-lg font-bold ${theme.text} mb-2`}>{t('friends.offlineTitle')}</h3>
          <p className={`text-sm ${theme.textMuted} text-center`}>{t('friends.offlineDesc')}</p>
        </div>
      )}

      {/* Durum Seçici */}
      {isOnline && (
        <div className={`${theme.card} rounded-xl p-3 mb-4 border`}>
          <p className="text-sm text-cyan-400 font-bold mb-2">{t('friends.yourStatus')}</p>
          <div className="flex gap-2">
            {[
              { id: 'available', l: t('friends.available'), c: 'bg-green-400' },
              { id: 'busy', l: t('friends.busy'), c: 'bg-yellow-400' },
              { id: 'hidden', l: t('friends.hidden'), c: 'bg-slate-500' }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setStatus(s.id);
                  supabase.from('users').update({ status_id: STATUS_IDS[s.id] }).eq('id', user.id).then(({ error }) => {
                    if (error) console.warn('Status update failed:', error.message);
                  });
                }}
                className={`flex-1 py-2 rounded-xl text-sm flex items-center justify-center gap-1 ${
                  status === s.id
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white'
                    : `${theme.input} border ${theme.text}`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${s.c}`} />{s.l}
              </button>
            ))}
          </div>
          {status === 'busy' && (
            <p className="text-xs text-yellow-400/80 mt-2">{t('friends.busyNote')}</p>
          )}
        </div>
      )}

      {/* Kullanıcı Arama */}
      {isOnline && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder={t('friends.searchPlaceholder')}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className={`flex-1 ${theme.input} rounded-xl p-3 text-sm outline-none border ${theme.text}`}
          />
          <button onClick={handleSearch} disabled={isSearching} className="px-4 py-2 bg-teal-600 rounded-xl text-white">
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
          <button onClick={() => setShowRequestsModal(true)} className={`relative px-4 py-2 ${theme.input} rounded-xl border`}>
            <Inbox size={18} className="text-cyan-400" />
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Arama Sonuçları */}
      {isOnline && searchResults.length > 0 && (
        <div className="mb-4">
          <h3 className={`text-sm font-bold ${theme.textMuted} mb-2`}>{t('friends.results')} ({searchResults.length})</h3>
          {searchResults.map(u => (
            <div key={u.id} className={`${theme.card} rounded-xl p-3 mb-2 border flex justify-between items-center`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{u.avatar || '👤'}</span>
                <div>
                  <span className="font-medium">@{u.username}</span>
                  {u.fullName && <p className={`text-xs ${theme.textMuted}`}>{u.fullName}</p>}
                  {u.showStudyTime && <p className={`text-xs ${theme.textMuted}`}>{fmtShort(u.totalStudySecs || 0, t)}</p>}
                </div>
              </div>
              {friends.includes(u.id) ? (
                <span className={`text-xs text-green-400 px-2 py-1 ${theme.input} rounded-lg border`}>{t('friends.alreadyFriend')}</span>
              ) : sentRequests.includes(u.id) ? (
                <span className={`text-xs ${theme.textMuted} px-2 py-1 ${theme.input} rounded-lg border`}>{t('friends.requestSent')}</span>
              ) : (
                <button onClick={() => sendFriendRequest(u)} className="p-2 bg-teal-600 rounded-lg text-white">
                  <UserPlus size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Arkadaşlar Listesi */}
      {isOnline && (
        <h3 className="text-sm font-bold text-teal-400 mb-2">
          <Users size={14} className="inline mr-1" />{t('friends.title')} ({friendsData.length})
        </h3>
      )}

      {isOnline && (friendsData.length === 0 ? (
        <div className={`text-center py-8 ${theme.textMuted}`}>
          <Users size={48} className="mx-auto mb-2 opacity-50" />
          <p>{t('friends.noFriends')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friendsData.map(f => {
            const fOnline = isReallyOnline(f);
            const ach = getAchievement((f.totalStudySecs || 0) / 60, ta);
            const unread = unreadMessages[f.id] || 0;
            const today = new Date().toISOString().split('T')[0];
            const todaySecs = (f.studyHistory || []).find(h => h.date === today)?.secs || 0;

            const isSelected = selectedFriendId === f.id;

            return (
              <div
                key={f.id}
                className={`${theme.card} rounded-xl p-3 border cursor-pointer select-none transition-all ${isSelected ? 'ring-1 ring-cyan-500/50' : ''}`}
                onClick={() => setSelectedFriendId(prev => prev === f.id ? null : f.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="text-3xl">{f.avatar || '👤'}</span>
                      <StatusDot status={f.status} isOnline={fOnline} size="md" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-1">@{f.username}</p>
                      {f.fullName && <p className={`text-xs ${theme.text}`}>{f.fullName}</p>}
                      {/* Satır 1: Ana durum (Müsait/Meşgul/Gizli/Çevrimdışı) */}
                      <p className={`text-xs ${
                        f.status === 'hidden' ? 'text-slate-500'
                        : !fOnline ? 'text-red-400'
                        : f.status === 'busy' ? 'text-yellow-400'
                        : 'text-green-400'
                      }`}>
                        {f.status === 'hidden' ? t('friends.hidden')
                          : !fOnline ? t('friends.offlineStatus')
                          : f.status === 'busy' ? t('friends.busy')
                          : t('friends.available')}
                      </p>
                      {/* Satır 2: Çalışma durumu — gizli/çevrimdışı ise gösterme */}
                      {fOnline && f.status !== 'hidden' && f.showStudyTime !== false && (f.isWorking || f.isOnBreak || f.isPaused) && (
                        <p className={`text-xs font-medium ${f.isOnBreak ? 'text-blue-400' : f.isPaused ? 'text-yellow-400' : 'text-teal-400'}`}>
                          {f.isOnBreak ? t('friends.onBreak') : f.isPaused ? t('friends.paused') : t('friends.working')}
                        </p>
                      )}
                      <p className={`text-xs ${theme.textMuted}`}>{ach.icon} {ach.title}</p>
                      {f.showStudyTime !== false && f.status !== 'hidden' && todaySecs > 0 && (
                        <p className="text-xs text-cyan-400">{t('friends.todayStats')}: {fmtShort(todaySecs, t)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={e => { e.stopPropagation(); if (!isOnline) return; setUnreadMessages(prev => ({ ...prev, [f.id]: 0 })); setShowChat(f); }}
                      className="relative p-3 bg-cyan-600 rounded-lg text-white"
                    >
                      <MessageCircle size={18} />
                      {unread > 0 && showChat?.id !== f.id && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                          {unread}
                        </span>
                      )}
                    </button>
                    {isSelected && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowRemoveFriend(f.id); setSelectedFriendId(null); }}
                        className="p-3 bg-red-600/30 rounded-lg text-red-400 border border-red-600/40"
                      >
                        <UserX size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <WorkProgressBar friend={f} theme={theme} />
                {f.aboutMe && (
                  <p className={`text-xs ${theme.textMuted} mt-2 pt-2 border-t border-slate-700/50`}>{f.aboutMe}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Arkadaş İstekleri Modalı */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowRequestsModal(false)}>
          <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600 max-h-[70vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-cyan-400">{t('friends.friendRequests')} ({friendRequests.length}/50)</h3>
              <button onClick={() => setShowRequestsModal(false)}><X size={20} /></button>
            </div>
            {friendRequests.length === 0 ? (
              <p className={`text-center ${theme.textMuted} py-4`}>{t('friends.noRequests')}</p>
            ) : friendRequests.map(req => (
              <div key={req.fromUserId} className={`${theme.input} rounded-xl p-3 mb-2 border flex justify-between items-center`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{req.fromAvatar || '👤'}</span>
                  <div>
                    <span className="font-medium">@{req.fromUsername}</span>
                    {req.fromFullName && <p className={`text-xs ${theme.textMuted}`}>{req.fromFullName}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptFriendRequest(req)} className="p-2 bg-green-600 rounded-lg text-white"><UserCheck size={16} /></button>
                  <button onClick={() => rejectFriendRequest(req)} className="p-2 bg-red-600 rounded-lg text-white"><UserX size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arkadaş Kaldırma — Bottom Sheet */}
      {showRemoveFriend && (() => {
        const rf = friendsData.find(f => f.id === showRemoveFriend);
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowRemoveFriend(null)}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className={`relative ${theme.modal} rounded-t-2xl p-5 border-t border-x border-slate-600 animate-slide-up`}
              onClick={e => e.stopPropagation()}
            >
              {/* Tutamaç çizgisi */}
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />

              {/* Arkadaş bilgisi */}
              {rf && (
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">{rf.avatar || '👤'}</span>
                  <div>
                    <p className={`font-semibold ${theme.text}`}>@{rf.username}</p>
                    {rf.fullName && <p className={`text-xs ${theme.textMuted}`}>{rf.fullName}</p>}
                  </div>
                </div>
              )}

              <p className={`text-sm ${theme.textMuted} mb-4`}>{t('friends.removeFriend')}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowRemoveFriend(null)}
                  className={`flex-1 py-3 rounded-xl ${theme.input} border border-slate-600 ${theme.text} font-medium`}
                >
                  {t('pomodoro.cancel')}
                </button>
                <button
                  onClick={() => { removeFriend(showRemoveFriend); setShowRemoveFriend(null); }}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white transition-colors"
                >
                  {t('friends.remove')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showChat && (
        <ChatModal theme={theme} user={user} friend={showChat} isOnline={isOnline} onClose={() => setShowChat(null)} />
      )}
    </div>
  );
}
