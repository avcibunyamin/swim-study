import ActivityKit
import Foundation

/// Live Activity için paylaşılan veri modeli.
/// Bu dosya hem App target'a hem SwimTimerWidget target'a eklenmelidir.
struct SwimTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var timeLeft: Int      // kalan saniye (pomodoro modu)
        var totalSecs: Int     // toplam saniye (ilerleme çubuğu için)
        var isOnBreak: Bool    // mola mı?
        var isFreeMode: Bool   // serbest mod mu?
        var freeTime: Int      // geçen saniye (serbest mod)
        var endDate: Date      // timer bitiş zamanı (iOS countdown için)
        var isRunning: Bool
    }
}
