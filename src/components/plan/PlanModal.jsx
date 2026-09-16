import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Check, Clock, Repeat2 } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';

// Pazartesi başlangıç
const DAY_ORDER_MON     = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS_MON_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LABELS_MON_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Pazar başlangıç
const DAY_ORDER_SUN     = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS_SUN_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_LABELS_SUN_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// JS getDay() indeksine göre etiket (özet metni için)
const DAY_MAP_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_MAP_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REPEAT_WEEKS_MAX = 12;

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatSelDate(dateStr, lang, t) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = t('cal.days');   // ['Mo','Tu',...] veya ['Pt','Sa',...]
  const monthNames = t('cal.months');
  const dayOfWeek = dayNames[(d.getDay() + 6) % 7]; // Pt=0 sıralaması
  const day = d.getDate();
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return lang === 'tr'
    ? `${dayOfWeek}, ${day} ${month} ${year}`
    : `${dayOfWeek}, ${month} ${day}, ${year}`;
}

export default function PlanModal({ theme, selDate, plans, savePlans, onClose, weekStart = 1 }) {
  const { t, lang } = useLanguage();
  const isMon = weekStart === 1;
  const DAY_ORDER  = isMon ? DAY_ORDER_MON  : DAY_ORDER_SUN;
  const DAY_LABELS = isMon
    ? (lang === 'tr' ? DAY_LABELS_MON_TR : DAY_LABELS_MON_EN)
    : (lang === 'tr' ? DAY_LABELS_SUN_TR : DAY_LABELS_SUN_EN);
  const DAY_MAP    = lang === 'tr' ? DAY_MAP_TR    : DAY_MAP_EN;

  const [title,    setTitle]    = useState('');
  const [showTime, setShowTime] = useState(false);
  const [planTime, setPlanTime] = useState('');
  const [repeat,        setRepeat]        = useState(false);
  const [repeatDays,    setRepeatDays]    = useState([]);
  const [repeatWeeks,   setRepeatWeeks]   = useState(2);
  const [pendingAction, setPendingAction] = useState(null); // { type:'complete'|'uncomplete'|'delete', plan }

  const inputRef    = useRef(null);
  const timeInputRef = useRef(null);
  const modalRef     = useRef(null);

  // Mobilde otomatik focus klavyeyi açıp modalı aşağı iter — sadece desktop'ta focus ver
  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) inputRef.current?.focus();
  }, []);

  // Klavye açılırken visualViewport her karede resize fırlatır. Yüksekliği state
  // yerine CSS değişkenine yazıyoruz: React hiç re-render olmaz, sadece tarayıcı
  // layout'u güncellenir. rAF ile de kare başına tek güncelleme garanti edilir.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const write = (px) => root.style.setProperty('--avail-h', `${px}px`);
    if (!vv) { write(window.innerHeight); return; }

    let raf = 0;
    const update = () => { raf = 0; write(vv.height); };
    const onChange = () => { if (!raf) raf = requestAnimationFrame(update); };

    update();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty('--avail-h');
    };
  }, []);

  const openTimePicker = () => {
    const el = timeInputRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.click(); }
  };

  const toggleRepeat = () => {
    if (!repeat) {
      // Seçili günün haftanın gününü ön seç
      const d = new Date(selDate + 'T00:00:00');
      setRepeatDays([d.getDay()]);
    } else {
      setRepeatDays([]);
    }
    setRepeat(r => !r);
  };

  const toggleDay = (day) => {
    setRepeatDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const add = () => {
    if (!title.trim()) return;
    if (title.length > 100) { alert(t('plan.maxChars')); return; }

    const sanitized = sanitizeInput(title, 100);
    const time = showTime && planTime ? planTime : null;
    const newPlans = [];
    const repeatId = (repeat && repeatDays.length > 0) ? `r_${Date.now()}` : null;

    if (repeat && repeatDays.length > 0) {

      // Seçili günden itibaren repeatWeeks hafta boyunca seçili günlere plan ekle
      // Not: repeatWeeks * 7 - 1 gün = tam olarak repeatWeeks haftalık pencere
      const start = new Date(selDate + 'T00:00:00');
      const end   = new Date(start);
      end.setDate(end.getDate() + repeatWeeks * 7 - 1);

      const cur = new Date(start);
      while (cur <= end) {
        if (repeatDays.includes(cur.getDay())) {
          const dateStr  = localDateStr(cur);
          newPlans.push({ id: Date.now() + Math.random(), date: dateStr, title: sanitized, time, repeatId });
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      newPlans.push({ id: Date.now(), date: selDate, title: sanitized, time });
    }

    savePlans([...plans, ...newPlans]);
    setTitle('');
    setPlanTime('');
    if (repeat) { setRepeat(false); setRepeatDays([]); setRepeatWeeks(2); }
  };

  const dayPlans = plans
    .filter(p => p.date === selDate)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={modalRef} className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600 flex flex-col overflow-y-auto`} style={{ maxHeight: 'calc(var(--avail-h, 100vh) * 0.85)' }} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-teal-400 mb-3 flex-shrink-0">{formatSelDate(selDate, lang, t)} ({dayPlans.length})</h3>

        {/* Plan listesi */}
        <div className="overflow-y-auto mb-3 min-h-0" style={{ maxHeight: 'calc(var(--avail-h, 100vh) * 0.3)' }}>
          {dayPlans.map(p => {
            const siblings = p.repeatId ? plans.filter(pl => pl.repeatId === p.repeatId) : [];
            const isRecurring = siblings.length > 1;
            const handleComplete = (val) => {
              savePlans(plans.map(pl => pl.id === p.id ? { ...pl, completed: val } : pl));
            };
            const handleDelete = () => {
              if (isRecurring) { setPendingAction({ type: 'delete', plan: p }); return; }
              savePlans(plans.filter(pl => pl.id !== p.id));
            };
            return (
              <div key={p.id} className={`flex items-center gap-2 ${theme.input} rounded-lg p-2.5 mb-2 border ${p.completed ? 'bg-emerald-900/20 border-emerald-500/30' : ''}`}>
                {!p.completed ? (
                  <button onClick={() => handleComplete(true)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-500 hover:border-emerald-400 transition-colors" />
                ) : (
                  <button onClick={() => handleComplete(false)} className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors"><Check size={12} className="text-white" /></button>
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${theme.text} break-words ${p.completed ? 'line-through opacity-60' : ''}`}>{p.title}</span>
                  {p.time && <p className="text-[10px] text-cyan-400 mt-0.5 flex items-center gap-0.5"><Clock size={9} />{p.time}</p>}
                  {isRecurring && <p className="text-[9px] text-violet-400 mt-0.5 flex items-center gap-0.5"><Repeat2 size={8} />{siblings.length} {t('plan.repeatWeeks')}</p>}
                </div>
                <button onClick={handleDelete} className="p-1 flex-shrink-0"><Trash2 size={16} className="text-red-400" /></button>
              </div>
            );
          })}
          {dayPlans.length === 0 && <p className={`text-center ${theme.textMuted} py-4`}>{t('home.noPlans')}</p>}
        </div>

        {/* Yeni plan girişi */}
        <div className="flex-shrink-0 mb-3">
          <textarea
            ref={inputRef}
            placeholder={t('plan.addPlan')}
            value={title}
            onChange={e => { if (e.target.value.length <= 100) setTitle(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
            className={`w-full ${theme.input} rounded-lg p-3 text-sm outline-none border ${theme.text} resize-none`}
            rows={2} maxLength={100}
          />

          {/* Alt araçlar: saat + tekrarlı + karakter sayısı */}
          <div className="mt-1.5 flex gap-1.5 items-center">
              {/* Saat toggle */}
              <button
                onClick={() => { setShowTime(s => !s); if (showTime) setPlanTime(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-colors ${showTime ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-400' : `${theme.input} border-slate-600 ${theme.textMuted}`}`}
              >
                <Clock size={11} />{t('plan.addTime')}
              </button>

              {/* Tekrarlı toggle */}
              <button
                onClick={toggleRepeat}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-colors ${repeat ? 'bg-violet-600/30 border-violet-500/50 text-violet-400' : `${theme.input} border-slate-600 ${theme.textMuted}`}`}
              >
                <Repeat2 size={11} />{t('plan.repeat')}
              </button>

              <span className={`text-xs flex-shrink-0 ${title.length >= 90 ? 'text-yellow-400' : theme.textMuted}`}>{title.length}/100</span>
          </div>

          {/* Saat seçici */}
          {showTime && (
            <div className="relative mt-2">
              {/* Gerçek input — her zaman render, picker için gerekli */}
              <input
                ref={timeInputRef}
                type="time"
                value={planTime}
                onChange={e => setPlanTime(e.target.value)}
                className={`w-full ${theme.input} rounded-lg py-2.5 text-sm outline-none border border-cyan-500/50 ${theme.text} cursor-pointer opacity-0 absolute inset-0 h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              />
              {/* Görsel katman — input'un üstünde */}
              {!planTime ? (
                <div
                  onClick={openTimePicker}
                  className={`flex items-center gap-2 ${theme.input} rounded-lg px-3 py-2.5 border border-dashed border-cyan-500/50 text-cyan-400/70 text-sm cursor-pointer pointer-events-none`}
                >
                  <Clock size={14} />
                  <span>{t('plan.timePlaceholder')}</span>
                </div>
              ) : (
                <div className={`flex items-center gap-2 ${theme.input} rounded-lg px-3 py-2.5 border border-cyan-500/50 text-sm pointer-events-none`}>
                  <Clock size={14} className="text-cyan-400 flex-shrink-0" />
                  <span className={`flex-1 ${theme.text}`}>{planTime}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setPlanTime(''); }}
                    className="text-slate-400 pointer-events-auto z-10"
                  >
                    <span className="text-xs">✕</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tekrarlı — gün seçici */}
          {repeat && (
            <div className={`mt-2 p-3 ${theme.input} rounded-xl border border-violet-500/30`}>
              <p className="text-xs text-violet-400 mb-2 flex items-center gap-1">
                <Repeat2 size={11} />{t('plan.repeatInfo', { n: repeatWeeks })}
              </p>

              {/* Gün seçici — 4 kolon x 2 satır, son hücre Tüm Hafta */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {DAY_LABELS.map((label, i) => {
                  const dayIdx = DAY_ORDER[i];
                  return (
                    <button
                      key={dayIdx}
                      onClick={() => toggleDay(dayIdx)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${repeatDays.includes(dayIdx) ? 'bg-violet-600 text-white' : `${theme.card} border ${theme.textMuted}`}`}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* Tüm Hafta butonu */}
                <button
                  onClick={() => {
                    const allSelected = DAY_ORDER.every(d => repeatDays.includes(d));
                    setRepeatDays(allSelected ? [] : [...DAY_ORDER]);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${DAY_ORDER.every(d => repeatDays.includes(d)) ? 'bg-violet-600 text-white' : `${theme.card} border ${theme.textMuted}`}`}
                >
                  {t('plan.allWeek')}
                </button>
              </div>

              {/* Hafta sayısı seçici — yatay scroll */}
              <p className="text-[10px] text-violet-300 mb-1.5">Kaç hafta tekrarlansın?</p>
              <div className="flex overflow-x-auto gap-2 pb-1 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {Array.from({ length: REPEAT_WEEKS_MAX - 1 }, (_, i) => i + 2).map(w => (
                  <button
                    key={w}
                    onClick={() => setRepeatWeeks(w)}
                    className={`snap-center flex-shrink-0 w-9 h-9 rounded-xl text-sm font-bold transition-colors ${repeatWeeks === w ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50' : `${theme.card} border ${theme.textMuted}`}`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              {repeatDays.length > 0 && (
                <p className="text-[10px] text-violet-300 mt-2 text-center">
                  {`${[...repeatDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).map(d => DAY_MAP[d]).join(', ')} — ${repeatWeeks} ${t('plan.repeatWeeks')}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>{t('plan.close')}</button>
          <button
            onClick={add}
            disabled={repeat && repeatDays.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white disabled:opacity-50"
          >
            {repeat ? `${t('plan.add')} (${repeatDays.length > 0 ? `${repeatWeeks} ${t('plan.repeatWeeks')}` : '—'})` : t('plan.add')}
          </button>
        </div>
      </div>

      {/* Tekrarlı plan aksiyonu: sadece bu / tümü */}
      {pendingAction && (() => {
        const { type, plan } = pendingAction;
        const siblings = plans.filter(pl => pl.repeatId === plan.repeatId);
        const applyOne = () => {
          savePlans(plans.filter(pl => pl.id !== plan.id));
          setPendingAction(null);
        };
        const applyAll = () => {
          savePlans(plans.filter(pl => pl.repeatId !== plan.repeatId));
          setPendingAction(null);
        };
        return (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-sm border border-slate-600`}>
              <p className="text-sm font-bold text-center mb-1 text-red-400">
                {t('plan.repeatDeleteTitle')}
              </p>
              <p className={`text-xs text-center ${theme.textMuted} mb-4`}>
                {t('plan.repeatScope', { n: siblings.length })}
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={applyOne} className={`py-2.5 rounded-xl font-semibold text-sm ${theme.input} border ${theme.text}`}>
                  {t('plan.repeatOnlyThis')}
                </button>
                <button onClick={applyAll} className="py-2.5 rounded-xl font-bold text-sm text-white bg-red-600">
                  {t('plan.repeatAll', { n: siblings.length })}
                </button>
                <button onClick={() => setPendingAction(null)} className={`py-2 text-xs ${theme.textMuted}`}>
                  {t('plan.close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
