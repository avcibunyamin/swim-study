import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var colorTimer: Timer?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // WebView yüklendikten sonra body background rengini oku ve window'a uygula
        colorTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self,
                  let rootVC = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = rootVC.webView else { return }

            webView.evaluateJavaScript("getComputedStyle(document.body).backgroundColor") { result, error in
                guard let rgbString = result as? String, rgbString.contains("rgb") else { return }
                if let color = self.parseRGBColor(rgbString) {
                    DispatchQueue.main.async {
                        self.window?.backgroundColor = color
                        rootVC.view.backgroundColor = color
                    }
                }
            }
        }
        return true
    }

    // "rgb(240, 249, 255)" veya "rgba(0, 0, 0, 1)" formatını UIColor'a çevir
    private func parseRGBColor(_ rgb: String) -> UIColor? {
        let cleaned = rgb.replacingOccurrences(of: "rgba?\\(", with: "", options: .regularExpression)
                        .replacingOccurrences(of: ")", with: "")
        let parts = cleaned.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 3,
              let r = Double(parts[0]),
              let g = Double(parts[1]),
              let b = Double(parts[2]) else { return nil }
        return UIColor(red: CGFloat(r/255), green: CGFloat(g/255), blue: CGFloat(b/255), alpha: 1.0)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
