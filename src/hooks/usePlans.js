import { useCallback } from 'react';
import { supabase } from '../supabase';

export default function usePlans({ user, isOnline, plans, setPlans }) {
  const savePlans = useCallback(async (newPlans) => {
    setPlans(newPlans);
    if (!user || !isOnline) return;
    await supabase.from('users')
      .update({ plans: newPlans })
      .eq('id', user.id)
      .then(undefined, e => console.warn('Plans save error:', e.message));
  }, [user, isOnline, setPlans]);

  return { savePlans };
}
