import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

const config = {
  success: { icon: CheckCircle, iconColor: 'text-green-400', bg: 'from-green-900/95 to-green-800/95', border: 'border-green-500/40', bar: 'bg-green-400' },
  error:   { icon: XCircle,     iconColor: 'text-red-400',   bg: 'from-red-900/95 to-red-800/95',     border: 'border-red-500/40',   bar: 'bg-red-400' },
  warning: { icon: AlertTriangle, iconColor: 'text-yellow-400', bg: 'from-yellow-900/95 to-yellow-800/95', border: 'border-yellow-500/40', bar: 'bg-yellow-400' },
  info:    { icon: CheckCircle, iconColor: 'text-teal-400',  bg: 'from-slate-800/95 to-slate-700/95', border: 'border-teal-500/40',  bar: 'bg-teal-400' },
};

export default function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);
  const duration = toast?.duration || 4000;

  useEffect(() => {
    if (!toast) return;
    setProgress(100);
    const steps = duration / 30;
    const decrement = 100 / steps;
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev - decrement;
        if (next <= 0) { clearInterval(interval); return 0; }
        return next;
      });
    }, 30);
    const timer = setTimeout(onClose, duration);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [toast, duration, onClose]);

  if (!toast) return null;

  const type = toast.type || 'info';
  const c = config[type] || config.info;
  const Icon = c.icon;
  const secs = Math.ceil((progress / 100) * (duration / 1000));

  // SVG circular countdown
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-3 pointer-events-none" style={{ paddingTop: 'max(env(safe-area-inset-top, 8px), 8px)' }}>
      <div className={`bg-gradient-to-r ${c.bg} backdrop-blur-xl rounded-2xl border ${c.border} shadow-2xl p-4 max-w-md mx-auto animate-fade-in pointer-events-auto`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Icon size={24} className={c.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            {toast.title && <p className="font-bold text-white text-sm leading-tight">{toast.title}</p>}
            <p className={`text-slate-200 text-sm ${toast.title ? 'mt-0.5' : ''}`}>{toast.message}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Circular countdown */}
            <div className="relative w-7 h-7">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={c.iconColor}
                  style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset, transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">{secs}</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${progress}%`, transition: 'width 0.1s linear' }} />
        </div>
      </div>
    </div>
  );
}
