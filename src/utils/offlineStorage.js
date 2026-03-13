const OFFLINE_KEY = 'swim_offline_data';

export const saveOfflineData = (userId, secs) => {
  try {
    const e = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '{}');
    e[userId] = (e[userId] || 0) + secs;
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(e));
  } catch (e) {
    console.debug('saveOfflineData failed:', e.message);
  }
};

export const getOfflineData = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '{}')[userId] || 0;
  } catch {
    return 0;
  }
};

export const clearOfflineData = (userId) => {
  try {
    const d = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '{}');
    delete d[userId];
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(d));
  } catch (e) {
    console.debug('clearOfflineData failed:', e.message);
  }
};
