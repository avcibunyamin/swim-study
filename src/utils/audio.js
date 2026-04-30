import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const isIOS = isNative && Capacitor.getPlatform() === 'ios';
// iOS native bell plugin — sessiz modu by-pass eder ve WKWebView audio'sunu bozmaz
const BellNative = isIOS ? Capacitor.registerPlugin('BellPlugin') : null;

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

const _playBellWeb = () => {
  const tryPlay = (ctx) => {
    if (ctx.state === 'running') {
      _doPlay(ctx);
      return;
    }
    // suspended (sessiz modu veya arkaplan sonrası) → resume et
    ctx.resume().then(() => _doPlay(ctx)).catch(() => {
      // resume başarısız → context'i sıfırla ve yeniden dene
      try { ctx.close(); } catch (_) {}
      _ctx = null;
      _audioUnlocked = false;
      try { _doPlay(getCtx()); } catch (_) {}
    });
  };

  try {
    const ctx = getCtx();
    if (ctx.state === 'closed') {
      _ctx = null;
      _audioUnlocked = false;
      tryPlay(getCtx());
    } else {
      tryPlay(ctx);
    }
  } catch (e) {
    console.debug('playBell skipped:', e.message);
  }
};

/**
 * Zil sesi çal.
 * iOS'ta native AVAudioEngine kullanır — sessiz modu by-pass eder, banner yok.
 * Diğer platformlarda Web Audio API fallback.
 * @param {boolean} notifications - false ise çalmaz
 */
export const playBell = (notifications = true) => {
  if (!notifications) return;

  // iOS'ta native plugin'i tercih et — sessiz modda da çalar
  if (BellNative) {
    BellNative.play().catch((e) => {
      console.debug('Native bell failed, fallback to web audio:', e?.message);
      _playBellWeb();
    });
    return;
  }
  _playBellWeb();
};
