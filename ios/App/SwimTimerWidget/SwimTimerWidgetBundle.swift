//
//  SwimTimerWidgetBundle.swift
//  SwimTimerWidget
//
//  Akvaryum Live Activity — balıklar, su otları, baloncuklar, kum zemini.
//  Timer: Text(timerInterval:) ile saniye saniye düzgün sayar.
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
    static let swimTeal   = Color(red: 0.20, green: 0.84, blue: 0.75)
    static let swimOrange = Color(red: 1.00, green: 0.65, blue: 0.20)
    static let f1c1 = Color(red: 0.647, green: 0.953, blue: 0.988)
    static let f1c2 = Color(red: 0.035, green: 0.569, blue: 0.698)
    static let f1c3 = Color(red: 0.047, green: 0.290, blue: 0.431)
    static let f2c1 = Color(red: 0.431, green: 0.906, blue: 0.718)
    static let f2c2 = Color(red: 0.020, green: 0.588, blue: 0.412)
    static let f2c3 = Color(red: 0.024, green: 0.306, blue: 0.231)
}

private func fmtTime(_ s: Int) -> String { String(format: "%02d:%02d", s/60, s%60) }
private func calcProgress(_ s: SwimTimerAttributes.ContentState) -> Double {
    guard s.totalSecs > 0 else { return 0 }
    return min(max(1.0 - Double(s.timeLeft) / Double(s.totalSecs), 0), 1)
}

// MARK: - Wander hareketi
private func wanderPos(t: Double, freqs: [Double], amps: [Double], phase: Double) -> Double {
    var v = 0.0
    for i in 0..<freqs.count { v += amps[i] * sin(t * freqs[i] + phase) }
    return v
}

private struct FishPos { let x: CGFloat; let y: CGFloat; let right: Bool }

private func calcFishWander(t: Double,
                             xFreqs: [Double], xAmps: [Double],
                             yFreqs: [Double], yAmps: [Double],
                             phase: Double,
                             w: Double, h: Double) -> FishPos {
    let margin: Double = 32
    let xNorm  = (wanderPos(t: t,       freqs: xFreqs, amps: xAmps, phase: phase) + 1) / 2
    let yNorm  = (wanderPos(t: t,       freqs: yFreqs, amps: yAmps, phase: phase) + 1) / 2
    let xNext  = (wanderPos(t: t+0.08,  freqs: xFreqs, amps: xAmps, phase: phase) + 1) / 2
    let rx     = margin + xNorm * (w - margin*2)
    let ry     = margin*0.6 + yNorm * (h - margin*1.2)
    return FishPos(x: CGFloat(rx), y: CGFloat(ry), right: xNext > xNorm)
}

private let f1xFreqs = [0.173, 0.311, 0.537, 0.071]
private let f1xAmps  = [0.42,  0.28,  0.17,  0.13]
private let f1yFreqs = [0.191, 0.419, 0.137, 0.673]
private let f1yAmps  = [0.38,  0.24,  0.22,  0.16]
private let f2xFreqs = [0.127, 0.263, 0.471, 0.093]
private let f2xAmps  = [0.44,  0.26,  0.18,  0.12]
private let f2yFreqs = [0.217, 0.383, 0.159, 0.591]
private let f2yAmps  = [0.35,  0.27,  0.23,  0.15]

