import SwiftUI

@main
struct JantenApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    // 测试钩子：xcrun simctl launch ... -- -launchTab 1 可直达指定 Tab
    @State private var selection = UserDefaults.standard.integer(forKey: "launchTab")

    var body: some View {
        TabView(selection: $selection) {
            PlaceholderView(title: "算点", note: EngineBridge.shared.smokeTest())
                .tabItem { Label("算点", systemImage: "camera.viewfinder") }
                .tag(0)

            TenpaiView()
                .tabItem { Label("听牌", systemImage: "ear") }
                .tag(1)

            YakuReferenceView()
                .tabItem { Label("役种", systemImage: "list.star") }
                .tag(2)

            PlaceholderView(title: "记分簿", note: "开发中")
                .tabItem { Label("记分簿", systemImage: "square.grid.2x2") }
                .tag(3)
        }
        .tint(Color.felt)
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
