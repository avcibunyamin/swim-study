import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n';
import Logo from '../ui/Logo';
import PlanModal from './PlanModal';

const PlanPage = memo(({ theme, pagePadding, calDate, setCalDate, plans, savePlans, isOnline, showPlanModal, setShowPlanModal, selDate, setSelDate }) => {
  const { t, ta } = useLanguage();
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Pazartesi = 0 olacak şekilde offset: (getDay()+6)%7  → Pz=6, Pt=0, Sa=1 ...
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const ds = d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const calDays = ta('cal.days') || ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  const calMonths = ta('cal.months') || ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding}`}>
      <div className="text-center py-2"><Logo size="sm" centered /></div>
      {!isOnline && <div className="bg-yellow-600 rounded-xl p-2 mb-4 text-white text-sm text-center flex items-center justify-center gap-2"><WifiOff size={16} />{t('auth.offline')}</div>}
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
          const dayPlans = plans.filter(p => p.date === dateStr);
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
      {showPlanModal && <PlanModal theme={theme} selDate={selDate} plans={plans} savePlans={savePlans} onClose={() => setShowPlanModal(false)} />}
    </div>
  );
});

export default PlanPage;
