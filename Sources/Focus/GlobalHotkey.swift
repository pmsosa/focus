import Carbon

class GlobalHotkey {
    typealias Callback = () -> Void

    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    // Static slot: Carbon's C callback can't capture self, so we use a static registry
    private static var handlers: [UInt32: Callback] = [:]
    private static var nextID: UInt32 = 1

    private let slotID: UInt32

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

        let hotKeyID = EventHotKeyID(signature: OSType(0x666F6375), id: slotID)
        RegisterEventHotKey(
            UInt32(kVK_Space),
            UInt32(optionKey),
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
