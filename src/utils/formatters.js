export const fmt = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const fmtSecs = (s, t) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hLabel = t ? t('time.h') : 's';
  const mLabel = t ? t('time.m') : 'dk';
  const sLabel = t ? t('time.s') : 'sn';
  if (h > 0) return `${h}${hLabel} ${m}${mLabel} ${sec}${sLabel}`;
  if (m > 0) return `${m}${mLabel} ${sec}${sLabel}`;
  return `${sec}${sLabel}`;
};

export const fmtShort = (s, t) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const hLabel = t ? t('time.h') : 's';
  const mLabel = t ? t('time.m') : 'dk';
  return h > 0 ? `${h}${hLabel} ${m}${mLabel}` : `${m}${mLabel}`;
};
