import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X, Send, ChevronDown, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';
import { canDoAction } from '../../utils/rateLimit';

export default function ChatModal({ theme, user, friend, isOnline, onClose, setUnreadMessages }) {
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
    if (Capacitor.isNativePlatform()) {
      // Native: Capacitor Keyboard eventi gerçek yüksekliği verir
      let showSub, hideSub;
      (async () => {
        showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
          setKbOffset(info.keyboardHeight);
          setTimeout(scrollToBottom, 80);
        });
        hideSub = await Keyboard.addListener('keyboardWillHide', () => {
          setKbOffset(0);
        });
      })();
      return () => {
        showSub?.remove();
        hideSub?.remove();
      };
    } else {
      // Web: visualViewport yeterli
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
    }
  }, [scrollToBottom]);

  // ── Mesajları yükle + Realtime kanalları ───────────────────────────────────
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

    // Chat açılınca arkadaşın tüm mesajlarını oku — RPC (atomik, partial index kullanır)
    const markReadOnOpen = () => {
      supabase
        .rpc('mark_as_read', { p_sender_id: friend.id, p_receiver_id: user.id })
        .then(undefined, e => console.warn('mark_as_read error:', e.message));
      // Lokal badge'i de sıfırla
      setUnreadMessages?.(prev => ({ ...prev, [friend.id]: 0 }));
    };
    markReadOnOpen();

    const channel = supabase
      .channel(`chat:${[user.id, friend.id].sort().join('_')}`)

      // 1) Arkadaş yeni mesaj gönderdi → ekle + hemen okundu işaretle
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${friend.id}` },
        payload => {
          const newMsg = payload.new;
          if (newMsg.receiver_id !== user.id) return;
          setMessages(prev => [...prev, { ...newMsg, is_read: true }]);
          // RPC ile tek satırı işaretle
          supabase
            .rpc('mark_as_read', { p_sender_id: friend.id, p_receiver_id: user.id })
            .then(undefined, () => {});
          // Badge'i sıfırla (zaten 0 olmalı ama garantiye al)
          setUnreadMessages?.(prev => ({ ...prev, [friend.id]: 0 }));
        }
      )

      // 2) Bizim gönderdiğimiz mesajı arkadaş okudu → ✓ → ✓✓
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        payload => {
          const updated = payload.new;
          if (updated.receiver_id !== friend.id || !updated.is_read) return;
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? { ...m, is_read: true } : m)
          );
        }
      )

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, friend.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Mesajlar yüklenince / yeni mesaj gelince scroll — paint öncesi çalışır, flash olmaz
  const isInitialLoad = useRef(true);
  useLayoutEffect(() => {
    if (isInitialLoad.current) {
      const timer = setTimeout(scrollToBottom, 50);
      isInitialLoad.current = false;
      return () => clearTimeout(timer);
    }
    if (isAtBottom) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    if (!msg.trim() || !isOnline) return;
    if (!canDoAction('chat_msg', 300)) return;
    const text = sanitizeInput(msg, 1000);
    setMsg('');
    inputRef.current?.focus();
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: friend.id,
      text,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: user.id, receiver_id: friend.id, text, created_at: optimistic.created_at, is_read: false })
        .select()
        .single();
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
    if (dx > 0 && dx > dy) {
      setSwipeX(dx);
      if (dx > dy * 1.5) e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX > 80) onClose();
    setSwipeX(0);
    touchStartRef.current = null;
  }, [swipeX, onClose]);

  return (
    <div
      className={`
        fixed z-50 flex flex-col ${theme.modal}
        inset-0 animate-slide-in-right
        sm:inset-auto sm:bottom-[88px] sm:right-4 sm:w-[380px] sm:h-[min(600px,calc(100dvh-6.5rem))]
        sm:rounded-2xl sm:shadow-2xl sm:border sm:border-slate-700 sm:animate-none
      `}
      style={{
        transform: swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
        transition: swipeX > 0 ? 'none' : 'transform 0.2s ease',
        paddingBottom: `${kbOffset}px`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="pt-safe sm:pt-0 flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
          {/* Mobil: geri oku, Desktop: X */}
          <button onClick={onClose} className="p-2 -ml-1 opacity-70 hover:opacity-100">
            <ArrowLeft size={22} className="sm:hidden" />
            <X size={22} className="hidden sm:block" />
          </button>
          <span className="text-2xl">{friend.avatar}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">@{friend.username}</p>
            {friend.fullName && <p className="text-xs opacity-60 truncate">{friend.fullName}</p>}
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
          {messages.map(m => {
            const isMine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine ? 'bg-teal-600 text-white' : `${theme.input} border ${theme.text}`}`}>
                  {m.text}
                  {/* Okundu tiki — sadece kendi mesajlarımızda */}
                  {isMine && (
                    <span className="flex justify-end mt-1">
                      {m.is_read
                        ? <CheckCheck size={12} className="text-cyan-300" />
                        : <Check size={12} className="text-white/50" />
                      }
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
      <div className="px-4 py-3 border-t border-slate-700 flex gap-2 flex-shrink-0 items-center pb-safe sm:pb-3">
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
