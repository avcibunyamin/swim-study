//
//  SwimTimerWidgetBundle.swift
//  SwimTimerWidget
//
//  Modern, glassmorphic Live Activity. Hafif animasyonlar:
//  - Aksan rengiyle nabız atan glow küresi
//  - Yumuşak yatay dalgalar
//  - Yukarı süzülen parlak partiküller
//  - Gradient timer text + gradient progress bar
//

import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Veri modeli
struct SwimTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var timeLeft: Int
        var totalSecs: Int
        var isOnBreak: Bool
        var isFreeMode: Bool
        var freeTime: Int
        var endDate: Date
        var isRunning: Bool
        var finishedType: Int // 0=normal 1=çalışma bitti 2=mola bitti
    }
}

// MARK: - Renkler
private extension Color {
    static let swimTeal     = Color(red: 0.20, green: 0.84, blue: 0.75)
    static let swimOrange   = Color(red: 1.00, green: 0.65, blue: 0.20)
    static let bgDeep       = Color(red: 0.04, green: 0.07, blue: 0.15)
    static let bgMid        = Color(red: 0.07, green: 0.12, blue: 0.22)
}

// MARK: - Yardımcılar
private func fmtTime(_ s: Int) -> String { String(format: "%02d:%02d", s/60, s%60) }
private func calcProgress(_ s: SwimTimerAttributes.ContentState) -> Double {
    guard s.totalSecs > 0 else { return 0 }
    return min(max(1.0 - Double(s.timeLeft) / Double(s.totalSecs), 0), 1)
}

// MARK: - Modern animasyonlu arka plan
private struct ModernBgView: View {
    let accent: Color
    let isAnimated: Bool

    var body: some View {
        TimelineView(.periodic(from: Date(), by: 1/20.0)) { tl in
            let t = tl.date.timeIntervalSince1970
            Canvas { ctx, size in
                let w = size.width
                let h = size.height

                // Yumuşak diagonal gradient
                ctx.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .linearGradient(
                        Gradient(colors: [.bgDeep, .bgMid]),
                        startPoint: CGPoint(x: 0, y: 0),
                        endPoint: CGPoint(x: w, y: h)
                    )
                )

                // Dalgalar
                drawWaves(ctx, t: t, w: w, h: h, color: accent, animated: isAnimated)

                // Partiküller
                drawParticles(ctx, t: t, w: w, h: h, color: accent, animated: isAnimated)

                // Aksan glow küresi (sol-üst)
                if isAnimated {
                    let pulse = 1.0 + 0.18 * sin(t * 1.6)
                    let glowR: CGFloat = 80 * CGFloat(pulse)
                    let cx: CGFloat = w * 0.18
                    let cy: CGFloat = h * 0.30
                    ctx.fill(
                        Path(ellipseIn: CGRect(x: cx - glowR, y: cy - glowR, width: glowR*2, height: glowR*2)),
                        with: .radialGradient(
                            Gradient(colors: [accent.opacity(0.32), accent.opacity(0.0)]),
                            center: CGPoint(x: cx, y: cy),
                            startRadius: 0,
                            endRadius: glowR
                        )
                    )
                }

                // Sağ alt karşı glow (daha küçük, ters fazda)
                if isAnimated {
                    let pulse2 = 1.0 + 0.15 * sin(t * 1.2 + 2.0)
                    let glowR2: CGFloat = 60 * CGFloat(pulse2)
                    let cx2: CGFloat = w * 0.85
                    let cy2: CGFloat = h * 0.75
                    ctx.fill(
                        Path(ellipseIn: CGRect(x: cx2 - glowR2, y: cy2 - glowR2, width: glowR2*2, height: glowR2*2)),
                        with: .radialGradient(
                            Gradient(colors: [accent.opacity(0.20), accent.opacity(0.0)]),
                            center: CGPoint(x: cx2, y: cy2),
                            startRadius: 0,
                            endRadius: glowR2
                        )
                    )
                }
            }
        }
    }
}

private func drawWaves(_ ctx: GraphicsContext, t: Double, w: CGFloat, h: CGFloat, color: Color, animated: Bool) {
    let layers = 3
    for i in 0..<layers {
        let baseY = h * CGFloat(0.62 + 0.12 * Double(i))
        let amplitude: CGFloat = animated ? CGFloat(6 + i * 2) : 4
        let freq: CGFloat = 0.014
        let speed: Double = animated ? (0.8 + Double(i) * 0.25) : 0
        let phase = animated ? (t * speed) : Double(i) * 1.3

        var path = Path()
        path.move(to: CGPoint(x: 0, y: baseY))
        let steps = 24
        for s in 0...steps {
            let x = w * CGFloat(s) / CGFloat(steps)
            let y = baseY + amplitude * CGFloat(sin(Double(x) * Double(freq) + phase + Double(i) * 0.7))
            path.addLine(to: CGPoint(x: x, y: y))
        }
        path.addLine(to: CGPoint(x: w, y: h))
        path.addLine(to: CGPoint(x: 0, y: h))
        path.closeSubpath()

        let opacity = 0.06 + 0.04 * Double(i)
        ctx.fill(path, with: .color(color.opacity(opacity)))
    }
}

