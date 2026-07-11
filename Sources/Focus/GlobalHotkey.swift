import Carbon

class GlobalHotkey {
    typealias Callback = () -> Void

    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    // Static slot: Carbon's C callback can't capture self, so we use a static registry
    private static var handlers: [UInt32: Callback] = [:]
    private static var nextID: UInt32 = 1

    private let slotID: UInt32

    // Default binding: ⌥ Space. Persisted in UserDefaults so the hotkey is live
    // the moment the app launches, before the WebView (which owns the settings UI)
    // has loaded. The JS side re-pushes its stored binding on boot to reconcile.
    static let defaultKeyCode = UInt32(kVK_Space)
    static let defaultModifiers = UInt32(optionKey)
    static let defaultLabel = "⌥ Space"
    private static let keyCodeKey = "focus-hotkey-keycode"
    private static let modifiersKey = "focus-hotkey-modifiers"
    private static let labelKey = "focus-hotkey-label"

    /// The human-readable binding for display (menu/about), e.g. "⌥ Space".
    static var currentLabel: String {
        UserDefaults.standard.string(forKey: labelKey) ?? defaultLabel
    }

    init(callback: @escaping Callback) {
        slotID = GlobalHotkey.nextID
        GlobalHotkey.nextID += 1
        GlobalHotkey.handlers[slotID] = callback

        var eventSpec = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: OSType(kEventHotKeyPressed)
        )

        InstallEventHandler(
            GetApplicationEventTarget(),
            { (_, event, _) -> OSStatus in
                var hotkeyID = EventHotKeyID()
                GetEventParameter(
                    event,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &hotkeyID
                )
                GlobalHotkey.handlers[hotkeyID.id]?()
                return noErr
            },
            1,
            &eventSpec,
            nil,
            &handlerRef
        )

        let d = UserDefaults.standard
        let keyCode = d.object(forKey: GlobalHotkey.keyCodeKey) != nil
            ? UInt32(d.integer(forKey: GlobalHotkey.keyCodeKey)) : GlobalHotkey.defaultKeyCode
        let modifiers = d.object(forKey: GlobalHotkey.modifiersKey) != nil
            ? UInt32(d.integer(forKey: GlobalHotkey.modifiersKey)) : GlobalHotkey.defaultModifiers
        registerHotKey(keyCode: keyCode, modifiers: modifiers)
    }

    /// Rebind the global hotkey (called from the settings UI via the JS bridge)
    /// and persist it so the new binding survives a relaunch.
    func update(keyCode: UInt32, modifiers: UInt32, label: String) {
        let d = UserDefaults.standard
        d.set(Int(keyCode), forKey: GlobalHotkey.keyCodeKey)
        d.set(Int(modifiers), forKey: GlobalHotkey.modifiersKey)
        d.set(label, forKey: GlobalHotkey.labelKey)
        registerHotKey(keyCode: keyCode, modifiers: modifiers)
    }

    private func registerHotKey(keyCode: UInt32, modifiers: UInt32) {
        if let ref = hotKeyRef {
            UnregisterEventHotKey(ref)
            hotKeyRef = nil
        }
        let hotKeyID = EventHotKeyID(signature: OSType(0x666F6375), id: slotID)
        RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    deinit {
        if let ref = hotKeyRef { UnregisterEventHotKey(ref) }
        if let ref = handlerRef { RemoveEventHandler(ref) }
        GlobalHotkey.handlers.removeValue(forKey: slotID)
    }
}
