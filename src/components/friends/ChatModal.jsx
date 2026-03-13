import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X, Send, ChevronDown, ArrowLeft } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';
import { canDoAction } from '../../utils/rateLimit';

export default function ChatModal({ theme, user, friend, isOnline, onClose }) {
  const { t } = useLanguage();
  const [msg, setMsg] = useState(''), [messages, setMessages] = useState([]);
  const [kbOffset, setKbOffset] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [swipeX, setSwipeX] = useState(0);
  const inputRef = useRef(null), msgContainerRef = useRef(null);
  const touchStartRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (msgContainerRef.current) {
      msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = () => {
    const el = msgContainerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  // Klavye açılınca modalı yukarı it
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setKbOffset(Math.max(0, hidden));
      setTimeout(scrollToBottom, 50);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [scrollToBottom]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) { console.warn('Chat fetch error:', error.message); return; }
        setMessages((data || []).reverse());
      } catch (e) { console.warn('Chat fetch error:', e.message); }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages:${[user.id, friend.id].sort().join('_')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${friend.id}` },
        (payload) => {
          const newMsg = payload.new;
          const isRelevant =
            (newMsg.sender_id === friend.id && newMsg.receiver_id === user.id) ||
            (newMsg.sender_id === user.id && newMsg.receiver_id === friend.id);
          if (isRelevant) {
            setMessages(prev => [...prev, newMsg]);
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id)
              .then(undefined, () => {});
          }
        }
      )
      .subscribe();

    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', friend.id)
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .then(undefined, e => console.warn('Mark read failed:', e.message));

    return () => { supabase.removeChannel(channel); };
  }, [user.id, friend.id]);

  // Mesajlar yüklenince / yeni mesaj gelince scroll — paint öncesi çalışır, flash olmaz
  const isInitialLoad = useRef(true);
  useLayoutEffect(() => {
    if (isInitialLoad.current) {
      const t = setTimeout(scrollToBottom, 50);
      isInitialLoad.current = false;
      return () => clearTimeout(t);
    }
    if (isAtBottom) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    if (!msg.trim() || !isOnline) return;
    if (!canDoAction('chat_msg', 300)) return;
    const text = sanitizeInput(msg, 1000);
    setMsg('');
    inputRef.current?.focus();
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: user.id, receiver_id: friend.id, text, created_at: new Date().toISOString(), is_read: false };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();
    try {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: friend.id,
        text,
        created_at: optimistic.created_at,
        is_read: false
      }).select().single();
      if (error) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        console.warn('Send message failed:', error.message);
      } else if (data) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m));
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      console.warn('Send message failed:', e.message);
    }
  };

  // Sağa kaydırma ile kapat
  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    // Yatay kayma, dikey kaymadan büyükse sürükleme efektini göster
    if (dx > 0 && dx > dy) {
      setSwipeX(dx);
      // Mesaj scrollunu engellemek için (sadece yatay kaydırmada)
      if (dx > dy * 1.5) e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX > 80) {
      onClose();
    }
    setSwipeX(0);
    touchStartRef.current = null;
  }, [swipeX, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${theme.modal} animate-slide-in-right`}
      style={{
        transform: swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
        transition: swipeX > 0 ? 'none' : 'transform 0.2s ease',
        paddingBottom: `${kbOffset}px`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header — safe area üstüne gelir */}
      <div className="pt-safe flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-1 opacity-70 hover:opacity-100">
            <ArrowLeft size={22} />
          </button>
          <span className="text-2xl">{friend.avatar}</span>
          <div>
            <p className="font-bold text-sm">@{friend.username}</p>
            {friend.fullName && <p className="text-xs opacity-60">{friend.fullName}</p>}
          </div>
        </div>
      </div>

      {/* Mesajlar */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <div
          ref={msgContainerRef}
          className="h-full overflow-y-auto px-4 py-3 space-y-2"
          onScroll={handleScroll}
        >
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.sender_id === user.id ? 'bg-teal-600 text-white' : `${theme.input} border ${theme.text}`}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full shadow-lg text-white"
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Input alanı */}
      <div className="px-4 py-3 border-t border-slate-700 flex gap-2 flex-shrink-0 items-center pb-safe">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          onFocus={() => setTimeout(scrollToBottom, 300)}
          placeholder={t('chat.placeholder')}
          maxLength={1000}
          className={`flex-1 ${theme.input} rounded-full px-4 py-2.5 text-sm outline-none border ${theme.text}`}
        />
        <button
          onClick={handleSend}
          disabled={!isOnline}
          className="p-2.5 bg-teal-600 rounded-full text-white disabled:opacity-50 flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
