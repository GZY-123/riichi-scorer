import SwiftUI

@main
struct JantenApp: App {
    @AppStorage(AppPreferences.appearanceKey) private var appearance = AppAppearance.system.rawValue

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(AppAppearance(rawValue: appearance)?.colorScheme)
        }
    }
}

struct ContentView: View {
    // 测试钩子：xcrun simctl launch ... -- -launchTab 1 可直达指定 Tab
    @State private var selection = Self.initialSelection()

    var body: some View {
        TabView(selection: $selection) {
            ScoreCameraView()
                .tabItem { Label("算点", systemImage: "camera.viewfinder") }
                .tag(0)

            TenpaiView()
                .tabItem { Label("听牌", systemImage: "ear") }
                .tag(1)

            YakuReferenceView()
                .tabItem { Label("役种", systemImage: "list.star") }
                .tag(2)

            ScoreboardView()
                .tabItem { Label("记分簿", systemImage: "square.grid.2x2") }
                .tag(3)

            SettingsView()
                .tabItem { Label("设置", systemImage: "gearshape") }
                .tag(4)
        }
        .tint(Color.felt)
        .onChange(of: selection) { _, _ in
            Haptics.tap()
        }
    }

    private static func initialSelection() -> Int {
        if ProcessInfo.processInfo.arguments.contains("-scoreboardDemo") {
            return 3
        }
        return UserDefaults.standard.integer(forKey: "launchTab")
    }
}

struct PlaceholderView: View {
    let title: String
    let note: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TileImageView(code: "1m", size: 72)

                Text(title)
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                Text(note)
                    .font(.footnote)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle(title)
        }
    }
}