// MARK: - Balık çizimi
private func drawFish(_ ctx: GraphicsContext,
                      x: CGFloat, y: CGFloat,
                      w: CGFloat, h: CGFloat,
                      right: Bool,
                      c1: Color, c2: Color, c3: Color) {
    let d: CGFloat = right ? 1 : -1

    // Kuyruk
    var tail = Path()
    tail.move(to:    CGPoint(x: x - d*w*0.27, y: y))
    tail.addLine(to: CGPoint(x: x - d*w*0.50, y: y - h*0.38))
    tail.addLine(to: CGPoint(x: x - d*w*0.43, y: y))
    tail.addLine(to: CGPoint(x: x - d*w*0.50, y: y + h*0.38))
    tail.closeSubpath()
    ctx.fill(tail, with: .color(c2.opacity(0.85)))

    var tailJoint = Path()
    tailJoint.move(to: CGPoint(x: x - d*w*0.27, y: y - h*0.17))
    tailJoint.addQuadCurve(to: CGPoint(x: x - d*w*0.27, y: y + h*0.17),
                            control: CGPoint(x: x - d*w*0.23, y: y))
    ctx.stroke(tailJoint, with: .color(c3.opacity(0.45)), lineWidth: 0.7)

    // Gövde
    let bx = right ? x - w*0.26 : x - w*0.40
    ctx.fill(Path(ellipseIn: CGRect(x: bx, y: y-h*0.50, width: w*0.66, height: h)),
             with: .color(c2))
    ctx.fill(Path(ellipseIn: CGRect(x: bx+w*0.14, y: y-h*0.40, width: w*0.36, height: h*0.52)),
             with: .color(c1.opacity(0.55)))
    ctx.fill(Path(ellipseIn: CGRect(x: bx+w*0.10, y: y+h*0.02, width: w*0.42, height: h*0.35)),
             with: .color(.white.opacity(0.16)))
    ctx.fill(Path(ellipseIn: CGRect(x: bx+w*0.16, y: y-h*0.46, width: w*0.30, height: h*0.28)),
             with: .color(.white.opacity(0.28)))
    ctx.fill(Path(ellipseIn: CGRect(x: bx+w*0.04, y: y-h*0.47, width: w*0.34, height: h*0.94)),
             with: .color(c3.opacity(0.18)))

    // Sırt yüzgeci
    var dorsal = Path()
    let dfx = x + d*w*0.09
    dorsal.move(to: CGPoint(x: dfx, y: y-h*0.50))
    dorsal.addQuadCurve(to: CGPoint(x: dfx - d*w*0.19, y: y-h*0.50),
                        control: CGPoint(x: dfx - d*w*0.07, y: y-h*0.92))
    ctx.fill(dorsal, with: .color(c2.opacity(0.80)))
    for offset in [0.02, -0.04, -0.10] as [Double] {
        var vein = Path()
        let vx = dfx + d*CGFloat(offset)*w
        vein.move(to: CGPoint(x: vx, y: y-h*0.50))
        vein.addLine(to: CGPoint(x: vx - d*w*0.02, y: y-h*0.80))
        ctx.stroke(vein, with: .color(c3.opacity(0.40)), lineWidth: 0.5)
    }

    // Karın yüzgeci
    var belly = Path()
    let bfx = x + d*w*0.05
    belly.move(to: CGPoint(x: bfx, y: y+h*0.50))
    belly.addQuadCurve(to: CGPoint(x: bfx - d*w*0.18, y: y+h*0.50),
                       control: CGPoint(x: bfx - d*w*0.06, y: y+h*0.88))
    ctx.fill(belly, with: .color(c2.opacity(0.65)))

    // Solungaç
    var gill = Path()
    let gx = x + d*w*0.12
    gill.move(to: CGPoint(x: gx, y: y-h*0.37))
    gill.addQuadCurve(to: CGPoint(x: gx, y: y+h*0.37),
                      control: CGPoint(x: gx + d*w*0.07, y: y))
    ctx.stroke(gill, with: .color(.black.opacity(0.20)), lineWidth: 1.0)

    // Pullar
    ctx.stroke(Path(ellipseIn: CGRect(x: x-w*0.07, y: y-h*0.25, width: w*0.22, height: h*0.50)),
               with: .color(.white.opacity(0.08)), lineWidth: 0.6)
    ctx.stroke(Path(ellipseIn: CGRect(x: x-w*0.22, y: y-h*0.25, width: w*0.22, height: h*0.50)),
               with: .color(.white.opacity(0.06)), lineWidth: 0.6)

    // Göz
    let er: CGFloat = h * 0.21
    let ex = x + d*w*0.21
    let ey = y - h*0.07
    ctx.fill(Path(ellipseIn: CGRect(x: ex-er, y: ey-er, width: er*2, height: er*2)),
             with: .color(Color(red:0.12,green:0.23,blue:0.37)))
    ctx.fill(Path(ellipseIn: CGRect(x: ex-er, y: ey-er, width: er*2, height: er*2)),
             with: .color(.black.opacity(0.65)))
    ctx.stroke(Path(ellipseIn: CGRect(x: ex-er, y: ey-er, width: er*2, height: er*2)),
               with: .color(.white.opacity(0.15)), lineWidth: 0.5)
    ctx.fill(Path(ellipseIn: CGRect(x: ex-er*0.35+d*er*0.3, y: ey-er*0.85, width: er*0.75, height: er*0.75)),
             with: .color(.white.opacity(0.92)))
    ctx.fill(Path(ellipseIn: CGRect(x: ex-er*0.5, y: ey+er*0.1, width: er*0.45, height: er*0.45)),
             with: .color(.white.opacity(0.45)))
}

