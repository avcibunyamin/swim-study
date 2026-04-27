import React, { useEffect, useRef } from 'react';

// ─── SVG Balık (sola bakan, 3D görünümlü) ────────────────────────────────────
function FishShape({ id, c1, c2, c3, w = 44, h = 24 }) {
  return (
    <svg width={w} height={h} viewBox="-22 -12 44 24" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={`b${id}`} cx="62%" cy="28%" r="72%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="52%"  stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
        <radialGradient id={`t${id}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
        <radialGradient id={`e${id}`} cx="35%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0a0f1e" />
        </radialGradient>
      </defs>

      {/* Kuyruk */}
      <path d="M-12,0 L-22,-9 L-19,0 L-22,9 Z" fill={`url(#t${id})`} />
      {/* Kuyruk eklem çizgisi */}
      <path d="M-12,-4 Q-10,0 -12,4" stroke={c3} strokeWidth="0.7" fill="none" opacity="0.5" />

      {/* Gövde */}
      <ellipse cx="0" cy="0" rx="13" ry="7.5" fill={`url(#b${id})`} />

      {/* Alt karın parlaması (3D için) */}
      <ellipse cx="1" cy="3.5" rx="7.5" ry="3.2" fill="rgba(255,255,255,0.16)" />
      {/* Üst sırt parlaması */}
      <ellipse cx="3" cy="-3.2" rx="5.5" ry="2" fill="rgba(255,255,255,0.30)" />
      {/* Yanlamasına derin renk (hacim) */}
      <ellipse cx="-2" cy="0" rx="6" ry="7" fill={c3} opacity="0.18" />

      {/* Sırt yüzgeci */}
      <path d="M4,-7.5 Q1,-13.5 -4,-7.5" fill={c2} opacity="0.80" />
      {/* Sırt yüzgeci damarları */}
      <path d="M3,-7.5 L2.5,-11" stroke={c3} strokeWidth="0.5" opacity="0.4" />
      <path d="M1,-7.5 L0,-12"   stroke={c3} strokeWidth="0.5" opacity="0.4" />
      <path d="M-1,-7.5 L-2,-11" stroke={c3} strokeWidth="0.5" opacity="0.4" />

      {/* Karın yüzgeci */}
      <path d="M2,7.5 Q0,12 -3,7.5" fill={c2} opacity="0.65" />

      {/* Solungaç çizgisi */}
      <path d="M5,-5.5 Q7.5,0 5,5.5" stroke="rgba(0,0,0,0.20)" strokeWidth="1" fill="none" />

      {/* Pul deseni (hafif) */}
      <ellipse cx="0"  cy="-1" rx="4" ry="3" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      <ellipse cx="-4" cy="-1" rx="4" ry="3" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />

      {/* Göz */}
      <circle cx="9.2" cy="-0.8" r="2.5"  fill={`url(#e${id})`} />
      <circle cx="9.2" cy="-0.8" r="2.5"  fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      {/* Göz parlaması */}
      <circle cx="9.9" cy="-1.6" r="0.8"  fill="rgba(255,255,255,0.92)" />
      <circle cx="8.8" cy="-0.2" r="0.35" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

// ─── Tek balık: bağımsız wander hareketi ────────────────────────────────────
function Fish({ id, c1, c2, c3, w, h, speed, initAngle, boundary, opacity = 1 }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);

  useEffect(() => {
    const R = boundary; // px, dairenin iç yarıçapı
    const state = {
      x: Math.cos(initAngle) * R * 0.25,
      y: Math.sin(initAngle) * R * 0.25,
      angle: initAngle,
      facing: 1, // 1=sola (SVG default), -1=sağa
    };

    let last = performance.now();
    let raf;

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Wander: küçük rastgele direksiyon değişimi
      state.angle += (Math.random() - 0.5) * 0.10;

      // Sınıra yaklaşınca merkeze doğru yönlen
      const dist = Math.sqrt(state.x ** 2 + state.y ** 2);
      if (dist > R - 20) {
        const toCenter = Math.atan2(-state.y, -state.x);
        let diff = toCenter - state.angle;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        state.angle += diff * 0.12;
      }

      // Pozisyonu güncelle
      state.x += Math.cos(state.angle) * speed * dt;
      state.y += Math.sin(state.angle) * speed * dt;

      // SVG balık sağa bakıyor → sağa gidince scaleX(1), sola gidince scaleX(-1)
      const newFacing = Math.cos(state.angle) >= 0 ? 1 : -1;

      // DOM'u doğrudan güncelle (React re-render yok)
      if (outerRef.current) {
        outerRef.current.style.transform =
          `translate(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px)`;
      }
      if (innerRef.current && newFacing !== state.facing) {
        state.facing = newFacing;
        innerRef.current.style.transform = `scaleX(${newFacing})`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={outerRef}
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -(h / 2),
        marginLeft: -(w / 2),
        willChange: 'transform',
        opacity,
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: 'scaleX(1)',
          transition: 'transform 0.55s ease',  // dönüş yumuşaması
          transformOrigin: 'center',
        }}
      >
        <FishShape id={id} c1={c1} c2={c2} c3={c3} w={w} h={h} />
      </div>
    </div>
  );
}

// ─── Balonlar ────────────────────────────────────────────────────────────────
const BUBBLE_KEYFRAMES = `
  @keyframes riseBubble {
    0%   { transform: translateY(0px)   translateX(0px);  opacity: 0.70; }
    45%  { transform: translateY(-28px) translateX(4px);  opacity: 0.50; }
    100% { transform: translateY(-70px) translateX(-3px); opacity: 0;    }
  }
  @keyframes swayWeed {
    0%, 100% { transform: rotate(-9deg); }
    50%      { transform: rotate(9deg);  }
  }
  @keyframes waterShimmer {
    0%, 100% { opacity: 0.05; }
    50%      { opacity: 0.14; }
  }
`;

const BUBBLES = [
  { b: 24, l: '36%', sz: 5, delay: '0s',   dur: '4.3s' },
  { b: 18, l: '55%', sz: 4, delay: '1.7s', dur: '3.5s' },
  { b: 27, l: '45%', sz: 6, delay: '3.0s', dur: '5.2s' },
  { b: 14, l: '41%', sz: 3, delay: '4.2s', dur: '3.9s' },
];

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
// SVG dairesi: r=100, stroke=10 → iç kenar r=95
// Wrapper p-6 (24px) + 110px offset → aquarium top/left = 39px, size = 190px
const AQUA_SIZE  = 190;
const AQUA_INSET = 39;
const FISH_R     = AQUA_SIZE / 2 - 8; // balığın dolaşacağı iç yarıçap (px)

export default function AquariumTimer({ children }) {
  return (
    <div className="relative p-6">
      <style>{BUBBLE_KEYFRAMES}</style>

      {/* Akvaryum arka planı */}
      <div
        className="absolute rounded-full overflow-hidden pointer-events-none"
        style={{
          top: AQUA_INSET, left: AQUA_INSET,
          width: AQUA_SIZE, height: AQUA_SIZE,
          background:
            'radial-gradient(ellipse at 35% 28%, rgba(6,182,212,0.22), rgba(7,89,133,0.40) 55%, rgba(2,44,80,0.58) 100%)',
        }}
      >
        {/* Su parlaması */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 28% 18%, rgba(255,255,255,0.14), transparent 58%)',
          animation: 'waterShimmer 3.8s ease-in-out infinite',
        }} />

        {/* Yosun sol */}
        <div style={{
          position: 'absolute', bottom: 8, left: '20%',
          fontSize: 17, lineHeight: 1,
          transformOrigin: 'bottom center',
          animation: 'swayWeed 3.4s ease-in-out infinite',
          userSelect: 'none',
        }}>🌿</div>

        {/* Yosun sağ */}
        <div style={{
          position: 'absolute', bottom: 8, right: '18%',
          fontSize: 12, lineHeight: 1,
          transformOrigin: 'bottom center',
          animation: 'swayWeed 2.9s ease-in-out infinite reverse',
          userSelect: 'none',
        }}>🌿</div>

        {/* Ana balık — teal */}
        <Fish
          id="f1"
          c1="#a5f3fc" c2="#0891b2" c3="#0c4a6e"
          w={44} h={24}
          speed={22}
          initAngle={0.8}
          boundary={FISH_R}
          opacity={1}
        />

        {/* Küçük balık — yeşil-mavi */}
        <Fish
          id="f2"
          c1="#6ee7b7" c2="#059669" c3="#064e3b"
          w={32} h={17}
          speed={17}
          initAngle={2.4}
          boundary={FISH_R - 8}
          opacity={0.80}
        />

        {/* Balonlar */}
        {BUBBLES.map((b, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: b.b, left: b.l,
            width: b.sz, height: b.sz,
            borderRadius: '50%',
            border: '1px solid rgba(125,211,252,0.55)',
            background: 'rgba(125,211,252,0.10)',
            animation: `riseBubble ${b.dur} ease-in infinite ${b.delay}`,
          }} />
        ))}
      </div>

      {/* SVG halkası + metin — üstte */}
      {children}
    </div>
  );
}
