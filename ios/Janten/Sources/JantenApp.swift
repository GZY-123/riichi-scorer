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
    var body: some View {
        TabView {
            PlaceholderView(title: "算点", note: EngineBridge.shared.smokeTest())
                .tabItem { Label("算点", systemImage: "camera.viewfinder") }
            PlaceholderView(title: "听牌", note: "开发中")
                .tabItem { Label("听牌", systemImage: "ear") }
            PlaceholderView(title: "役种", note: "开发中")
                .tabItem { Label("役种", systemImage: "list.star") }
            PlaceholderView(title: "记分簿", note: "开发中")
                .tabItem { Label("记分簿", systemImage: "square.grid.2x2") }
        }
        .tint(Color(red: 0.06, green: 0.33, blue: 0.26))
    }
}

struct PlaceholderView: View {
    let title: String
    let note: String

    var body: some View {
        VStack(spacing: 12) {
            Image("tile_1m")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 72)
            Text(title).font(.largeTitle.bold())
            Text(note).font(.footnote).foregroundStyle(.secondary)
        }
    }
}
