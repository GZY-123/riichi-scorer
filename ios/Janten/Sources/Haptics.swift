import UIKit

enum Haptics {
    static let enabledKey = "hapticsEnabled"

    static var isEnabled: Bool {
        if UserDefaults.standard.object(forKey: enabledKey) == nil {
            return true
        }
        return UserDefaults.standard.bool(forKey: enabledKey)
    }

    static func tap() {
        impact(style: .light)
    }

    static func press() {
        impact(style: .medium)
    }

    static func success() {
        notification(type: .success)
    }

    static func warning() {
        notification(type: .warning)
    }

    private static func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard isEnabled else {
            return
        }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    private static func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        guard isEnabled else {
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }
}
