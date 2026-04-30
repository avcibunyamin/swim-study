import Capacitor
import AVFoundation

// MARK: - Native Bell Plugin
// Sessiz modu by-pass eder, .mixWithOthers ile WKWebView audio'sunu bozmaz.
// Web Audio API'deki C5-E5-G5 zilini AVAudioEngine ile aynen üretir.
@objc(BellPlugin)
public class BellPlugin: CAPPlugin {

    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var isSetup = false
    private var cachedBuffer: AVAudioPCMBuffer? = nil

    @objc func play(_ call: CAPPluginCall) {
        // Audio session: .playback (sessiz modu by-pass) + .mixWithOthers (diğer ses akışlarını bozma)
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true, options: [])
        } catch {
            print("[Bell] session error: \(error.localizedDescription)")
        }

        // Engine kurulumu — sadece ilk seferinde
        if !isSetup {
            engine.attach(playerNode)
            let format = engine.mainMixerNode.outputFormat(forBus: 0)
            engine.connect(playerNode, to: engine.mainMixerNode, format: format)
            cachedBuffer = makeBellBuffer(format: format)
            isSetup = true
        }

        do {
            if !engine.isRunning {
                try engine.start()
            }
        } catch {
            print("[Bell] engine start error: \(error.localizedDescription)")
            call.resolve()
            return
        }

        guard let buf = cachedBuffer else { call.resolve(); return }
        playerNode.scheduleBuffer(buf, completionHandler: nil)
        if !playerNode.isPlaying { playerNode.play() }

        call.resolve()
    }

    // C5 (523.25Hz) → E5 (659.25Hz) → G5 (783.99Hz) — Web Audio versiyonunun aynısı
    private func makeBellBuffer(format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let sampleRate = format.sampleRate
        let totalDuration: Double = 0.85  // saniye
        let frameCount = AVAudioFrameCount(sampleRate * totalDuration)
        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            return nil
        }
        buf.frameLength = frameCount

        let notes: [(freq: Double, start: Double, dur: Double)] = [
            (523.25, 0.00, 0.3),  // C5
            (659.25, 0.15, 0.3),  // E5
            (783.99, 0.30, 0.5),  // G5
        ]

        let channels = Int(format.channelCount)
        for c in 0..<channels {
            guard let chan = buf.floatChannelData?[c] else { continue }
            for i in 0..<Int(frameCount) {
                let t = Double(i) / sampleRate
                var sample: Float = 0
                for note in notes {
                    let localT = t - note.start
                    if localT >= 0 && localT < note.dur {
                        // Exponential decay: 0.3 → 0.01 (Web Audio'daki ramp ile birebir)
                        let envFactor = pow(0.01 / 0.3, localT / note.dur)
                        let envelope = Float(0.3 * envFactor)
                        sample += envelope * Float(sin(2.0 * .pi * note.freq * t))
                    }
                }
                // Clipping önlemi
                chan[i] = max(min(sample, 1.0), -1.0)
            }
        }
        return buf
    }
}
