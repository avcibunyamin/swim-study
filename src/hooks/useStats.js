import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n';
import { localDateStr } from '../utils/formatters';

export default function useStats({ studyHistory }) {
  const { t, ta } = useLanguage();
  const [statsPeriod, setStatsPeriod] = useState('week');
  const [statsOffset, setStatsOffset] = useState(0);

  const dayLabels   = ta('stats.dayLabels');
  const monthLabels = ta('stats.monthLabels');

  // Bir dönemin (period, offset) grafik verisini, etiketini ve toplamını üretir.
  // Hem görüntülenen dönem hem bir öncesi için çağrılır (karşılaştırma).
  const build = useMemo(() => {
    const secsOf = ds => studyHistory.find(h => h.date === ds)?.secs || 0;

    return (period, offset) => {
      const chartData = [];
      let periodLabel = '';

      if (period === 'day') {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        chartData.push({
          label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
          secs: secsOf(localDateStr(d)),
        });
        periodLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

      } else if (period === 'week') {
        const ws = new Date();
        ws.setDate(ws.getDate() - ws.getDay() + 1 - offset * 7);
        for (let i = 0; i < 7; i++) {
          const d = new Date(ws);
          d.setDate(ws.getDate() + i);
          chartData.push({ label: dayLabels[i], secs: secsOf(localDateStr(d)) });
        }
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        periodLabel = `${ws.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - ${we.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;

      } else if (period === 'month') {
        const tm = new Date();
        tm.setDate(1); // ay geri alınırken 31'inden kısa aya taşmayı önle
        tm.setMonth(tm.getMonth() - offset);
        const y = tm.getFullYear();
        const m = tm.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        for (let w = 0; w < 4; w++) {
          // Son kutu ayın kalanını da kapsar, yoksa 29-31. günler sayılmaz
          const end = w === 3 ? dim : Math.min((w + 1) * 7, dim);
          let ws = 0;
          for (let d = w * 7 + 1; d <= end; d++) ws += secsOf(localDateStr(new Date(y, m, d)));
          chartData.push({ label: t('stats.weekLabel').replace('{n}', w + 1), secs: ws });
        }
        periodLabel = tm.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

      } else { // year
        const ty = new Date().getFullYear() - offset;
        for (let m = 0; m < 12; m++) {
          const dim = new Date(ty, m + 1, 0).getDate();
          let ms = 0;
          for (let d = 1; d <= dim; d++) ms += secsOf(localDateStr(new Date(ty, m, d)));
          chartData.push({ label: monthLabels[m], secs: ms });
        }
        periodLabel = String(ty);
      }

      return {
        chartData,
        periodLabel,
        totalSecs: chartData.reduce((s, d) => s + d.secs, 0),
      };
    };
  }, [studyHistory, dayLabels, monthLabels, t]);

  const getStatsData = useMemo(() => {
    const current = build(statsPeriod, statsOffset);
    const prev    = build(statsPeriod, statsOffset + 1);

    // Önceki dönem boşsa yüzde hesaplanamaz (sıfıra bölme)
    const deltaPct = prev.totalSecs > 0
      ? Math.round(((current.totalSecs - prev.totalSecs) / prev.totalSecs) * 100)
      : null;

    return { ...current, prevSecs: prev.totalSecs, deltaPct };
  }, [build, statsPeriod, statsOffset]);

  return {
    statsPeriod, setStatsPeriod,
    statsOffset, setStatsOffset,
    getStatsData,
  };
}
