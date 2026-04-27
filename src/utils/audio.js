// Kalıcı AudioContext — iOS/Android'de her seferinde yeni context oluşturmak ses vermez
let _ctx = null;
let _audioUnlocked = false;

const getCtx = () => {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ctx;
};

/**
 * İlk kullanıcı etkileşiminde (touch/click) çağrılmalı.
 * iOS ve bazı Android tarayıcıları, AudioContext'i kullanıcı jesti olmadan başlatmaz.
 * Sadece ilk çağrıda çalışır, sonraki çağrılar sessizce atlanır.
 */
export const unlockAudio = () => {
  if (_audioUnlocked) return;
  try {
    const ctx = getCtx();
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    // Sessiz gain node ile click artefaktı olmadan context'i aktive et
    resume.then(() => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      src.start(0);
      src.stop(ctx.currentTime + 0.1);
      _audioUnlocked = true;
    }).catch(() => {});
  } catch (e) {
    // Sessizce geç
  }
};

const _doPlay = (ctx) => {
  const p = (f, st, d) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0.3, st);
    g.gain.exponentialRampToValueAtTime(0.01, st + d);
    o.start(st);
    o.stop(st + d);
  };
  p(523.25, ctx.currentTime, 0.3);
  p(659.25, ctx.currentTime + 0.15, 0.3);
  p(783.99, ctx.currentTime + 0.3, 0.5);
};

/**
 * Zil sesi çal.
 * @param {boolean} notifications - false ise çalmaz (kullanıcı bildirimleri kapattıysa)
 */
export const playBell = (notifications = true) => {
  if (!notifications) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      // Mobil için kritik: suspended context'i önce resume et
      ctx.resume().then(() => _doPlay(ctx)).catch(() => {});
    } else {
      _doPlay(ctx);
    }
  } catch (e) {
    console.debug('playBell skipped:', e.message);
  }
};
