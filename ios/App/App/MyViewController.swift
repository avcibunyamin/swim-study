import UIKit
import Capacitor
import WebKit

class MyViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private var isDarkStatusBar = false

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return isDarkStatusBar ? .darkContent : .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
    }

    override func capacitorDidLoad() {
        bridge?.webView?.configuration.userContentController.add(self, name: "updateStatusBarBg")
        bridge?.webView?.configuration.userContentController.add(self, name: "updateStatusBarStyle")
        // WebView arka planını beyaz yap — status bar alanı bu rengi gösterir
        bridge?.webView?.isOpaque = false
        bridge?.webView?.backgroundColor = .white
        bridge?.webView?.scrollView.backgroundColor = .white

        // Sayfa yüklendikten sonra body rengini oku ve uygula
        for delay in [0.5, 1.0, 2.0, 3.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.readAndApplyBodyColor()
            }
        }
    }

    private func readAndApplyBodyColor() {
        bridge?.webView?.evaluateJavaScript("document.body.style.backgroundColor || getComputedStyle(document.body).backgroundColor") { [weak self] result, _ in
            guard let self = self, let colorStr = result as? String, !colorStr.isEmpty else { return }

            var color: UIColor?
            if colorStr.hasPrefix("#") {
                color = UIColor(hex: colorStr)
            } else if colorStr.contains("rgb") {
                color = self.parseRGB(colorStr)
            }

            if let c = color {
                DispatchQueue.main.async {
                    self.view.backgroundColor = c
                    self.view.window?.backgroundColor = c
                }
            }
        }
    }

    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "updateStatusBarStyle", let style = message.body as? String {
            DispatchQueue.main.async { [weak self] in
                self?.isDarkStatusBar = (style == "dark")
                self?.setNeedsStatusBarAppearanceUpdate()
            }
            return
        }
        guard message.name == "updateStatusBarBg", let hex = message.body as? String else { return }
        DispatchQueue.main.async { [weak self] in
            let color = UIColor(hex: hex)
            self?.view.backgroundColor = color
            self?.view.window?.backgroundColor = color
        }
    }

    private func parseRGB(_ rgb: String) -> UIColor? {
        let cleaned = rgb.replacingOccurrences(of: "rgba?\\(", with: "", options: .regularExpression)
                        .replacingOccurrences(of: ")", with: "")
        let parts = cleaned.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 3,
              let r = Double(parts[0]),
              let g = Double(parts[1]),
              let b = Double(parts[2]) else { return nil }
        return UIColor(red: CGFloat(r/255), green: CGFloat(g/255), blue: CGFloat(b/255), alpha: 1.0)
    }
}

extension UIColor {
    convenience init(hex: String) {
        var cString = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cString.hasPrefix("#") { cString.removeFirst() }
        var rgb: UInt64 = 0
        Scanner(string: cString).scanHexInt64(&rgb)
        self.init(
            red:   CGFloat((rgb & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255.0,
            blue:  CGFloat(rgb & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}
