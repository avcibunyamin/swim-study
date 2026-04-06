import React from 'react';
import { Home, Calendar, Timer, BarChart3, User } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmt } from '../../utils/formatters';

export default function NavBar({ navConfig, theme, page, setPage, isRunning, isOnBreak, isFreeMode, freeTime, timeLeft }) {
  const { t } = useLanguage();
  const navItems = [
    { id: 'home',        Icon: Home,     l: t('nav.home') },
    { id: 'plan',        Icon: Calendar, l: t('nav.plan') },
    { id: 'pomodoro',    Icon: Timer,    l: t('nav.pomodoro') },
    { id: 'performance', Icon: BarChart3, l: t('nav.performance') },
    { id: 'profile',     Icon: User,     l: t('nav.profile') },
  ];

  return (
    <nav className={`${navConfig.navCls} ${theme.nav} p-2 z-40 ${!navConfig.vertical ? 'pb-nav-safe' : ''}`}>
      {isRunning && !isOnBreak && page !== 'pomodoro' && (
        <div className={`${navConfig.timerCls} bg-gradient-to-r from-teal-600 to-cyan-600 rounded-full px-4 py-1 flex items-center gap-2 animate-pulse shadow-lg`}>
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          <span className="text-white text-xs font-bold">{fmt(isFreeMode ? freeTime : timeLeft)}</span>
        </div>
      )}
      <div className={navConfig.innerCls}>
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={`relative flex flex-col items-center justify-center ${navConfig.vertical ? 'p-1.5 w-12 h-12' : 'p-2 mx-auto w-full'} rounded-xl transition-all ${page === n.id ? 'bg-gradient-to-r from-teal-600 to-cyan-600 scale-105' : ''}`}
          >
            <n.Icon size={navConfig.vertical ? 18 : 20} className={page === n.id ? 'text-white' : theme.textMuted} />
            {!navConfig.vertical && (
              <span className={`text-[10px] mt-1 whitespace-nowrap ${page === n.id ? 'text-white font-bold' : theme.textMuted}`}>
                {n.l}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
