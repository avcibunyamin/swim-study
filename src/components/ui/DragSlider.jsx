import React, { useState, useRef, useEffect, useCallback, memo } from 'react';

const DragSlider = memo(({ value, onChange, min, max, disabled, sliderBg }) => {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const calcValue = useCallback(clientX => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + pct * (max - min));
  }, [min, max, value]);

  useEffect(() => {
    if (!isDragging) return;
    const move = e => { e.preventDefault(); onChange(calcValue(e.touches ? e.touches[0].clientX : e.clientX)); };
    const end = () => setIsDragging(false);
    document.addEventListener('mousemove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
    };
  }, [isDragging, calcValue, onChange]);

  const start = e => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    onChange(calcValue(e.touches ? e.touches[0].clientX : e.clientX));
  };
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      className={`relative h-6 rounded-full select-none ${disabled ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ background: sliderBg || '#334155', touchAction: 'none' }}
      onMouseDown={start}
      onTouchStart={start}
    >
      <div className="absolute h-full rounded-full pointer-events-none" style={{ width: `${pct}%`, background: 'linear-gradient(to right, #14b8a6, #06b6d4)' }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg pointer-events-none border-4 border-teal-500" style={{ left: `calc(${pct}% - 16px)` }} />
    </div>
  );
});

export default DragSlider;