// MARK: - Su otları
private func drawSeaweed(_ ctx: GraphicsContext, t: Double, w: CGFloat, h: CGFloat) {
    let weeds: [(xf: Double, hf: Double, ph: Double, spd: Double)] = [
        (0.08, 0.52, 0.00, 1.05), (0.20, 0.44, 1.40, 0.90),
        (0.48, 0.60, 2.80, 1.20), (0.68, 0.46, 0.85, 0.95),
        (0.87, 0.50, 2.10, 1.10), (0.34, 0.40, 3.50, 0.85),
    ]
    for weed in weeds {
        let bx   = w * CGFloat(weed.xf)
        let sh   = h * CGFloat(weed.hf) * 0.80
        let maxSway: CGFloat = 6.0
        let sway = maxSway * CGFloat(sin(t * weed.spd + weed.ph))
        var path = Path()
        path.move(to: CGPoint(x: bx, y: h))
        let segs = 7
        for s in 1...segs {
            let p  = CGFloat(s) / CGFloat(segs)
            let sw  = sway * p * CGFloat(sin(Double(s)*1.05 + weed.ph))
            let sx  = bx + sw
            let sy  = h - sh * p
            let cp1 = CGPoint(x: bx + sw*0.4, y: h - sh*(p-0.08))
            let cp2 = CGPoint(x: sx - sw*0.2, y: h - sh*(p-0.03))
            path.addCurve(to: CGPoint(x: sx, y: sy), control1: cp1, control2: cp2)
        }
        let bright = CGFloat(0.50 + 0.12 * sin(t*0.5 + weed.ph))
        let thickness = CGFloat(2.5 + 0.8 * sin(t*0.3 + weed.ph))
        ctx.stroke(path,
                   with: .color(Color(red:0.10,green:bright,blue:0.28).opacity(0.72)),
                   lineWidth: thickness)
    }
}

// MARK: - Baloncuklar
private func drawBubbles(_ ctx: GraphicsContext, t: Double, w: CGFloat, h: CGFloat) {
    let bubbles: [(xf:Double, sz:Double, dur:Double, delay:Double)] = [
        (0.36, 5.0, 4.3, 0.0), (0.55, 4.0, 3.5, 1.7),
        (0.45, 6.0, 5.2, 3.0), (0.41, 3.0, 3.9, 4.2),
        (0.62, 4.5, 4.7, 0.9), (0.30, 3.5, 4.0, 2.5),
    ]
    for b in bubbles {
        let phase = t / b.dur + b.delay / b.dur
        let cycle = phase.truncatingRemainder(dividingBy: 1.0)
        guard cycle > 0 else { continue }
        let startY = h - h * 0.12
        let rise   = CGFloat(cycle * 70.0)
        let sway   = CGFloat(sin(t * 1.8 + b.xf * 5.0) * 4.0 + (cycle > 0.45 ? -3.0 : 4.0) * cycle)
        let by     = startY - rise
        let bx     = w * CGFloat(b.xf) + sway
        let r      = CGFloat(b.sz / 2.0)
        let opacity = max(0, 0.70 * (1.0 - CGFloat(cycle)))
        guard opacity > 0.02 else { continue }
        ctx.stroke(
            Path(ellipseIn: CGRect(x: bx-r, y: by-r, width: r*2, height: r*2)),
            with: .color(Color(red:0.49,green:0.83,blue:0.99).opacity(Double(opacity * 0.85))),
            lineWidth: 0.8
        )
        let sr = r * 0.45
        ctx.fill(
            Path(ellipseIn: CGRect(x: bx - sr*0.1, y: by - r*0.58, width: sr, height: sr)),
            with: .color(.white.opacity(Double(opacity * 0.60)))
        )
    }
}

