import React, { memo } from 'react';

const StatusDot = memo(({ status, isOnline, size = 'sm' }) => {
  let color;
  if (status === 'hidden')   color = 'bg-slate-500';
  else if (!isOnline)        color = 'bg-red-500';
  else if (status === 'busy') color = 'bg-yellow-400';
  else                       color = 'bg-green-400';
  const sz = { sm: 'w-2 h-2', md: 'w-3 h-3' };
  return <span className={`${sz[size]} rounded-full ${color} absolute -bottom-0.5 -right-0.5 border-2 border-white/80`} />;
});

export default StatusDot;
