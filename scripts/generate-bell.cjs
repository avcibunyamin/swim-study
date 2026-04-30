// Bell sesi WAV üretici — C5-E5-G5 sıralı akorlu zil.
// LocalNotification ses dosyası için kullanılır.
// Çıktı: ios/App/App/bell.wav (iOS bundle'a eklenir)
//        android/app/src/main/res/raw/bell.wav (Android raw resource)

const fs   = require('fs');
const path = require('path');

const sampleRate    = 44100;
const totalDuration = 0.85;            // saniye
const totalSamples  = Math.floor(sampleRate * totalDuration);

// BellPlugin.swift ile birebir aynı notalar
const notes = [
  { freq: 523.25, start: 0.00, dur: 0.3 }, // C5
  { freq: 659.25, start: 0.15, dur: 0.3 }, // E5
  { freq: 783.99, start: 0.30, dur: 0.5 }, // G5
];

const samples = new Int16Array(totalSamples);
for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  let sample = 0;
  for (const note of notes) {
    const localT = t - note.start;
    if (localT >= 0 && localT < note.dur) {
      // exponential decay: 0.3 → 0.01 (Web Audio rampToValueAtTime ile birebir)
      const envFactor = Math.pow(0.01 / 0.3, localT / note.dur);
      const envelope  = 0.3 * envFactor;
      sample += envelope * Math.sin(2 * Math.PI * note.freq * t);
    }
  }
  const clipped = Math.max(-1, Math.min(1, sample));
  samples[i] = Math.floor(clipped * 32767);
}

// WAV (PCM 16-bit mono) — 44 baytlık header
const dataSize = samples.length * 2;
const fileSize = 44 + dataSize;
const buf = Buffer.alloc(fileSize);
let pos = 0;
buf.write('RIFF', pos); pos += 4;
buf.writeUInt32LE(fileSize - 8, pos); pos += 4;
buf.write('WAVE', pos); pos += 4;
buf.write('fmt ', pos); pos += 4;
buf.writeUInt32LE(16, pos); pos += 4;          // PCM chunk size
buf.writeUInt16LE(1, pos); pos += 2;            // PCM format
buf.writeUInt16LE(1, pos); pos += 2;            // mono
buf.writeUInt32LE(sampleRate, pos); pos += 4;
buf.writeUInt32LE(sampleRate * 2, pos); pos += 4; // byte rate
buf.writeUInt16LE(2, pos); pos += 2;            // block align
buf.writeUInt16LE(16, pos); pos += 2;           // bits per sample
buf.write('data', pos); pos += 4;
buf.writeUInt32LE(dataSize, pos); pos += 4;
for (let i = 0; i < samples.length; i++) {
  buf.writeInt16LE(samples[i], pos);
  pos += 2;
}

const outputs = [
  path.join(__dirname, '..', 'ios', 'App', 'App', 'bell.wav'),
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw', 'bell.wav'),
];

for (const out of outputs) {
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`Generated: ${out} (${buf.length} bytes)`);
}