private func drawParticles(_ ctx: GraphicsContext, t: Double, w: CGFloat, h: CGFloat, color: Color, animated: Bool) {
    // Statik konumlar deterministik; sadece y koordinatı zamanla yukarı kayar
    let particles: [(xf: Double, speed: Double, size: Double, delay: Double, blue: Bool)] = [
        (0.12, 0.10, 2.5, 0.0,  false),
        (0.28, 0.12, 1.8, 1.2,  true),
        (0.42, 0.09, 2.8, 0.6,  false),
        (0.58, 0.13, 1.6, 2.4,  true),
        (0.71, 0.11, 2.2, 1.8,  false),
        (0.87, 0.10, 1.9, 0.9,  true),
    ]
    for p in particles {
        let phase = animated ? (t * p.speed + p.delay) : (p.delay * 0.5)
        let cycle = phase.truncatingRemainder(dividingBy: 1.0)
        guard cycle > 0 else { continue }
        let yPos = h - CGFloat(cycle) * h * 1.1
        let drift = sin(cycle * .pi * 3 + p.xf * 10) * 4
        let xPos = w * CGFloat(p.xf) + CGFloat(drift)
        // Fade in (0-0.2) → tam (0.2-0.7) → fade out (0.7-1.0)
        var alpha: Double
        if cycle < 0.2 { alpha = cycle / 0.2 * 0.6 }
        else if cycle > 0.7 { alpha = (1.0 - cycle) / 0.3 * 0.6 }
        else { alpha = 0.6 }
        if alpha <= 0.02 { continue }

        let r = CGFloat(p.size)
        let dotColor = p.blue ? Color.white : color
        ctx.fill(
            Path(ellipseIn: CGRect(x: xPos - r, y: yPos - r, width: r*2, height: r*2)),
            with: .color(dotColor.opacity(alpha))
        )
        // Hafif outer glow
        ctx.fill(
            Path(ellipseIn: CGRect(x: xPos - r*1.8, y: yPos - r*1.8, width: r*3.6, height: r*3.6)),
            with: .color(dotColor.opacity(alpha * 0.18))
        )
    }
}

// MARK: - Modern Lock Screen görünümü
struct SwimLockScreenView: View {
    let state: SwimTimerAttributes.ContentState

    private var accent: Color {
        if state.finishedType == 1 { return .swimTeal }
        if state.finishedType == 2 { return .swimOrange }
        guard state.isRunning else { return Color(white: 0.55) }
        return state.isOnBreak ? .swimOrange : .swimTeal
    }
    private var icon: String {
        if state.finishedType == 1 { return "✅" }
        if state.finishedType == 2 { return "⏰" }
        if !state.isRunning { return "⏸" }
        return state.isOnBreak ? "☕" : "🏊" }
    private var modeLabel: String {
        if state.finishedType == 1 { return "Çalışma bitti" }
        if state.finishedType == 2 { return "Mola bitti" }
        if !state.isRunning { return "Duraklatıldı" }
        return state.isOnBreak ? "Mola" : "Çalışıyor" }
    private var subLabel: String {
        if state.finishedType == 1 { return "Mola başlıyor…" }
        if state.finishedType == 2 { return "Çalışmaya dön" }
        return "SWIM" }

    var body: some View {
        ZStack {
            ModernBgView(accent: accent, isAnimated: state.isRunning || state.finishedType != 0)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack(spacing: 10) {
                // Üst sıra: ikon+label / timer
                HStack(alignment: .center, spacing: 14) {
                    // İkon — soft glass capsule
                    ZStack {
                        Circle()
                            .fill(.ultraThinMaterial)
                            .overlay(Circle().stroke(accent.opacity(0.45), lineWidth: 1))
                            .frame(width: 46, height: 46)
                        Text(icon).font(.system(size: 26))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(modeLabel)
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(.white)
                        Text(subLabel)
                            .font(.caption2.weight(.heavy))
                            .tracking(1.5)
                            .foregroundColor(accent)
                    }

                    Spacer(minLength: 4)

                    // Timer — gradient text
                    Group {
                        if state.isFreeMode && state.isRunning {
                            Text(timerInterval: state.endDate...state.endDate.addingTimeInterval(86400), countsDown: false)
                        } else if state.isFreeMode {
                            Text(fmtTime(state.freeTime))
                        } else if state.isRunning && state.endDate > Date() {
                            Text(timerInterval: Date()...state.endDate, countsDown: true)
                        } else {
                            Text(fmtTime(state.timeLeft))
                        }
                    }
                    .font(.system(size: 38, weight: .heavy, design: .rounded).monospacedDigit())
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, accent.opacity(0.85)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .multilineTextAlignment(.trailing)
                    .frame(minWidth: 100, alignment: .trailing)
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)

                // Modern progress bar
                if !state.isFreeMode {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(.white.opacity(0.08))
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [accent.opacity(0.7), accent],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: max(4, geo.size.width * CGFloat(calcProgress(state))))
                                .shadow(color: accent.opacity(0.5), radius: 4, x: 0, y: 0)
                        }
                    }
                    .frame(height: 5)
                    .padding(.horizontal, 18)
                }

