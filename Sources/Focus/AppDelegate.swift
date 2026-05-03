import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var focusWindow: FocusWindow!
    private var hotkey: GlobalHotkey!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        focusWindow = FocusWindow()
        setupStatusBar()

        hotkey = GlobalHotkey { [weak self] in
            self?.toggleWindow()
        }
    }

    private func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "checkmark.square", accessibilityDescription: "Focus")
            button.image?.isTemplate = true
        }

        let menu = NSMenu()

        let openItem = NSMenuItem(title: "Open Focus", action: #selector(toggleWindow), keyEquivalent: "")
        openItem.target = self
        menu.addItem(openItem)

        menu.addItem(.separator())

        let aboutItem = NSMenuItem(title: "About Focus", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)

        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit Focus", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        quitItem.target = NSApp
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    @objc func toggleWindow() {
        if focusWindow.isVisible {
            focusWindow.hide()
        } else {
            focusWindow.show()
        }
    }

    @objc func showAbout() {
        focusWindow.hide()

        let alert = NSAlert()
        alert.messageText = "focus."
        alert.informativeText = """
            Your work, in sections.

            A lightweight task dashboard that lives quietly in your menu bar. \
            Press ⌥Space anywhere to open or close it.

            Tasks are saved automatically.
            """
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.icon = NSImage(systemSymbolName: "checkmark.square", accessibilityDescription: nil)

        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
        NSApp.setActivationPolicy(.accessory)
    }
}
