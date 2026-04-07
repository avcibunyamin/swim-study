import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// iOS Live Activity Capacitor plugin köprüsü
const LAPlugin = isNative
  ? Capacitor.registerPlugin('LiveActivityPlugin')
  : null;

export const startLiveActivity = async ({ timeLeft, totalSecs, isOnBreak, isFreeMode, freeTime }) => {
  if (!LAPlugin) return;
  try {
    await LAPlugin.start({ timeLeft, totalSecs: totalSecs ?? timeLeft, isOnBreak, isFreeMode, freeTime });
  } catch (e) {
    console.debug('[LiveActivity] start error:', e);
  }
};

export const updateLiveActivity = async ({ timeLeft, totalSecs, isOnBreak, isFreeMode, freeTime }) => {
  if (!LAPlugin) return;
  try {
    await LAPlugin.update({ timeLeft, totalSecs: totalSecs ?? timeLeft, isOnBreak, isFreeMode, freeTime });
  } catch (e) {
    console.debug('[LiveActivity] update error:', e);
  }
};

export const endLiveActivity = async () => {
  if (!LAPlugin) return;
  try {
    await LAPlugin.end({});
  } catch (e) {
    console.debug('[LiveActivity] end error:', e);
  }
};
