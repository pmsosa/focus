import Cocoa
import WebKit
import UniformTypeIdentifiers

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

class FocusWindow: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    private var window: NSWindow!
    private var webView: FocusWebView!
    private var outsideClickMonitor: Any?
    private var escapeMonitor: Any?
    private var isPresentingPanel = false

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
        webView.uiDelegate = self
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

        // WKWebView can't trigger a browser download, so the page hands us the
        // backup bytes and we write them via a save panel.
        if type == "export", let data = body["data"] as? String {
            let name = body["filename"] as? String ?? "focus-backup.json"
            DispatchQueue.main.async { [weak self] in
                self?.saveExport(data: data, suggestedName: name)
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

    // MARK: – Panels (export / import / JS dialogs)

    // The window floats above everything (level .floating); a file panel at the
    // normal level would render *behind* it. Drop the level while a panel is up,
    // and flag it so the outside-click / escape monitors don't dismiss us.
    private func beginPanel() {
        isPresentingPanel = true
        window.level = .normal
    }

    private func endPanel() {
        window.level = .floating
        isPresentingPanel = false
    }

    private func alert(fromJSMessage message: String) -> NSAlert {
        let alert = NSAlert()
        let parts = message.components(separatedBy: "\n\n")
        alert.messageText = parts.first ?? message
        if parts.count > 1 {
            alert.informativeText = parts.dropFirst().joined(separator: "\n\n")
        }
        return alert
    }

    private func saveExport(data: String, suggestedName: String) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedName
        panel.allowedContentTypes = [.json]
        beginPanel()
        let resp = panel.runModal()
        endPanel()
        guard resp == .OK, let url = panel.url else { return }
        do {
            try data.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            NSLog("Focus: export write failed: \(error.localizedDescription)")
        }
    }

    // File picker for <input type=file> (backup import). WKWebView silently
    // ignores file-input clicks unless the UI delegate supplies a panel.
    func webView(_ webView: WKWebView,
                 runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        beginPanel()
        let resp = panel.runModal()
        endPanel()
        completionHandler(resp == .OK ? panel.urls : nil)
    }

    // JS alert()/confirm() are no-ops in WKWebView without these handlers.
    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = alert(fromJSMessage: message)
        alert.addButton(withTitle: "OK")
        beginPanel()
        alert.runModal()
        endPanel()
        completionHandler()
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = alert(fromJSMessage: message)
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        beginPanel()
        let resp = alert.runModal()
        endPanel()
        completionHandler(resp == .alertFirstButtonReturn)
    }

    // MARK: – HTML

    private func loadHTML() {
        guard let url = Bundle.module.url(forResource: "Resources/index", withExtension: "html") else {
            NSLog("Focus: could not locate Resources/index.html in bundle \(Bundle.module.bundlePath)")
            return
        }
        // Grant read access to the *resolved* directory that actually contains
        // index.html and its sibling js/css. Deriving it from `url` (rather than
        // rebuilding it from Bundle.module.resourceURL) guarantees both paths
        // share one canonical base — otherwise the WebContent helper's sandbox
        // extension covers a slightly different path and file loads fail (-3001).
        let readAccessURL = url.deletingLastPathComponent()
        webView.loadFileURL(url, allowingReadAccessTo: readAccessURL)
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
            if self?.isPresentingPanel == true { return }
            self?.hide()
        }

        escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if self?.isPresentingPanel == true { return event }
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
        NSLog("Focus: navigation failed: \(error.localizedDescription)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.loadHTML()
        }
    }

    // Fires when the load never even started (e.g. file could not be opened).
    // Without this, such failures are silent and the window renders blank.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("Focus: provisional navigation failed: \(error.localizedDescription)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.loadHTML()
        }
    }
}
