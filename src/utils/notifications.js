import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();

// Bildirim tercihini uygula: açılıyorsa izin iste, ardından tercihi kalıcı yaz.
// Hem Pomodoro sayfasındaki zil butonu hem Ayarlar'daki anahtar bunu kullanır.
export async function applyNotificationSetting(enabled) {
  if (enabled && isNative) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch (_) {}
  }
  try { localStorage.setItem('swim_notifications', String(enabled)); } catch (_) {}
}
