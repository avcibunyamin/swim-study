import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n';
import { localDateStr } from '../utils/formatters';

export default function useStats({ studyHistory }) {
  const { t, ta } = useLanguage();
  const [statsPeriod, setStatsPeriod] = useState('week');
  const [statsOffset, setStatsOffset] = useState(0);

  const dayLabels   = ta('stats.dayLabels');
  const monthLabels = ta('stats.monthLabels');

  const getStatsData = useMemo(() => {
    let chartData   = [];
    let periodLabel = '';
    let periodDates = [];

    const entry = (ds) => studyHistory.find(h => h.date === ds);

    if (statsPeriod === 'day') {
      const d = new Date();
      d.setDate(d.getDate() - statsOffset);
      const ds = localDateStr(d);
      const e  = entry(ds);
      chartData   = [{ label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), secs: e?.secs || 0 }];
      periodLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      periodDates = [ds];

    } else if (statsPeriod === 'week') {
      const ws = new Date();
      ws.setDate(ws.getDate() - ws.getDay() + 1 - statsOffset * 7);
      for (let i = 0; i < 7; i++) {
        const d  = new Date(ws);
        d.setDate(d.getDate() + i);
        const ds = localDateStr(d);
        const e  = entry(ds);
        chartData.push({ label: dayLabels[i], secs: e?.secs || 0 });
        periodDates.push(ds);
      }
      periodLabel = `${ws.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - ${new Date(ws.getTime() + 6 * 86400000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;

    } else if (statsPeriod === 'month') {
      const tm  = new Date();
      tm.setDate(1); // ay geri alınırken 31'inden kısa aya taşmayı önle
      tm.setMonth(tm.getMonth() - statsOffset);
      const y   = tm.getFullYear();
      const m   = tm.getMonth();
      const dim = new Date(y, m + 1, 0).getDate();
      for (let w = 0; w < 4; w++) {
        let ws = 0;
        // Son kutu ayın kalanını da kapsar, yoksa 29-31. günler hiç sayılmaz
        const end = w === 3 ? dim : Math.min((w + 1) * 7, dim);
        for (let d = w * 7 + 1; d <= end; d++) {
          const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const e  = entry(ds);
          ws += e?.secs || 0;
          periodDates.push(ds);
        }
        chartData.push({ label: t('stats.weekLabel').replace('{n}', w + 1), secs: ws });
      }
      periodLabel = tm.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    } else if (statsPeriod === 'year') {
      const ty = new Date().getFullYear() - statsOffset;
      for (let m = 0; m < 12; m++) {
        let ms  = 0;
        const dim = new Date(ty, m + 1, 0).getDate();
        for (let d = 1; d <= dim; d++) {
          const ds = `${ty}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const e  = entry(ds);
          ms += e?.secs || 0;
          periodDates.push(ds);
        }
        chartData.push({ label: monthLabels[m], secs: ms });
      }
      periodLabel = String(ty);
    }

    return {
      totalSecs: chartData.reduce((s, d) => s + d.secs, 0),
      chartData,
      periodLabel,
    };
  }, [studyHistory, statsPeriod, statsOffset, dayLabels, monthLabels, t]);

  return {
    statsPeriod, setStatsPeriod,
    statsOffset, setStatsOffset,
    getStatsData,
  };
}
