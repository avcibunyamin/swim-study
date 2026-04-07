import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Renk sabitleri
private extension Color {
    static let swimTeal   = Color(red: 0.20, green: 0.84, blue: 0.75)
    static let swimOrange = Color(red: 1.00, green: 0.65, blue: 0.20)
    static let swimBg     = Color(red: 0.06, green: 0.09, blue: 0.14)
    static let swimCard   = Color(red: 0.10, green: 0.14, blue: 0.20)
}

// MARK: - Yardımcı fonksiyonlar
private func fmtTime(_ secs: Int) -> String {
    let m = secs / 60
    let s = secs % 60
    return String(format: "%02d:%02d", m, s)
}

private func progress(_ state: SwimTimerAttributes.ContentState) -> Double {
    guard state.totalSecs > 0 else { return 0 }
    let ratio = 1.0 - Double(state.timeLeft) / Double(state.totalSecs)
    return min(max(ratio, 0), 1)
}

// MARK: - Kilit ekranı / banner görünümü
struct SwimLockScreenView: View {
    let state: SwimTimerAttributes.ContentState

    var accent: Color  { state.isOnBreak ? .swimOrange : .swimTeal }
    var emoji: String  { state.isOnBreak ? "☕" : "🏊" }
    var modeLabel: String { state.isOnBreak ? "Mola" : "Çalışıyor" }

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .center, spacing: 20) {
                // Sol: emoji + mod
                VStack(alignment: .leading, spacing: 4) {
                    Text(emoji)
                        .font(.system(size: 48))
                    Text(modeLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                    Text("SWIM")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(accent)
                }

                Spacer()

                // Sağ: geri sayım
                VStack(alignment: .trailing, spacing: 4) {
                    if state.isFreeMode {
                        Text(fmtTime(state.freeTime))
                            .font(.system(size: 42, weight: .bold, design: .monospaced))
                            .foregroundColor(accent)
                        Text("Geçen süre")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.55))
                    } else {
                        Text(timerInterval: Date()...state.endDate, countsDown: true)
                            .font(.system(size: 42, weight: .bold, design: .monospaced))
                            .foregroundColor(accent)
                        Text(state.isOnBreak ? "Mola bitiyor" : "Kalan süre")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.55))
                    }
                }
            }

            // İlerleme çubuğu (sadece pomodoro modunda)
            if !state.isFreeMode {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.12))
                        RoundedRectangle(cornerRadius: 3)
                            .fill(accent)
                            .frame(width: geo.size.width * CGFloat(progress(state)))
                    }
                    .frame(height: 5)
                }
                .frame(height: 5)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
}

// MARK: - Live Activity widget tanımı
@available(iOS 16.1, *)
struct SwimTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SwimTimerAttributes.self) { context in
            // ── Kilit ekranı / Bildirim banner ──────────────────────────
            SwimLockScreenView(state: context.state)
                .activityBackgroundTint(Color.swimBg)
                .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            let state  = context.state
            let accent: Color = state.isOnBreak ? .swimOrange : .swimTeal
            let emoji  = state.isOnBreak ? "☕" : "🏊"

            return DynamicIsland {
                // ── Genişletilmiş Dynamic Island ─────────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Text(emoji).font(.title2)
                        Text(state.isOnBreak ? "Mola" : "Çalışıyor")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .padding(.leading, 6)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Group {
                        if state.isFreeMode {
                            Text(fmtTime(state.freeTime))
                                .font(.title2.weight(.bold).monospacedDigit())
                        } else {
                            Text(timerInterval: Date()...state.endDate, countsDown: true)
                                .font(.title2.weight(.bold).monospacedDigit())
                        }
                    }
                    .foregroundColor(accent)
                    .padding(.trailing, 6)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    if !state.isFreeMode {
                        ProgressView(value: progress(state))
                            .tint(accent)
                            .padding(.horizontal, 12)
                            .padding(.bottom, 4)
                    }
                }

            } compactLeading: {
                // ── Kompakt sol ──────────────────────────────────────────
                Text(emoji).font(.body)

            } compactTrailing: {
                // ── Kompakt sağ ──────────────────────────────────────────
                if state.isFreeMode {
                    Text(fmtTime(state.freeTime))
                        .font(.caption2.weight(.bold).monospacedDigit())
                        .foregroundColor(accent)
                } else {
                    Text(timerInterval: Date()...state.endDate, countsDown: true)
                        .font(.caption2.weight(.bold).monospacedDigit())
                        .foregroundColor(accent)
                }

            } minimal: {
                // ── Minimal (küçük daire) ────────────────────────────────
                Text(emoji)
            }
        }
    }
}
