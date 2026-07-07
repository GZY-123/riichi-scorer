import SwiftUI
import UIKit

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
    @Environment(\.openURL) private var openURL
    @AppStorage(AppPreferences.appearanceKey) private var appearance = AppAppearance.system.rawValue
    @AppStorage(AppPreferences.defaultGameModeKey) private var defaultGameMode = GameMode.fourPlayer.rawValue
    @AppStorage(Haptics.enabledKey) private var hapticsEnabled = true
    @State private var showsContactDialog = false
    @State private var toastMessage: String?

    private let contactEmail = "m2zhenyuge@gmail.com"

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
            .confirmationDialog("联系作者", isPresented: $showsContactDialog, titleVisibility: .visible) {
                Button("复制邮箱") {
                    copyContactEmail()
                }

                Button("发送邮件") {
                    sendFeedbackEmail()
                }

                Button("取消", role: .cancel) {}
            }
            .overlay(alignment: .bottom) {
                if let toastMessage {
                    Text(toastMessage)
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.ivory)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(Color.inkText.opacity(0.92), in: Capsule())
                        .padding(.bottom, 22)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
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
            aboutRow(title: "规则引擎", value: "RiichiEngine")
            Divider().overlay(Color.hairline)
            aboutRow(title: "牌面素材", value: "FluffyStuff riichi-mahjong-tiles · CC0")
            Divider().overlay(Color.hairline)
            aboutRow(title: "GitHub", value: "github.com/GZY-123/riichi-scorer")
            Divider().overlay(Color.hairline)
            Button {
                Haptics.tap()
                showsContactDialog = true
            } label: {
                aboutRow(title: "联系作者", value: contactEmail)
            }
            .buttonStyle(.plain)
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

    private func copyContactEmail() {
        UIPasteboard.general.string = contactEmail
        Haptics.tap()
        showToast("邮箱已复制")
    }

    private func sendFeedbackEmail() {
        Haptics.tap()
        openURL(feedbackMailURL)
    }

    private var feedbackMailURL: URL {
        let subject = "算点Janten反馈".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "mailto:\(contactEmail)?subject=\(subject)")!
    }

    private func showToast(_ message: String) {
        withAnimation(.easeOut(duration: 0.18)) {
            toastMessage = message
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeIn(duration: 0.18)) {
                if toastMessage == message {
                    toastMessage = nil
                }
            }
        }
    }

    private var versionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
