import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();

// Bildirim tercihini uygula: açılıyorsa izin iste, ardından tercihi kalıcı yaz.
// Hem Pomodoro sayfasındaki zil butonu hem Ayarlar'daki anahtar bunu kullanır.
export async function applyNotificationSetting(enabled) {
  if (enabled) await ensurePermission();
  try { localStorage.setItem('swim_notifications', String(enabled)); } catch (_) {}
}

// Dürtme (seri hatırlatma) bildirimleri ayrı bir tercih: pomodoro bitiş
// bildirimlerini kapatmadan bunları susturabilmek gerekiyor.
export async function applyNudgeSetting(enabled) {
  if (enabled) await ensurePermission();
  try { localStorage.setItem('swim_nudges', String(enabled)); } catch (_) {}
}

async function ensurePermission() {
  if (!isNative) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (_) {}
}
