import React, { useRef, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { localDateStr, fmtShort } from '../../utils/formatters';

const WEEKS = 52;

// Günlük süreyi 0-4 arası yoğunluk seviyesine çevir
function levelOf(secs) {
  if (!secs)          return 0;
  if (secs <  3600)   return 1;  // 1 saatten az
  if (secs <  7200)   return 2;  // 1-2 saat
  if (secs < 14400)   return 3;  // 2-4 saat
  return 4;                       // 4 saat ve üzeri
}

// Tek renk + opaklık: hem aydınlık hem karanlık temada okunur
const LEVEL_BG = [
  null,                 // 0 → theme.input kullanılır
  'bg-teal-500/25',
  'bg-teal-500/50',
  'bg-teal-500/75',
  'bg-teal-500',
];

const StudyHeatmap = ({ theme, studyHistory, weekStart }) => {
  const { t, ta } = useLanguage();
  const scrollRef = useRef(null);

  const monthLabels = ta('stats.monthLabels');

  const { columns, total, activeDays } = useMemo(() => {
    const byDate = new Map((studyHistory || []).map(h => [h.date, h.secs]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = localDateStr(today);

    // Satır indeksi: haftanın ilk günü ayara göre değişir (Pzt=1 / Paz=0)
    const rowOf = d => (d.getDay() - weekStart + 7) % 7;

    // Izgara, içinde bulunulan haftanın başından 52 hafta geriye uzanır
    const gridStart = new Date(today);
    gridStart.setDate(today.getDate() - rowOf(today) - (WEEKS - 1) * 7);

    const cols = [];
    let total = 0;
    let activeDays = 0;

    for (let w = 0; w < WEEKS; w++) {
      const days = [];
      for (let r = 0; r < 7; r++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + w * 7 + r);
        const key  = localDateStr(d);
        const secs = byDate.get(key) || 0;
        const future = key > todayKey;
        if (!future && secs > 0) { total += secs; activeDays++; }
        days.push({ key, secs, future, month: d.getMonth(), dayOfMonth: d.getDate() });
      }
      cols.push(days);
    }
    return { columns: cols, total, activeDays };
  }, [studyHistory, weekStart]);

  // Açılışta en sağa (bugüne) kaydır
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns]);

  return (
    <div className={`${theme.card} rounded-2xl p-4 mb-4 border`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-teal-400 flex items-center gap-2">
          <CalendarDays size={18} />{t('heatmap.title')}
        </h3>
        <span className={`text-[11px] ${theme.textMuted}`}>
          {t('heatmap.activeDays', { n: activeDays })}
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Ay etiketleri */}
          <div className="flex gap-[3px] mb-1">
            {columns.map((days, i) => {
              const prev = columns[i - 1];
              const isNewMonth = i === 0 || prev[0].month !== days[0].month;
              return (
                <div key={i} className="w-[12px] shrink-0">
                  {isNewMonth && (
                    <span className={`text-[9px] ${theme.textMuted} whitespace-nowrap`}>
                      {monthLabels[days[0].month]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Izgara */}
          <div className="flex gap-[3px]">
            {columns.map((days, i) => (
              <div key={i} className="flex flex-col gap-[3px] shrink-0">
                {days.map(d => {
                  if (d.future) {
                    return <div key={d.key} className="w-[12px] h-[12px]" />;
                  }
                  const lvl = levelOf(d.secs);
                  return (
                    <div
                      key={d.key}
                      title={`${d.key} — ${d.secs ? fmtShort(d.secs, t) : t('heatmap.noStudy')}`}
                      className={`w-[12px] h-[12px] rounded-[2px] ${lvl === 0 ? `${theme.input} border` : LEVEL_BG[lvl]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Açıklama */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-[11px] ${theme.textMuted}`}>
          {t('heatmap.yearTotal')}: <span className={theme.text}>{fmtShort(total, t)}</span>
        </span>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] ${theme.textMuted}`}>{t('heatmap.less')}</span>
          {[0, 1, 2, 3, 4].map(l => (
            <div
              key={l}
              className={`w-[10px] h-[10px] rounded-[2px] ${l === 0 ? `${theme.input} border` : LEVEL_BG[l]}`}
            />
          ))}
          <span className={`text-[9px] ${theme.textMuted}`}>{t('heatmap.more')}</span>
        </div>
      </div>
    </div>
  );
};

export default StudyHeatmap;
