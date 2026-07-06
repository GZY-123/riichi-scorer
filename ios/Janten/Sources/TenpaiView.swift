import SwiftUI

struct TenpaiView: View {
    @State private var mode: GameMode = AppPreferences.defaultGameMode
    @State private var handTiles: [HandTile] = {
        // 测试钩子：-tenpaiPrefill "1m 2m 3m" 预填手牌
        let prefill = UserDefaults.standard.string(forKey: "tenpaiPrefill") ?? ""
        return prefill.split(separator: " ").map { HandTile(code: String($0)) }
    }()
    @State private var result: TenpaiResult?

    private var tileCodes: [String] {
        handTiles.map(\.code)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    inputCard

                    TileKeyboardView(
                        onTap: appendTile,
                        onDelete: deleteLastTile,
                        showsDelete: false
                    )
                    .jantenCard()

                    if let result {
                        TenpaiResultCard(result: result)
                            .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("听牌")
            .onAppear {
                recalculateIfReady()
            }
            .onChange(of: tileCodes) { _, _ in
                recalculateIfReady()
            }
            .onChange(of: mode) { _, _ in
                Haptics.tap()
                recalculateIfReady()
            }
        }
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("听牌计算")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Text("已输入 \(handTiles.count)/13 张")
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(handTiles.count == 13 ? Color.feltBright : Color.textSecondary)
            }

            Picker("模式", selection: $mode) {
                ForEach(GameMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            handStrip
        }
        .jantenCard()
    }

    // 手牌换行网格：固定 14 格（13 牌位 + 退格随行），退格始终跟在最后一张牌后面
    private var handStrip: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 8) {
            ForEach(handTiles) { tile in
                Button {
                    removeTile(tile)
                } label: {
                    TileImageView(code: tile.code, size: 42)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            if !handTiles.isEmpty {
                inlineDeleteKey
            }

            let placeholders = max(0, 13 - handTiles.count)
            ForEach(0..<placeholders, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.backgroundSecondary.opacity(0.45))
                    .aspectRatio(3.0 / 4.0, contentMode: .fit)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color.hairline, lineWidth: 0.8)
                    )
            }
        }
        .padding(.vertical, 4)
    }

    private var inlineDeleteKey: some View {
        Button {
            Haptics.tap()
            deleteLastTile()
        } label: {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.backgroundSecondary)
                .aspectRatio(3.0 / 4.0, contentMode: .fit)
                .overlay(
                    Image(systemName: "delete.left")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.accentRed)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Color.hairline, lineWidth: 0.8)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("退格")
    }

    private func appendTile(_ code: String) {
        guard handTiles.count < 13 else {
            return
        }
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            handTiles.append(HandTile(code: code))
        }
    }

    private func removeTile(_ tile: HandTile) {
        Haptics.tap()
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            handTiles.removeAll { $0.id == tile.id }
        }
    }

    private func deleteLastTile() {
        guard !handTiles.isEmpty else {
            return
        }
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            _ = handTiles.popLast()
        }
    }

    private func recalculateIfReady() {
        withAnimation(.easeInOut(duration: 0.2)) {
            if handTiles.count == 13 {
                result = TenpaiCalculator.calcWaits(tiles: tileCodes, mode: mode)
            } else {
                result = nil
            }
        }
    }
}

private struct HandTile: Identifiable, Equatable {
    let id = UUID()
    let code: String
}

private struct TenpaiResultCard: View {
    let result: TenpaiResult

    private let columns = [
        GridItem(.adaptive(minimum: 74), spacing: 14)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("听 \(result.waits.count) 张")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(result.waits.isEmpty ? Color.accentRed : Color.textPrimary)

                Spacer()
            }

            if let error = result.error {
                Text(error)
                    .font(.subheadline)
                    .foregroundStyle(Color.accentRed)
            }

            if !result.waits.isEmpty {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                    ForEach(result.waits) { wait in
                        VStack(spacing: 7) {
                            TileImageView(code: wait.tile, size: 40)
                            Text("剩 \(wait.remaining) 枚")
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Color.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.backgroundSecondary.opacity(0.45), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
        .jantenCard()
    }
}
