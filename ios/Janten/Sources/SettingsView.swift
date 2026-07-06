import SwiftUI

enum AppAppearance: Int, CaseIterable, Identifiable {
    case system = 0
    case light = 1
    case dark = 2

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .system: return "跟随系统"
        case .light: return "浅色"
        case .dark: return "深色"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

enum AppPreferences {
    static let appearanceKey = "appearance"
    static let defaultGameModeKey = "defaultGameMode"

    static var defaultGameMode: GameMode {
        let rawValue = UserDefaults.standard.string(forKey: defaultGameModeKey) ?? GameMode.fourPlayer.rawValue
        return GameMode(rawValue: rawValue) ?? .fourPlayer
    }
}

struct SettingsView: View {
    @AppStorage(AppPreferences.appearanceKey) private var appearance = AppAppearance.system.rawValue
    @AppStorage(AppPreferences.defaultGameModeKey) private var defaultGameMode = GameMode.fourPlayer.rawValue
    @AppStorage(Haptics.enabledKey) private var hapticsEnabled = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    appearanceCard
                    preferencesCard
                    aboutCard
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("设置")
        }
    }

    private var appearanceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("外观")

            Picker("外观", selection: $appearance) {
                ForEach(AppAppearance.allCases) { option in
                    Text(option.title).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: appearance) { _, _ in
                Haptics.tap()
            }
        }
        .jantenCard()
    }

    private var preferencesCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("偏好")

            VStack(alignment: .leading, spacing: 8) {
                Text("默认玩法")
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textSecondary)

                Picker("默认玩法", selection: $defaultGameMode) {
                    ForEach(GameMode.allCases) { mode in
                        Text(mode.title).tag(mode.rawValue)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: defaultGameMode) { _, _ in
                    Haptics.tap()
                }
            }

            Toggle(isOn: $hapticsEnabled) {
                Text("触感反馈")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
            }
            .tint(Color.feltBright)
            .onChange(of: hapticsEnabled) { _, _ in
                Haptics.tap()
            }
        }
        .jantenCard()
    }

    private var aboutCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("关于")

            aboutRow(title: "版本号", value: versionText)
            Divider().overlay(Color.hairline)
            aboutRow(title: "规则引擎", value: "与微信小程序同源")
            Divider().overlay(Color.hairline)
            aboutRow(title: "牌面素材", value: "FluffyStuff riichi-mahjong-tiles · CC0")
            Divider().overlay(Color.hairline)
            aboutRow(title: "GitHub", value: "github.com/GZY-123/riichi-scorer")
        }
        .jantenCard()
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(.title3, design: .rounded).weight(.bold))
            .foregroundStyle(Color.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func aboutRow(title: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.textSecondary)

            Spacer(minLength: 12)

            Text(value)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.trailing)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var versionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
