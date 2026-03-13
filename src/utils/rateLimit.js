const rateLimiters = {};

export const canDoAction = (key, cooldownMs) => {
  const now = Date.now();
  if (rateLimiters[key] && now - rateLimiters[key] < cooldownMs) return false;
  rateLimiters[key] = now;
  return true;
};
