import Capacitor
import ActivityKit
import Foundation

// MARK: - Paylaşılan veri modeli (App target)
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

// MARK: - Plugin
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {

    // Sadece ID saklanır — Activity<T> referansı Any? olarak tutulmaz
    private var currentActivityID: String? = nil

    // MARK: start
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+"); return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("[LiveActivity] areActivitiesEnabled: false — Ayarlardan açın")
            call.reject("Live Activities disabled by user"); return
        }

        let state = buildState(call, isRunning: true)
        print("[LiveActivity] start — timeLeft:\(state.timeLeft) isOnBreak:\(state.isOnBreak)")

        // Önceki aktiviteyi kapat
        if let id = currentActivityID,
           let existing = Activity<SwimTimerAttributes>.activities.first(where: { $0.id == id }) {
            Task {
                let content = ActivityContent(state: state, staleDate: nil)
                await existing.update(content)
            }
            call.resolve(["id": id])
            return
        }

        do {
            let content  = ActivityContent(state: state, staleDate: nil)
            let activity = try Activity<SwimTimerAttributes>.request(
                attributes: SwimTimerAttributes(),
                content: content
            )
            currentActivityID = activity.id
            print("[LiveActivity] başlatıldı — id:\(activity.id)")
            call.resolve(["id": activity.id])
        } catch {
            print("[LiveActivity] HATA: \(error)")
            call.reject("Live Activity başlatılamadı: \(error.localizedDescription)")
        }
    }

    // MARK: update
    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }

        let isRunning = call.getBool("isRunning") ?? true

        // Activity kaybolmuşsa (kullanıcı kapattı / iOS sonlandırdı):
        // çalışıyorsa yeniden oluştur, duraklatılmışsa sessizce geç
        let existing: Activity<SwimTimerAttributes>? = {
            guard let id = currentActivityID else { return nil }
            return Activity<SwimTimerAttributes>.activities.first(where: { $0.id == id })
        }()

        if existing == nil {
            if isRunning {
                currentActivityID = nil
                start(call)   // yeniden başlat
            } else {
                call.resolve()
            }
            return
        }

        let state = buildState(call, isRunning: isRunning)
        Task {
            let content = ActivityContent(state: state, staleDate: nil)
            await existing!.update(content)
            call.resolve()
        }
    }

    // MARK: end
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard let id = currentActivityID,
              let activity = Activity<SwimTimerAttributes>.activities.first(where: { $0.id == id }) else {
            currentActivityID = nil; call.resolve(); return
        }
        Task {
            await activity.end(dismissalPolicy: .immediate)
            self.currentActivityID = nil
            print("[LiveActivity] sonlandırıldı")
            call.resolve()
        }
    }

    // MARK: - Yardımcı
    @available(iOS 16.2, *)
    private func buildState(_ call: CAPPluginCall, isRunning: Bool) -> SwimTimerAttributes.ContentState {
        let timeLeft     = call.getInt("timeLeft")     ?? 0
        let totalSecs    = call.getInt("totalSecs")    ?? max(timeLeft, 1)
        let isOnBreak    = call.getBool("isOnBreak")   ?? false
        let isFreeMode   = call.getBool("isFreeMode")  ?? false
        let freeTime     = call.getInt("freeTime")     ?? 0
        let finishedType = call.getInt("finishedType") ?? 0
        let endDate: Date
        if isFreeMode && isRunning {
            // Serbest mod: oturum başlangıcını (şimdi - freeTime) tut
            // Widget bu geçmiş tarihe bakarak canlı yukarı sayar
            endDate = Date().addingTimeInterval(-TimeInterval(freeTime))
        } else if isRunning {
            endDate = Date().addingTimeInterval(TimeInterval(max(timeLeft, 1)))
        } else {
            endDate = Date().addingTimeInterval(1)
        }
        return SwimTimerAttributes.ContentState(
            timeLeft:     timeLeft,
            totalSecs:    totalSecs,
            isOnBreak:    isOnBreak,
            isFreeMode:   isFreeMode,
            freeTime:     freeTime,
            endDate:      endDate,
            isRunning:    isRunning,
            finishedType: finishedType
        )
    }
}
