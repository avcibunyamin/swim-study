import React, { useRef, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { localDateStr, fmtShort } from '../../utils/formatters';

const WEEKS = 52;
const CELL  = 12; // px
const GAP   = 3;  // px

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

  // 364 hücre tek seferde mount ediliyor; hesabı olabildiğince ucuz tut.
  // Hücreler düz bir dizi olarak üretilir ve CSS grid'e sütun sütun akıtılır —
  // her hafta için ayrı sarmalayıcı div açmak 52 fazladan düğüm demekti.
  const { cells, months, total, activeDays } = useMemo(() => {
    const byDate = new Map((studyHistory || []).map(h => [h.date, h.secs]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = localDateStr(today);

    // Satır indeksi: haftanın ilk günü ayara göre değişir (Pzt=1 / Paz=0)
    const rowOf = d => (d.getDay() - weekStart + 7) % 7;

    const gridStart = new Date(today);
    gridStart.setDate(today.getDate() - rowOf(today) - (WEEKS - 1) * 7);

    const cells  = [];
    const months = [];
    let total = 0;
    let activeDays = 0;
    let lastMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      for (let r = 0; r < 7; r++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + w * 7 + r);
        const key  = localDateStr(d);
        const secs = byDate.get(key) || 0;
        const future = key > todayKey;

        if (!future && secs > 0) { total += secs; activeDays++; }

        // Ay etiketi yalnızca ay değiştiğinde, sütunun ilk gününde üretilir.
        // Önceden her sütun için boş bir div render ediliyordu (52 düğüm),
        // şimdi yılda ~12 etiket var.
        if (r === 0 && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth();
          months.push({ col: w + 1, label: monthLabels[lastMonth] });
        }

        cells.push({ key, lvl: future ? -1 : levelOf(secs) });
      }
    }
    return { cells, months, total, activeDays };
  }, [studyHistory, weekStart, monthLabels]);

  // Açılışta en sağa (bugüne) kaydır. rAF içinde yapılır; render sırasında
  // scrollWidth okumak zorunlu senkron layout tetikler ve ilk kareyi geciktirir.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth; });
    return () => cancelAnimationFrame(id);
  }, [cells]);

  const gridStyle = {
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateRows: `repeat(7, ${CELL}px)`,
    gridAutoColumns: `${CELL}px`,
    gap: `${GAP}px`,
  };

  return (
    // Bu kartta bilerek backdrop-blur yok: 364 hücrelik yoğun bir yüzeyi
    // bulanıklaştırmak her kaydırmada yeniden kompozisyon maliyeti çıkarıyor.
    <div className={`${theme.cardSolid || theme.card} rounded-2xl p-4 mb-4 border`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className={`font-bold ${theme.accent} flex items-center gap-2`}>
          <CalendarDays size={18} />{t('heatmap.title')}
        </h3>
        <span className={`text-[11px] ${theme.textMuted}`}>
          {t('heatmap.activeDays', { n: activeDays })}
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Ay etiketleri — sütun numarasına göre hizalanır */}
          <div
            className="mb-1"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`,
              gap: `${GAP}px`,
              height: '12px',
            }}
          >
            {months.map(m => (
              <span
                key={m.col}
                className={`text-[9px] ${theme.textMuted} whitespace-nowrap`}
                style={{ gridColumn: m.col }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Izgara — tek grid, sütun sütun akar */}
          <div style={gridStyle}>
            {cells.map(c => (
              <div
                key={c.key}
                className={
                  c.lvl < 0 ? ''                                  // gelecek gün: boş
                  : c.lvl === 0 ? `rounded-[2px] ${theme.heatEmpty}`
                  : `rounded-[2px] ${LEVEL_BG[c.lvl]}`
                }
              />
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
              className={`w-[10px] h-[10px] rounded-[2px] ${l === 0 ? theme.heatEmpty : LEVEL_BG[l]}`}
            />
          ))}
          <span className={`text-[9px] ${theme.textMuted}`}>{t('heatmap.more')}</span>
        </div>
      </div>
    </div>
  );
};

export default StudyHeatmap;
