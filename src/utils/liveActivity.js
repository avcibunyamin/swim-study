import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const LAPlugin = isNative ? Capacitor.registerPlugin('LiveActivityPlugin') : null;

export const startLiveActivity = async ({ timeLeft, totalSecs, isOnBreak, isFreeMode, freeTime, isRunning = true, finishedType = 0 }) => {
  if (!LAPlugin) return;
  try {
    const res = await LAPlugin.start({ timeLeft, totalSecs: totalSecs ?? timeLeft, isOnBreak, isFreeMode, freeTime, isRunning, finishedType });
    console.log('[LiveActivity] başlatıldı', res);
  } catch (e) {
    console.warn('[LiveActivity] start HATA:', e);
  }
};

export const updateLiveActivity = async ({ timeLeft, totalSecs, isOnBreak, isFreeMode, freeTime, isRunning = true, finishedType = 0 }) => {
  if (!LAPlugin) return;
  try {
    await LAPlugin.update({ timeLeft, totalSecs: totalSecs ?? timeLeft, isOnBreak, isFreeMode, freeTime, isRunning, finishedType });
  } catch (e) {
    console.warn('[LiveActivity] update HATA:', e);
  }
};

export const endLiveActivity = async () => {
  if (!LAPlugin) return;
  try {
    await LAPlugin.end({});
  } catch (e) {
    console.warn('[LiveActivity] end HATA:', e);
  }
};
