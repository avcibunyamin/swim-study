import React, { memo } from 'react';
import { Waves } from 'lucide-react';

const Logo = memo(({ size = 'md', centered = false }) => {
  const s = {
    sm: { i: 20, t: 'text-lg' },
    md: { i: 28, t: 'text-2xl' },
    lg: { i: 36, t: 'text-3xl' }
  };
  return (
    <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <div className="relative">
        <Waves className="text-teal-400" size={s[size].i} />
        <div className="absolute inset-0 blur-sm">
          <Waves className="text-cyan-400 opacity-50" size={s[size].i} />
        </div>
      </div>
      <span className={`font-black bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent ${s[size].t} leading-none`}>
        SWIM
      </span>
    </div>
  );
});

export default Logo;
