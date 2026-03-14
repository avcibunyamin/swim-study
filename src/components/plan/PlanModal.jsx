import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Check, Clock } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';

export default function PlanModal({ theme, selDate, plans, savePlans, onClose }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [showTime, setShowTime] = useState(false);
  const [planTime, setPlanTime] = useState('');
  const inputRef = useRef(null);
  const timeInputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const openTimePicker = () => {
    const el = timeInputRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.click(); }
  };

  const add = () => {
    if (!title.trim()) return;
    const dayPlans = plans.filter(p => p.date === selDate);
    if (dayPlans.length >= 20) { alert(t('plan.maxPlans')); return; }
    if (title.length > 100) { alert(t('plan.maxChars')); return; }
    savePlans([...plans, {
      id: Date.now(),
      date: selDate,
      title: sanitizeInput(title, 100),
      time: showTime && planTime ? planTime : null,
    }]);
    setTitle('');
    setPlanTime('');
  };

  // Saat sırasıyla göster — saati olmayan sona
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
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600 max-h-[80vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-teal-400 mb-3 flex-shrink-0">{selDate} ({dayPlans.length}/20)</h3>
        <div className="flex-1 overflow-y-auto mb-3 min-h-0" style={{ maxHeight: '40vh' }}>
          {dayPlans.map(p => (
            <div key={p.id} className={`flex items-center gap-2 ${theme.input} rounded-lg p-2.5 mb-2 border ${p.completed ? 'bg-emerald-900/20 border-emerald-500/30' : ''}`}>
              {!p.completed ? (
                <button onClick={() => savePlans(plans.map(pl => pl.id === p.id ? { ...pl, completed: true } : pl))} className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-500 hover:border-emerald-400 transition-colors" />
              ) : (
                <button onClick={() => savePlans(plans.map(pl => pl.id === p.id ? { ...pl, completed: false } : pl))} className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors"><Check size={12} className="text-white" /></button>
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${theme.text} break-words ${p.completed ? 'line-through opacity-60' : ''}`}>{p.title}</span>
                {p.time && <p className="text-[10px] text-cyan-400 mt-0.5 flex items-center gap-0.5"><Clock size={9} />{p.time}</p>}
              </div>
              <button onClick={() => savePlans(plans.filter(pl => pl.id !== p.id))} className="p-1 flex-shrink-0"><Trash2 size={16} className="text-red-400" /></button>
            </div>
          ))}
          {dayPlans.length === 0 && <p className={`text-center ${theme.textMuted} py-4`}>{t('home.noPlans')}</p>}
        </div>
        <div className="flex-shrink-0 mb-3">
          <textarea
            ref={inputRef}
            placeholder={t('plan.addPlan')}
            value={title}
            onChange={e => { if (e.target.value.length <= 100) setTitle(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
            className={`w-full ${theme.input} rounded-lg p-3 text-sm outline-none border ${theme.text} resize-none`}
            rows={2} maxLength={100} disabled={dayPlans.length >= 20}
          />
          <div className="flex justify-between items-center mt-1">
            {/* İsteğe bağlı saat toggle */}
            <button
              onClick={() => { setShowTime(s => !s); if (showTime) setPlanTime(''); }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showTime ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-400' : `${theme.input} border-slate-600 ${theme.textMuted}`}`}
            >
              <div className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${showTime ? 'bg-cyan-500 border-cyan-400' : 'border-slate-500'}`}>
                {showTime && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <Clock size={11} />{t('plan.addTime')}
            </button>
            <span className={`text-xs ${title.length >= 90 ? 'text-yellow-400' : theme.textMuted}`}>{title.length}/100 {t('plan.charLabel')}</span>
          </div>
          {showTime && (
            <div className="relative mt-2">
              <button
                type="button"
                onClick={openTimePicker}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white z-10 leading-none"
              >
                <Clock size={15} />
              </button>
              <input
                ref={timeInputRef}
                type="time"
                value={planTime}
                onChange={e => setPlanTime(e.target.value)}
                onClick={openTimePicker}
                className={`w-full ${theme.input} rounded-lg pl-8 pr-2.5 py-2.5 text-sm outline-none border ${theme.text} cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>{t('plan.close')}</button>
          <button onClick={add} disabled={dayPlans.length >= 20} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white disabled:opacity-50">{t('plan.add')}</button>
        </div>
      </div>
    </div>
  );
}
