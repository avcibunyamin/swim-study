import Capacitor
import ActivityKit
import Foundation

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {

    private var currentActivity: Any? = nil  // Activity<SwimTimerAttributes> — Any for pre-16.1 compat

    // MARK: - start
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities disabled by user")
            return
        }

        let timeLeft   = call.getInt("timeLeft")   ?? 0
        let totalSecs  = call.getInt("totalSecs")  ?? max(timeLeft, 1)
        let isOnBreak  = call.getBool("isOnBreak")  ?? false
        let isFreeMode = call.getBool("isFreeMode") ?? false
        let freeTime   = call.getInt("freeTime")   ?? 0
        let endDate    = Date().addingTimeInterval(TimeInterval(timeLeft))

        let state = SwimTimerAttributes.ContentState(
            timeLeft:   timeLeft,
            totalSecs:  totalSecs,
            isOnBreak:  isOnBreak,
            isFreeMode: isFreeMode,
            freeTime:   freeTime,
            endDate:    endDate,
            isRunning:  true
        )

        do {
            let activity = try Activity<SwimTimerAttributes>.request(
                attributes: SwimTimerAttributes(),
                contentState: state,
                pushType: nil
            )
            currentActivity = activity
            call.resolve(["id": activity.id])
        } catch {
            call.reject("Live Activity başlatılamadı: \(error.localizedDescription)")
        }
    }

    // MARK: - update
    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else { call.resolve(); return }
        guard let activity = currentActivity as? Activity<SwimTimerAttributes> else {
            call.resolve(); return
        }

        let timeLeft   = call.getInt("timeLeft")   ?? 0
        let totalSecs  = call.getInt("totalSecs")  ?? max(timeLeft, 1)
        let isOnBreak  = call.getBool("isOnBreak")  ?? false
        let isFreeMode = call.getBool("isFreeMode") ?? false
        let freeTime   = call.getInt("freeTime")   ?? 0
        let endDate    = Date().addingTimeInterval(TimeInterval(timeLeft))

        let state = SwimTimerAttributes.ContentState(
            timeLeft:   timeLeft,
            totalSecs:  totalSecs,
            isOnBreak:  isOnBreak,
            isFreeMode: isFreeMode,
            freeTime:   freeTime,
            endDate:    endDate,
            isRunning:  true
        )

        Task {
            await activity.update(using: state)
            call.resolve()
        }
    }

    // MARK: - end
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else { call.resolve(); return }
        guard let activity = currentActivity as? Activity<SwimTimerAttributes> else {
            call.resolve(); return
        }
        Task {
            await activity.end(dismissalPolicy: .immediate)
            self.currentActivity = nil
            call.resolve()
        }
    }
}