                Spacer(minLength: 0)
            }

            // "Bitti" overlay — sadece kısa süre gösterilir
            if state.finishedType != 0 {
                VStack {
                    Spacer()
                    HStack(spacing: 6) {
                        Text(state.finishedType == 1 ? "✅" : "☕")
                        Text(state.finishedType == 1 ? "Çalışma bitti!" : "Mola bitti!")
                            .font(.subheadline.weight(.bold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().stroke(accent.opacity(0.6), lineWidth: 1))
                    .padding(.bottom, 10)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 120)
    }
}

// MARK: - Live Activity widget
struct SwimTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SwimTimerAttributes.self) { context in
            SwimLockScreenView(state: context.state)
                .activityBackgroundTint(Color.bgDeep)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let state  = context.state
            let accent: Color = state.finishedType == 1 ? .swimTeal
                              : state.finishedType == 2 ? .swimOrange
                              : (state.isRunning ? (state.isOnBreak ? .swimOrange : .swimTeal) : .gray)
            let icon  = state.finishedType == 1 ? "✅"
                      : state.finishedType == 2 ? "⏰"
                      : (state.isRunning ? (state.isOnBreak ? "☕" : "🏊") : "⏸")
            let label = state.finishedType == 1 ? "Bitti"
                      : state.finishedType == 2 ? "Bitti"
                      : (state.isRunning ? (state.isOnBreak ? "Mola" : "Çalışıyor") : "Duraklatıldı")

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        ZStack {
                            Circle().fill(.ultraThinMaterial)
                                .overlay(Circle().stroke(accent.opacity(0.5), lineWidth: 1))
                                .frame(width: 36, height: 36)
                            Text(icon).font(.title3)
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(label).font(.caption.weight(.semibold)).foregroundColor(.white.opacity(0.85))
                            Text("SWIM").font(.caption2.weight(.heavy)).tracking(1.2).foregroundColor(accent)
                        }
                    }.padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Group {
                        if state.isFreeMode && state.isRunning { Text(timerInterval: state.endDate...state.endDate.addingTimeInterval(86400), countsDown: false) }
                        else if state.isFreeMode { Text(fmtTime(state.freeTime)) }
                        else if state.isRunning && state.endDate > Date() { Text(timerInterval: Date()...state.endDate, countsDown: true) }
                        else { Text(fmtTime(state.timeLeft)) }
                    }
                    .font(.title2.weight(.heavy).monospacedDigit())
                    .foregroundStyle(
                        LinearGradient(colors: [.white, accent.opacity(0.85)],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !state.isFreeMode {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.10))
                                Capsule()
                                    .fill(
                                        LinearGradient(
                                            colors: [accent.opacity(0.7), accent],
                                            startPoint: .leading, endPoint: .trailing
                                        )
                                    )
                                    .frame(width: max(4, geo.size.width * CGFloat(calcProgress(state))))
                                    .shadow(color: accent.opacity(0.5), radius: 3)
                            }
                        }
                        .frame(height: 4)
                        .padding(.horizontal, 6).padding(.bottom, 6)
                    }
                }
            } compactLeading: {
                Text(icon).font(.body)
            } compactTrailing: {
                Group {
                    if state.isFreeMode && state.isRunning { Text(timerInterval: state.endDate...state.endDate.addingTimeInterval(86400), countsDown: false) }
                    else if state.isFreeMode { Text(fmtTime(state.freeTime)) }
                    else if state.isRunning && state.endDate > Date() { Text(timerInterval: Date()...state.endDate, countsDown: true) }
                    else { Text(fmtTime(state.timeLeft)) }
                }
                .font(.caption2.weight(.bold).monospacedDigit())
                .foregroundColor(accent)
            } minimal: {
                Text(icon)
            }
        }
    }
}

@main
struct SwimTimerWidgetBundle: WidgetBundle {
    var body: some Widget { SwimTimerLiveActivity() }
}
