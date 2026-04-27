const OFFSET_KEY  = 'swim_time_offset';
const MAX_DAY_SECS = 24 * 3600; // günlük maksimum 24 saat

let offset = (() => {
  const saved = localStorage.getItem(OFFSET_KEY);
  return saved ? Number(saved) : 0;
})();

// Uygulama açılışında public NTP API'dan gerçek saati çek
export async function syncServerTime() {
  try {
    const before = Date.now();
    const res    = await fetch('https://worldtimeapi.org/api/ip', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const after  = Date.now();
    if (!res.ok) throw new Error('ntp_fail');
    const data    = await res.json();
    const serverMs = data.unixtime * 1000;
    const localMs  = Math.round((before + after) / 2); // round-trip ortası
    offset = localMs - serverMs; // pozitif = cihaz saati ileri
    localStorage.setItem(OFFSET_KEY, String(offset));
  } catch {
    // NTP başarısız — önceki kaydedilmiş offset'i kullan (zaten yüklendi)
  }
}

// Düzeltilmiş gerçek zaman (ms)
export function serverNow() {
  return Date.now() - offset;
}

export function serverISOString() {
  return new Date(serverNow()).toISOString();
}

export { MAX_DAY_SECS };
