import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';
import { canDoAction } from '../../utils/rateLimit';

export default function RoomChatModal({ theme, user, userData, currentRoom, roomMessages, roomMembers, isOnline, onClose }) {
  const { t } = useLanguage();
  const [msg, setMsg] = useState('');
  const [modalStyle, setModalStyle] = useState({ top: 0, height: window.innerHeight });
  const inputRef = useRef(null), msgContainerRef = useRef(null);
  const scrollToBottom = () => { if (msgContainerRef.current) msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight; };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setModalStyle({ top: vv.offsetTop, height: vv.height });
      setTimeout(scrollToBottom, 50);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  useEffect(() => { scrollToBottom(); }, [roomMessages.length]);

  const handleSend = async () => {
    if (!msg.trim() || !isOnline || !currentRoom) return;
    if (!canDoAction('room_msg', 1000)) return;
    const text = sanitizeInput(msg, 1000);
    setMsg('');
    inputRef.current?.focus();
    try {
      const { error } = await supabase.from('room_messages').insert({
        room_id: currentRoom,
        sender_id: user.id,
        sender_username: userData?.username || 'user',
        sender_avatar: userData?.avatar || '🐟',
        text,
        created_at: new Date().toISOString()
      });
      if (error) console.warn('Room message send failed:', error.message);
    } catch (e) { console.warn('Room message send failed:', e.message); }
  };

  return (
    <div className="fixed left-0 right-0 bg-black/90 z-50 flex flex-col" style={{ top: `${modalStyle.top}px`, height: `${modalStyle.height}px` }}>
      <div className={`${theme.modal} flex-1 flex flex-col overflow-hidden m-2`} style={{ borderRadius: '1rem', border: '1px solid rgb(71 85 105)', minHeight: 0 }}>
        <div className="p-3 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-teal-400" />
            <span className="font-bold text-teal-400">{t('chat.roomTitle')}</span>
            <span className={`text-xs ${theme.textMuted}`}>({roomMembers.length} {t('chat.people')})</span>
          </div>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        <div ref={msgContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 0 }}>
          {roomMessages.length === 0 && <p className={`text-center ${theme.textMuted} text-sm py-8`}>{t('chat.noMessages')}</p>}
          {roomMessages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${m.sender_id === user.id ? '' : 'flex gap-2'}`}>
                {m.sender_id !== user.id && <span className="text-lg flex-shrink-0 mt-1">{m.sender_avatar}</span>}
                <div>
                  {m.sender_id !== user.id && <p className={`text-[10px] ${theme.textMuted} mb-0.5`}>@{m.sender_username}</p>}
                  <div className={`p-2 rounded-xl text-sm ${m.sender_id === user.id ? 'bg-teal-600 text-white' : `${theme.input} border ${theme.text}`}`}>{m.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-700 flex gap-2 flex-shrink-0">
          <input ref={inputRef} type="text" inputMode="text" autoComplete="off" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} onFocus={() => setTimeout(scrollToBottom, 300)} placeholder={t('chat.roomPlaceholder')} maxLength={1000} className={`flex-1 ${theme.input} rounded-xl p-3 text-sm outline-none border ${theme.text}`} />
          <button onClick={handleSend} disabled={!isOnline} className="p-3 bg-teal-600 rounded-xl text-white disabled:opacity-50"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}
