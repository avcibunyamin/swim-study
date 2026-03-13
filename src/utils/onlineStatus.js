import { serverNow } from './serverTime';

export const isReallyOnline = (user) => {
  if (!user?.lastSeen) return false;
  const diff = serverNow() - new Date(user.lastSeen).getTime();
  // Online if lastSeen is within 90 seconds (heartbeat is 60s + buffer)
  return diff < 90000;
};
