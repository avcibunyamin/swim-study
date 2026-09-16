import React, { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { localDateStr } from '../../utils/formatters';
import Logo from '../ui/Logo';
import PlanModal from './PlanModal';

const EMPTY = [];

const PlanPage = memo(({ theme, pagePadding, calDate, setCalDate, plans, savePlans, isOnline, showPlanModal, setShowPlanModal, selDate, setSelDate, weekStart = 1 }) => {
  const { t, ta } = useLanguage();
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // weekStart=1 → Pazartesi başlangıç, weekStart=0 → Pazar başlangıç
  const rawFirstDay = new Date(year, month, 1).getDay(); // 0=Paz,1=Pt,...
  const firstDay = (rawFirstDay - weekStart + 7) % 7;
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const ds = d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // localDateStr: takvim günleri yerel tarihten üretiliyor, "bugün" de yerel
  // olmalı — toISOString() UTC verip gece saatlerinde yanlış günü vurgular.
  const todayStr = localDateStr();
  // Gün başlıklarını weekStart'a göre döndür
  const allCalDays = ta('cal.days') || ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  // cal.days Pt'den başlar (Mon=0), weekStart=0(Pazar) ise Pz'yi başa al
  const calDays = weekStart === 1
    ? allCalDays
    : [...allCalDays.slice(6), ...allCalDays.slice(0, 6)]; // Pz başa
  const calMonths = ta('cal.months') || ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Her hücrede plans.filter() çağırmak ayda 42 × O(n) tarama demekti. Tek
  // geçişte tarihe göre grupla, hücreler haritadan okusun.
  const plansByDate = useMemo(() => {
    const m = new Map();
    for (const p of plans || []) {
      const list = m.get(p.date);
      if (list) list.push(p); else m.set(p.date, [p]);
    }
    return m;
  }, [plans]);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      {/* Modal açıkken takvimi display:none yap. Overlay onu zaten örtüyor ama
          layout ağacında kalınca, klavye açılırken Capacitor'ın WebView'a
          gönderdiği her requestLayout() 42 hücreyi yeniden hesaplatıyordu. */}
      <div className={showPlanModal ? 'hidden' : ''}>
        <div className="text-center py-2"><Logo size="sm" centered /></div>
        <div className={`flex justify-between items-center ${theme.card} rounded-xl p-2 mb-3 border`}>
          <button onClick={() => setCalDate(new Date(year, month - 1))} className="p-2"><ChevronLeft size={20} className="text-teal-400" /></button>
          <span className="font-bold text-cyan-400">{calMonths[month]} {year}</span>
          <button onClick={() => setCalDate(new Date(year, month + 1))} className="p-2"><ChevronRight size={20} className="text-teal-400" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {calDays.map(d => <div key={d} className={`text-center text-xs ${theme.textMuted} py-1`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = ds(d);
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const dayPlans = plansByDate.get(dateStr) || EMPTY;
            return (
              <button key={i} onClick={() => { setSelDate(dateStr); setShowPlanModal(true); }} className={`min-h-[60px] p-1 rounded-lg border text-left ${isToday ? 'bg-gradient-to-br from-emerald-600 to-teal-600 border-emerald-400' : isPast ? `${theme.card} opacity-50` : theme.card}`}>
                <span className="text-xs font-bold">{d}</span>
                {dayPlans.slice(0, 2).map(p => (
                  <div key={p.id} className={`text-[8px] rounded px-0.5 truncate mt-0.5 ${isToday ? 'bg-white/20' : 'bg-teal-600/50'}`}>{p.title}</div>
                ))}
              </button>
            );
          })}
        </div>
      </div>
      {showPlanModal && <PlanModal theme={theme} selDate={selDate} plans={plans} savePlans={savePlans} onClose={() => setShowPlanModal(false)} weekStart={weekStart} />}
    </div>
  );
});

export default PlanPage;
