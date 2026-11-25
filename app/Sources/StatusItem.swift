import AppKit

/// The sharing menu is rebuilt when it opens so it reflects the current host state.
/// The harness has its own status item.
@MainActor
final class StatusItem: NSObject, NSMenuDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let host: HostController
    private let windows: AppWindows

    init(host: HostController, windows: AppWindows) {
        self.host = host; self.windows = windows
        super.init()
        item.button?.image = Self.menuBarIcon()
        item.button?.toolTip = "Shellkite"
        let menu = NSMenu(); menu.delegate = self; item.menu = menu
    }

    private static func menuBarIcon() -> NSImage {
        let image = NSImage(size: NSSize(width: 20, height: 16), flipped: true) { _ in
            NSColor.black.setStroke()
            let screenBounds = NSRect(x: 1, y: 2, width: 18, height: 12)
            let screen = NSBezierPath(roundedRect: screenBounds, xRadius: 3, yRadius: 3)
            screen.lineWidth = 1.5
            screen.stroke()

            let chevrons = NSBezierPath()
            chevrons.lineWidth = 1.5
            chevrons.lineCapStyle = .round
            chevrons.lineJoinStyle = .round
            let chevronWidth: CGFloat = 2.75
            let spacing: CGFloat = 4
            let halfHeight: CGFloat = 2.5
            let firstX = screenBounds.midX - (chevronWidth + spacing) / 2
            let centerY = screenBounds.midY
            for x in [firstX, firstX + spacing] {
                chevrons.move(to: NSPoint(x: x, y: centerY - halfHeight))
                chevrons.line(to: NSPoint(x: x + chevronWidth, y: centerY))
                chevrons.line(to: NSPoint(x: x, y: centerY + halfHeight))
            }
            chevrons.stroke()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Shellkite"
        return image
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        handlers.removeAll()
        let sharing = host.isSharing
        let status = NSMenuItem(title: sharing ? "Sharing this Mac" : "Not sharing", action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())
        menu.addItem(action("Open Shellkite") { [windows] in windows.openHome() })
        if sharing {
            menu.addItem(.separator())
            menu.addItem(action("Stop sharing") { [host] in host.stopSharing() })
        }
        menu.addItem(.separator())
        menu.addItem(action("Quit Shellkite") { NSApp.terminate(nil) })
    }

    private var handlers: [ClosureTarget] = []
    private func action(_ title: String, _ run: @escaping @MainActor () -> Void) -> NSMenuItem {
        let t = ClosureTarget(run); handlers.append(t)
        let m = NSMenuItem(title: title, action: #selector(ClosureTarget.fire), keyEquivalent: "")
        m.target = t
        return m
    }
}

@MainActor
private final class ClosureTarget: NSObject {
    let run: @MainActor () -> Void
    init(_ run: @escaping @MainActor () -> Void) { self.run = run }
    @objc func fire() { run() }
}
