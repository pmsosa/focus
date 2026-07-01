import Cocoa
import WebKit

private class KeyableWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private class FocusWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

private struct WinSize {
    let width: CGFloat
    let height: CGFloat

    static func named(_ name: String) -> WinSize {
        switch name {
        case "small":      return WinSize(width: 800,  height: 560)
        case "large":      return WinSize(width: 1300, height: 820)
        case "fullscreen":
            let sf = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
            return WinSize(width: sf.width, height: sf.height)
        default:           return WinSize(width: 1060, height: 700) // medium
        }
    }
}

class FocusWindow: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: FocusWebView!
    private var outsideClickMonitor: Any?
    private var escapeMonitor: Any?

    private static let sizeKey = "focus-window-size"

    override init() {
        super.init()
        buildWindow()
    }

    private func buildWindow() {
        let sizeName = UserDefaults.standard.string(forKey: FocusWindow.sizeKey) ?? "medium"
        let sz = WinSize.named(sizeName)

        window = KeyableWindow(
            contentRect: NSRect(x: 0, y: 0, width: sz.width, height: sz.height),
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.level = .floating
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.isReleasedWhenClosed = false
        window.animationBehavior = .none

        let visualEffect = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: sz.width, height: sz.height))
        visualEffect.material = .hudWindow
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .active
        visualEffect.wantsLayer = true
        visualEffect.layer?.cornerRadius = 16
        visualEffect.layer?.masksToBounds = true

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.userContentController.add(self, name: "focusBridge")

        webView = FocusWebView(frame: NSRect(x: 0, y: 0, width: sz.width, height: sz.height), configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.wantsLayer = true
        webView.layer?.cornerRadius = 16
        webView.layer?.masksToBounds = true
        webView.autoresizingMask = [.width, .height]

        visualEffect.addSubview(webView)
        window.contentView = visualEffect

        loadHTML()
    }

    // MARK: – WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "focusBridge",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        if type == "resize", let sizeName = body["size"] as? String {
            DispatchQueue.main.async { [weak self] in
                self?.applyWindowSize(sizeName)
            }
        }

        if type == "openInspector" {
            DispatchQueue.main.async { [weak self] in
                guard let wv = self?.webView else { return }
                if let inspector = wv.value(forKey: "_inspector") as? NSObject {
                    inspector.perform(NSSelectorFromString("show"))
                }
            }
        }
    }

    private func applyWindowSize(_ sizeName: String) {
        UserDefaults.standard.set(sizeName, forKey: FocusWindow.sizeKey)
        let sz = WinSize.named(sizeName)
        guard let screen = NSScreen.main else { return }
        let sf = screen.visibleFrame
        let origin = NSPoint(x: sf.midX - sz.width / 2, y: sf.midY - sz.height / 2)
        let newFrame = NSRect(origin: origin, size: NSSize(width: sz.width, height: sz.height))
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.2
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            window.animator().setFrame(newFrame, display: true)
        }
    }

    // MARK: – HTML

    private func loadHTML() {
        guard let resourcesURL = Bundle.module.resourceURL?.appendingPathComponent("Resources"),
              let url = Bundle.module.url(forResource: "Resources/index", withExtension: "html") else {
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: resourcesURL)
    }

    // MARK: – Show / Hide

    func show() {
        guard let screen = NSScreen.main else { return }
        let sf = screen.visibleFrame
        let wf = window.frame
        window.setFrameOrigin(NSPoint(
            x: sf.midX - wf.width / 2,
            y: sf.midY - wf.height / 2
        ))

        window.alphaValue = 0
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(webView)
        NSApp.activate(ignoringOtherApps: true)

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.18
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            self.window.animator().alphaValue = 1
        }

        outsideClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            self?.hide()
        }

        escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 {
                self?.hide()
                return nil
            }
            return event
        }
    }

    func hide() {
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.14
            ctx.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self.window.animator().alphaValue = 0
        }, completionHandler: {
            self.window.orderOut(nil)
        })

        if let m = outsideClickMonitor { NSEvent.removeMonitor(m); outsideClickMonitor = nil }
        if let m = escapeMonitor { NSEvent.removeMonitor(m); escapeMonitor = nil }
    }

    var isVisible: Bool { window.isVisible }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.loadHTML()
        }
    }
}
