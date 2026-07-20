import Foundation

extension Bundle {
    /// The SwiftPM resource bundle (`Focus_Focus.bundle`), resolved robustly for
    /// the packaged .app.
    ///
    /// SwiftPM's generated `Bundle.module` looks for the resource bundle next to
    /// the .app *root* (`Focus.app/Focus_Focus.bundle`) and otherwise falls back
    /// to a build-machine absolute path (`.build/…`). In the packaged app the
    /// bundle actually lives in `Contents/Resources`, so the first path never
    /// matches; the `.build/…` fallback exists only on the developer's Mac.
    /// On TestFlight / any other machine — and under the App Sandbox — both
    /// candidates fail and `Bundle.module` calls `fatalError`, crashing the app
    /// on launch. Prefer the real `Contents/Resources` location and only fall
    /// back to `Bundle.module` for `swift run` dev builds.
    static let focusResources: Bundle = {
        if let url = Bundle.main.resourceURL?.appendingPathComponent("Focus_Focus.bundle"),
           let bundle = Bundle(url: url) {
            return bundle
        }
        return .module
    }()
}
