import { useCallback } from 'react';

export default function usePlans({ plans, setPlans }) {
  const savePlans = useCallback((newPlans) => {
    setPlans(newPlans);
    // Persistence is handled by useAuth's plans effect
  }, [setPlans]);

  return { savePlans };
}
