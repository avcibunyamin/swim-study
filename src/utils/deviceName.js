import { Capacitor } from '@capacitor/core';

/** Okunabilir cihaz adı — UI'da gösterilir */
export function getDeviceName() {
  if (Capacitor.isNativePlatform()) {
    const p = Capacitor.getPlatform();
    return p === 'ios' ? 'iPhone/iPad' : 'Android';
  }
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua))             return 'iPhone';
  if (/iPad/.test(ua))               return 'iPad';
  if (/Android/.test(ua))            return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows NT/.test(ua))         return 'Windows';
  if (/Linux/.test(ua))              return 'Linux';
  return 'Tarayıcı';
}

/**
 * DB'ye yazılan etiket: "Mac::a1b2c3d4"
 * sessionStorage sayesinde aynı tarayıcıda açılan her sekme farklı ID alır.
 * Böylece "Sekme 1 vs Sekme 2" de ayrı cihaz olarak tanınır.
 */
export function getDeviceLabel() {
  let tabId = sessionStorage.getItem('swim_tab_id');
  if (!tabId) {
    tabId = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('swim_tab_id', tabId);
  }
  return `${getDeviceName()}::${tabId}`;
}

/** DB'deki etiketten okunabilir adı çıkarır: "Mac::abc" → "Mac" */
export function parseDeviceName(label) {
  return label?.split('::')?.[0] || label || 'Bilinmeyen Cihaz';
}
