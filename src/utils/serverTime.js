const MAX_DAY_SECS = 24 * 3600; // günlük maksimum 24 saat

// Tüm veriler cihazda tutulduğu için zaman kaynağı da yereldir —
// dışarıya hiçbir istek atılmaz.
export function serverNow() {
  return Date.now();
}

export { MAX_DAY_SECS };