// MARK: - Zemin
private func drawFloor(_ ctx: GraphicsContext, w: CGFloat, h: CGFloat) {
    var sand = Path()
    sand.move(to: CGPoint(x: 0, y: h - h*0.10))
    sand.addCurve(to: CGPoint(x: w, y: h - h*0.08),
                  control1: CGPoint(x: w*0.30, y: h - h*0.13),
                  control2: CGPoint(x: w*0.70, y: h - h*0.06))
    sand.addLine(to: CGPoint(x: w, y: h))
    sand.addLine(to: CGPoint(x: 0, y: h))
    sand.closeSubpath()
    ctx.fill(sand, with: .color(Color(red:0.52,green:0.40,blue:0.22).opacity(0.38)))
}

// MARK: - Akvaryum arka planı
struct AquariumBgView: View {
    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSince1970
            Canvas { ctx, size in
                let w = size.width; let h = size.height

                ctx.fill(Path(CGRect(origin:.zero, size:size)),
                    with: .linearGradient(
                        Gradient(stops:[
                            .init(color:Color(red:0.024,green:0.071,blue:0.165),location:0.0),
                            .init(color:Color(red:0.027,green:0.349,blue:0.522),location:0.4),
                            .init(color:Color(red:0.008,green:0.173,blue:0.314),location:0.75),
                            .init(color:Color(red:0.008,green:0.173,blue:0.314),location:1.0),
                        ]),
                        startPoint:CGPoint(x:w*0.35, y:0),
                        endPoint:  CGPoint(x:w*0.65, y:h)
                    )
                )



                drawFloor(ctx, w:w, h:h)
                drawSeaweed(ctx, t:t, w:w, h:h)

                let f1 = calcFishWander(t:t,
                    xFreqs:f1xFreqs, xAmps:f1xAmps,
                    yFreqs:f1yFreqs, yAmps:f1yAmps,
                    phase:0.0, w:Double(w), h:Double(h))
                drawFish(ctx, x:f1.x, y:f1.y, w:32, h:17, right:f1.right,
                         c1:.f1c1, c2:.f1c2, c3:.f1c3)

                let f2 = calcFishWander(t:t,
                    xFreqs:f2xFreqs, xAmps:f2xAmps,
                    yFreqs:f2yFreqs, yAmps:f2yAmps,
                    phase:2.4, w:Double(w), h:Double(h))
                ctx.opacity = 0.80
                drawFish(ctx, x:f2.x, y:f2.y, w:24, h:13, right:f2.right,
                         c1:.f2c1, c2:.f2c2, c3:.f2c3)
                ctx.opacity = 1.0

                drawBubbles(ctx, t:t, w:w, h:h)
            }
        }
    }
}

// MARK: - Kilit ekranı görünümü
struct SwimLockScreenView: View {
    let state: SwimTimerAttributes.ContentState

