import { useEffect } from 'react';

// Simplified presence: local-only, just tracks online/offline status
export default function usePresence({ isOnline, setIsOnline }) {
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setIsOnline]);
}