    private var accent: Color {
        if state.finishedType == 1 { return .swimTeal }
        if state.finishedType == 2 { return .swimOrange }
        guard state.isRunning else { return .white.opacity(0.55) }
        return state.isOnBreak ? .swimOrange : .swimTeal
    }
    private var icon: String {
        if state.finishedType == 1 { return "✅" }
        if state.finishedType == 2 { return "⏰" }
        if !state.isRunning { return "⏸" }
        return state.isOnBreak ? "☕" : "🏊"
    }
    private var modeLabel: String {
        if state.finishedType == 1 { return "Çalışma bitti" }
        if state.finishedType == 2 { return "Mola bitti" }
        if !state.isRunning { return "Duraklatıldı" }
        return state.isOnBreak ? "Mola" : "Çalışıyor"
    }
    private var subLabel: String {
        if state.finishedType == 1 { return "Mola başlıyor…" }
        if state.finishedType == 2 { return "Çalışmaya dön" }
        return "SWIM"
    }

    var body: some View {
        ZStack {
            AquariumBgView().frame(maxWidth:.infinity, maxHeight:.infinity)

            // Üst koyu gradyan — yazı okunabilsin
            VStack(spacing:0) {
                LinearGradient(
                    colors:[.black.opacity(0.62),.black.opacity(0.20),.clear],
                    startPoint:.top, endPoint:.bottom
                ).frame(height:70)
                Spacer(minLength:0)
            }

            // İçerik
            VStack(spacing:0) {
                HStack(alignment:.center) {
                    HStack(spacing:10) {
                        Text(icon).font(.system(size:36))
                        VStack(alignment:.leading, spacing:2) {
                            Text(modeLabel)
                                .font(.subheadline.weight(.bold)).foregroundColor(.white)
                            Text(subLabel)
                                .font(.caption2.weight(.bold)).foregroundColor(accent)
                        }
                    }
                    Spacer()
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
                    .font(.system(size:42, weight:.bold, design:.monospaced))
                    .foregroundColor(accent)
                    .multilineTextAlignment(.trailing)
                    .frame(minWidth: 120, alignment: .trailing)
                }
                .padding(.horizontal,18).padding(.top,16)

                if !state.isFreeMode {
                    GeometryReader { geo in
                        ZStack(alignment:.leading) {
                            RoundedRectangle(cornerRadius:3).fill(.white.opacity(0.18))
                            RoundedRectangle(cornerRadius:3).fill(accent)
                                .frame(width:geo.size.width * CGFloat(calcProgress(state)))
                        }.frame(height:4)
                    }
                    .frame(height:4)
                    .padding(.horizontal,18).padding(.top,8)
                }
                Spacer(minLength:0)
            }
        }
        .frame(maxWidth:.infinity, minHeight:140)
    }
}

// MARK: - Live Activity
struct SwimTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for:SwimTimerAttributes.self) { context in
            SwimLockScreenView(state:context.state)
                .activityBackgroundTint(Color(red:0.02,green:0.06,blue:0.16))
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
                    HStack(spacing:6) {
                        Text(icon).font(.title2)
                        VStack(alignment:.leading, spacing:1) {
                            Text(label).font(.caption.weight(.semibold)).foregroundColor(.white.opacity(0.80))
                            Text("SWIM").font(.caption2.weight(.bold)).foregroundColor(accent)
                        }
                    }.padding(.leading,6)
                }
                DynamicIslandExpandedRegion(.trailing) {
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
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundColor(accent).padding(.trailing,6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !state.isFreeMode {
                        GeometryReader { geo in
                            ZStack(alignment:.leading) {
                                Capsule().fill(.white.opacity(0.10))
                                Capsule().fill(accent)
                                    .frame(width: max(4, geo.size.width * CGFloat(calcProgress(state))))
                            }
                        }
                        .frame(height:4)
                        .padding(.horizontal,6).padding(.bottom,4)
                    }
                }
            } compactLeading: {
                Text(icon).font(.body)
            } compactTrailing: {
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
                .font(.caption2.weight(.bold).monospacedDigit()).foregroundColor(accent)
            } minimal: { Text(icon) }
        }
    }
}

@main
struct SwimTimerWidgetBundle: WidgetBundle {
    var body: some Widget { SwimTimerLiveActivity() }
}
