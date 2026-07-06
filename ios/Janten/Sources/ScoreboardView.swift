import SwiftUI

struct ScoreboardView: View {
    @StateObject private var store = GameStore()
    @State private var path: [ScoreboardRoute] = []
    @State private var showsNewGame = false
    @State private var didCreateDemo = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    ongoingSection
                    historySection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("记分簿")
            .sheet(isPresented: $showsNewGame) {
                NewGameSheet(store: store) { gameID in
                    path = [ScoreboardRoute(gameID: gameID, readOnly: false)]
                }
            }
            .navigationDestination(for: ScoreboardRoute.self) { route in
                ScoreboardGameView(store: store, gameID: route.gameID, readOnly: route.readOnly) { newGameID in
                    path = [ScoreboardRoute(gameID: newGameID, readOnly: false)]
                }
            }
            .alert("提示", isPresented: errorBinding) {
                Button("好", role: .cancel) {
                    Haptics.tap()
                    store.errorMessage = nil
                }
            } message: {
                Text(store.errorMessage ?? "")
            }
            .onAppear(perform: createDemoIfNeeded)
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("单机对局记点")
                        .font(.system(.title2, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.textPrimary)

                    Text("本地保存 · 引擎同源结算")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()

                Button {
                    Haptics.press()
                    showsNewGame = true
                } label: {
                    Label("新对局", systemImage: "plus")
                        .font(.system(.headline, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.ivory)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .background(Color.felt, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .jantenCard()
    }

    private var ongoingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScoreboardSectionTitle(title: "进行中")

            if store.ongoingGames.isEmpty {
                EmptyStateRow(text: "暂无进行中的对局")
                } else {
                    ForEach(store.ongoingGames) { game in
                        NavigationLink(value: ScoreboardRoute(gameID: game.id, readOnly: false)) {
                            GameListCard(game: game, isOngoing: true)
                        }
                        .buttonStyle(.plain)
                        .simultaneousGesture(TapGesture().onEnded {
                            Haptics.tap()
                        })
                    }
                }
            }
        }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScoreboardSectionTitle(title: "历史对局")

            if store.historyGames.isEmpty {
                EmptyStateRow(text: "终局后会出现在这里")
                } else {
                    ForEach(store.historyGames) { game in
                        NavigationLink(value: ScoreboardRoute(gameID: game.id, readOnly: true)) {
                            GameListCard(game: game, isOngoing: false)
                        }
                        .buttonStyle(.plain)
                        .simultaneousGesture(TapGesture().onEnded {
                            Haptics.tap()
                        })
                    }
                }
            }
        }

    private var errorBinding: Binding<Bool> {
        Binding {
            store.errorMessage != nil
        } set: { isPresented in
            if !isPresented {
                store.errorMessage = nil
            }
        }
    }

    private func createDemoIfNeeded() {
        guard !didCreateDemo,
              ProcessInfo.processInfo.arguments.contains("-scoreboardDemo") else {
            return
        }
        didCreateDemo = true
        if let gameID = store.createDemoGame() {
            path = [ScoreboardRoute(gameID: gameID, readOnly: false)]
        }
    }
}

private struct ScoreboardRoute: Hashable {
    let gameID: UUID
    let readOnly: Bool
}

private struct ScoreboardSectionTitle: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(.headline, design: .rounded).weight(.bold))
            .foregroundStyle(Color.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
    }
}

private struct EmptyStateRow: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .foregroundStyle(Color.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color.cardBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.hairline.opacity(0.7), lineWidth: 0.8)
            )
    }
}

private struct GameListCard: View {
    let game: LocalGame
    let isOngoing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(game.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textSecondary)

                Spacer()

                Text(isOngoing ? "进行中" : "已终局")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(isOngoing ? Color.ivory : Color.textSecondary)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(isOngoing ? Color.felt : Color.backgroundSecondary, in: Capsule())
            }

            HStack(spacing: 10) {
                Text("\(game.mode.title) · \(game.length.title)")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.textSecondary)
            }

            Text(game.scoreSummary)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Color.textSecondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .jantenCard()
    }
}

private struct NewGameSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: GameStore
    let onCreated: (UUID) -> Void

    @State private var mode = AppPreferences.defaultGameMode
    @State private var length: GameLength = .hanchan
    @State private var playerNames = ["东家", "南家", "西家", "北家"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("玩法")
                            .font(.system(.title3, design: .rounded).weight(.bold))
                            .foregroundStyle(Color.textPrimary)

                        Picker("模式", selection: $mode) {
                            ForEach(GameMode.allCases) { mode in
                                Text(mode.title).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: mode) { _, _ in
                            Haptics.tap()
                        }

                        Picker("场次", selection: $length) {
                            ForEach(GameLength.allCases) { length in
                                Text(length.title).tag(length)
                            }
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: length) { _, _ in
                            Haptics.tap()
                        }
                    }
                    .jantenCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("玩家")
                            .font(.system(.title3, design: .rounded).weight(.bold))
                            .foregroundStyle(Color.textPrimary)

                        ForEach(playerNames.indices, id: \.self) { index in
                            TextField(defaultPlayerNames[index], text: $playerNames[index])
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.system(.body, design: .rounded).weight(.semibold))
                                .padding(12)
                                .background(Color.backgroundSecondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Color.hairline, lineWidth: 0.8)
                                )
                        }
                    }
                    .jantenCard()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("新对局")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        Haptics.tap()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("创建") {
                        Haptics.press()
                        create()
                    }
                    .font(.headline)
                }
            }
        }
    }

    private var defaultPlayerNames: [String] {
        ["东家", "南家", "西家", "北家"]
    }

    private func create() {
        do {
            let gameID = try store.createGame(mode: mode, length: length, playerNames: playerNames)
            dismiss()
            onCreated(gameID)
        } catch {
            store.errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }
}

private struct ScoreboardGameView: View {
    @ObservedObject var store: GameStore
    let gameID: UUID
    let readOnly: Bool
    let onNewGame: (UUID) -> Void

    @State private var activeSheet: ScoreboardActionSheet?
    @State private var showsSettlement = false
    @State private var showsBustBanner = false

    private var game: LocalGame? {
        store.game(id: gameID)
    }

    private var state: EngineGameState? {
        game?.state
    }

    var body: some View {
        Group {
            if let game, let state {
                ScrollView {
                    VStack(spacing: 16) {
                        tableView(game: game, state: state)

                        if !readOnly && game.status == .playing && state.status == .playing {
                            actionPanel(game: game, state: state)
                        }

                        historyView(game: game)

                        if readOnly || game.status == .ended || state.status == .ended {
                            settlementButton
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(Color.backgroundPrimary.ignoresSafeArea())
                .navigationTitle(readOnly ? "对局详情" : "对局")
                .navigationBarTitleDisplayMode(.inline)
                .overlay(alignment: .top) {
                    if showsBustBanner {
                        BustBanner()
                            .padding(.top, 8)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .toolbar {
                    if !readOnly && game.status == .playing {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("终局结算") {
                        Haptics.press()
                        showsSettlement = true
                    }
                }
            }
                }
                .sheet(item: $activeSheet) { sheet in
                    switch sheet {
                    case .win:
                        WinEventSheet(game: game, state: state) { event, text in
                            apply(event: event, text: text, roundLabel: state.roundTitle)
                        }
                    case .riichi:
                        RiichiEventSheet(game: game, state: state) { event, text in
                            apply(event: event, text: text, roundLabel: state.roundTitle)
                        }
                    case .draw:
                        DrawEventSheet(game: game, state: state) { event, text in
                            apply(event: event, text: text, roundLabel: state.roundTitle)
                        }
                    }
                }
                .sheet(isPresented: $showsSettlement) {
                    SettlementView(store: store, gameID: game.id, readOnly: readOnly) { newGameID in
                        onNewGame(newGameID)
                    }
                }
            } else {
                MissingGameView()
            }
        }
    }

    private func tableView(game: LocalGame, state: EngineGameState) -> some View {
        VStack(spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(state.roundTitle) · \(state.honba)本场 · 供托\(state.riichiSticks)")
                        .font(.system(.title2, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.ivory)
                        .monospacedDigit()

                    Text("\(game.mode.title) · \(game.length.title)")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.ivory.opacity(0.72))
                }

                Spacer()

                if state.status == .ended || game.status == .ended {
                    Text("终局")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.inkText)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.amber, in: Capsule())
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                ForEach(0..<state.playerCount, id: \.self) { index in
                    ScorePlayerCard(
                        name: game.players[safe: index] ?? "玩家\(index + 1)",
                        score: state.scores[safe: index] ?? 0,
                        isDealer: state.dealerIndex == index,
                        isRiichi: state.riichiDeclared[safe: index] ?? false
                    )
                }
            }
        }
        .padding(16)
        .background(Color.feltDeep, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.feltBright.opacity(0.45), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 18, x: 0, y: 10)
    }

    private func actionPanel(game: LocalGame, state: EngineGameState) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("操作")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ScoreboardActionButton(title: "和牌", systemImage: "crown") {
                    activeSheet = .win
                }

                ScoreboardActionButton(title: "立直", systemImage: "flag") {
                    activeSheet = .riichi
                }

                ScoreboardActionButton(title: "流局", systemImage: "circle.dashed") {
                    activeSheet = .draw
                }

                ScoreboardActionButton(title: "撤销", systemImage: "arrow.uturn.backward", disabled: game.undoStateSnapshots.isEmpty) {
                    undo()
                }
            }
        }
        .jantenCard()
    }

    private func historyView(game: LocalGame) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("事件履历")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            if game.history.isEmpty {
                Text("还没有事件")
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(Array(game.history.reversed())) { entry in
                    EventLogRow(entry: entry, players: game.players)
                    if entry.id != game.history.first?.id {
                        Divider().overlay(Color.hairline)
                    }
                }
            }
        }
        .jantenCard()
    }

    private var settlementButton: some View {
        Button {
            Haptics.press()
            showsSettlement = true
        } label: {
            Label("查看终局结算", systemImage: "list.number")
                .font(.system(.headline, design: .rounded).weight(.bold))
                .foregroundStyle(Color.ivory)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Color.felt, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func apply(event: ScoreboardEngineEvent, text: String, roundLabel: String) {
        do {
            let newState = try store.applyEvent(gameID: gameID, event: event, text: text, roundLabel: roundLabel)
            if newState.scores.contains(where: { $0 < 0 }) {
                withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
                    showsBustBanner = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showsBustBanner = false
                    }
                }
            }
            if newState.status == .ended {
                showsSettlement = true
            }
        } catch {
            store.errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }

    private func undo() {
        do {
            try store.undo(gameID: gameID)
        } catch {
            store.errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }
}

private enum ScoreboardActionSheet: String, Identifiable {
    case win
    case riichi
    case draw

    var id: String { rawValue }
}

private struct ScorePlayerCard: View {
    let name: String
    let score: Int
    let isDealer: Bool
    let isRiichi: Bool

    @State private var flashColor: Color?

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 7) {
                Text(name)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 4)

                if isDealer {
                    Text("庄")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(Color.inkText)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.amber, in: Capsule())
                }

                if isRiichi {
                    Text("立")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(Color.ivory)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.accentRed, in: Capsule())
                }
            }

            Text(score.formattedPoints)
                .font(.system(size: 32, weight: .heavy, design: .rounded))
                .minimumScaleFactor(0.62)
                .lineLimit(1)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 106, alignment: .leading)
        .background((flashColor ?? Color.cardBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.hairline.opacity(0.75), lineWidth: 0.8)
        )
        .animation(.easeOut(duration: 0.18), value: flashColor != nil)
        .onChange(of: score) { oldValue, newValue in
            guard oldValue != newValue else {
                return
            }
            flashColor = newValue > oldValue ? Color.feltBright.opacity(0.36) : Color.accentRed.opacity(0.30)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                flashColor = nil
            }
        }
    }
}

private struct ScoreboardActionButton: View {
    let title: String
    let systemImage: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button {
            guard !disabled else {
                return
            }
            Haptics.press()
            action()
        } label: {
            Label(title, systemImage: systemImage)
                .font(.system(.headline, design: .rounded).weight(.bold))
                .foregroundStyle(disabled ? Color.textSecondary : Color.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.backgroundSecondary.opacity(disabled ? 0.45 : 1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.hairline, lineWidth: 0.8)
                )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

private struct EventLogRow: View {
    let entry: LocalGameEventLog
    let players: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(entry.roundLabel)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.ivory)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.felt, in: Capsule())

                Text(entry.text)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Text(entry.time.formatted(date: .omitted, time: .shortened))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Color.textSecondary)
            }

            if entry.deltas.contains(where: { $0 != 0 }) {
                HStack(spacing: 7) {
                    ForEach(entry.deltas.indices, id: \.self) { index in
                        if let delta = entry.deltas[safe: index], delta != 0 {
                            Text("\(players[safe: index] ?? "玩家\(index + 1)") \(signed(delta))")
                                .font(.caption.weight(.bold))
                                .monospacedDigit()
                                .foregroundStyle(delta > 0 ? Color.feltBright : Color.accentRed)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background((delta > 0 ? Color.feltBright : Color.accentRed).opacity(0.10), in: Capsule())
                        }
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
    }

    private func signed(_ value: Int) -> String {
        value > 0 ? "+\(value)" : "\(value)"
    }
}

private struct BustBanner: View {
    var body: some View {
        Label("击飞，已进入终局结算", systemImage: "exclamationmark.triangle.fill")
            .font(.system(.headline, design: .rounded).weight(.bold))
            .foregroundStyle(Color.ivory)
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .background(Color.accentRed, in: Capsule())
            .shadow(color: Color.black.opacity(0.24), radius: 12, x: 0, y: 6)
    }
}

private struct WinEventSheet: View {
    @Environment(\.dismiss) private var dismiss
    let game: LocalGame
    let state: EngineGameState
    let onSubmit: (ScoreboardEngineEvent, String) -> Void

    @State private var winner = 0
    @State private var loser = 1
    @State private var winType: ScoreWinType = .ron
    @State private var han = 2
    @State private var fu = 30
    @State private var yakuman = 0
    @State private var limitTitle: String?

    private let fuOptions = [20, 25, 30, 40, 50, 60, 70]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    playerCard
                    scoreCard
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("和牌")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        Haptics.tap()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("记录") {
                        Haptics.press()
                        submit()
                    }
                    .font(.headline)
                }
            }
            .onChange(of: winType) { _, _ in
                Haptics.tap()
            }
            .onAppear {
                loser = firstLoser(excluding: winner)
            }
            .onChange(of: winner) { _, newValue in
                if loser == newValue {
                    loser = firstLoser(excluding: newValue)
                }
            }
        }
    }

    private var playerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("和牌信息")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            Picker("和牌者", selection: $winner) {
                ForEach(0..<state.playerCount, id: \.self) { index in
                    Text(game.players[safe: index] ?? "玩家\(index + 1)").tag(index)
                }
            }
            .pickerStyle(.menu)

            Picker("方式", selection: $winType) {
                ForEach(ScoreWinType.allCases) { type in
                    Text(type.title).tag(type)
                }
            }
            .pickerStyle(.segmented)

            if winType == .ron {
                Picker("放铳者", selection: $loser) {
                    ForEach(0..<state.playerCount, id: \.self) { index in
                        if index != winner {
                            Text(game.players[safe: index] ?? "玩家\(index + 1)").tag(index)
                        }
                    }
                }
                .pickerStyle(.menu)
            }
        }
        .jantenCard()
    }

    private var scoreCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("番符")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(1...13, id: \.self) { value in
                    optionButton(title: "\(value)番", selected: yakuman == 0 && han == value) {
                        yakuman = 0
                        limitTitle = nil
                        han = value
                    }
                }
            }

            HStack(spacing: 8) {
                limitButton("满贯", han: 5, fu: 30)
                limitButton("跳满", han: 6, fu: 30)
                limitButton("倍满", han: 8, fu: 30)
            }

            HStack(spacing: 8) {
                limitButton("三倍满", han: 11, fu: 30)
                optionButton(title: "役满", selected: yakuman == 1) {
                    yakuman = 1
                    limitTitle = "役满"
                }
            }

            Picker("符", selection: $fu) {
                ForEach(fuOptions, id: \.self) { value in
                    Text("\(value)符").tag(value)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 118)
            .disabled(yakuman > 0)
            .opacity(yakuman > 0 ? 0.45 : 1)
        }
        .jantenCard()
    }

    private func optionButton(title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.bold))
                .monospacedDigit()
                .foregroundStyle(selected ? Color.ivory : Color.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(selected ? Color.felt : Color.backgroundSecondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(selected ? Color.feltBright : Color.hairline, lineWidth: 0.8)
                )
        }
        .buttonStyle(.plain)
    }

    private func limitButton(_ title: String, han: Int, fu: Int) -> some View {
        optionButton(title: title, selected: limitTitle == title) {
            self.han = han
            self.fu = fu
            yakuman = 0
            limitTitle = title
        }
    }

    private func submit() {
        let loserIndex = winType == .ron ? loser : nil
        let event = ScoreboardEngineEvent.win(
            winner: winner,
            loser: loserIndex,
            winType: winType,
            han: yakuman > 0 ? nil : han,
            fu: yakuman > 0 ? nil : fu,
            yakuman: yakuman > 0 ? yakuman : nil
        )
        let winnerName = game.players[safe: winner] ?? "玩家\(winner + 1)"
        let pointText = limitTitle ?? (yakuman > 0 ? "役满" : "\(han)番\(fu)符")
        let text: String
        if winType == .ron, let loserIndex {
            let loserName = game.players[safe: loserIndex] ?? "玩家\(loserIndex + 1)"
            text = "\(winnerName)荣和\(loserName) · \(pointText)"
        } else {
            text = "\(winnerName)自摸 · \(pointText)"
        }
        dismiss()
        onSubmit(event, text)
    }

    private func firstLoser(excluding winner: Int) -> Int {
        (0..<state.playerCount).first { $0 != winner } ?? 0
    }
}

private struct RiichiEventSheet: View {
    @Environment(\.dismiss) private var dismiss
    let game: LocalGame
    let state: EngineGameState
    let onSubmit: (ScoreboardEngineEvent, String) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(0..<state.playerCount, id: \.self) { index in
                    Button {
                        Haptics.press()
                        submit(player: index)
                    } label: {
                        HStack {
                            Text(game.players[safe: index] ?? "玩家\(index + 1)")
                                .font(.system(.body, design: .rounded).weight(.semibold))
                            Spacer()
                            if state.riichiDeclared[safe: index] == true {
                                Text("已立直")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Color.textSecondary)
                            }
                        }
                    }
                    .disabled(state.riichiDeclared[safe: index] == true)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.backgroundPrimary)
            .navigationTitle("立直")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        Haptics.tap()
                        dismiss()
                    }
                }
            }
        }
    }

    private func submit(player: Int) {
        let name = game.players[safe: player] ?? "玩家\(player + 1)"
        dismiss()
        onSubmit(.riichi(player: player), "\(name)立直")
    }
}

private struct DrawEventSheet: View {
    @Environment(\.dismiss) private var dismiss
    let game: LocalGame
    let state: EngineGameState
    let onSubmit: (ScoreboardEngineEvent, String) -> Void

    @State private var tenpai: [Bool]

    init(game: LocalGame, state: EngineGameState, onSubmit: @escaping (ScoreboardEngineEvent, String) -> Void) {
        self.game = game
        self.state = state
        self.onSubmit = onSubmit
        _tenpai = State(initialValue: Array(repeating: false, count: state.playerCount))
    }

    var body: some View {
        NavigationStack {
            List {
                Section("听牌家") {
                    ForEach(0..<state.playerCount, id: \.self) { index in
                        Toggle(isOn: binding(for: index)) {
                            Text(game.players[safe: index] ?? "玩家\(index + 1)")
                                .font(.system(.body, design: .rounded).weight(.semibold))
                        }
                        .tint(Color.feltBright)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.backgroundPrimary)
            .navigationTitle("流局")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        Haptics.tap()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("记录") {
                        Haptics.press()
                        submit()
                    }
                    .font(.headline)
                }
            }
        }
    }

    private func binding(for index: Int) -> Binding<Bool> {
        Binding {
            tenpai[safe: index] ?? false
        } set: { newValue in
            if tenpai.indices.contains(index) {
                tenpai[index] = newValue
                Haptics.tap()
            }
        }
    }

    private func submit() {
        let names = tenpai.indices
            .filter { tenpai[$0] }
            .map { game.players[safe: $0] ?? "玩家\($0 + 1)" }
        let text = names.isEmpty ? "流局 · 全员未听" : "流局 · \(names.joined(separator: "、"))听牌"
        dismiss()
        onSubmit(.draw(tenpai: tenpai), text)
    }
}

private struct SettlementView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: GameStore
    let gameID: UUID
    let readOnly: Bool
    let onNewGame: (UUID) -> Void

    @State private var settlement: EngineSettlementResult?
    @State private var errorMessage: String?

    private var game: LocalGame? {
        store.game(id: gameID)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let game, let settlement {
                        settlementRows(game: game, settlement: settlement)

                        if !readOnly {
                            Button {
                                Haptics.press()
                                archiveAndStartNew()
                            } label: {
                                Label("存档并开新局", systemImage: "plus.circle.fill")
                                    .font(.system(.headline, design: .rounded).weight(.bold))
                                    .foregroundStyle(Color.ivory)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .background(Color.felt, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    } else if let errorMessage {
                        Text(errorMessage)
                            .font(.system(.body, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.accentRed)
                            .jantenCard()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("终局结算")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") {
                        Haptics.tap()
                        dismiss()
                    }
                }
            }
            .onAppear(perform: calculate)
        }
    }

    private func settlementRows(game: LocalGame, settlement: EngineSettlementResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("精算")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            ForEach(settlement.players.sorted { $0.rank < $1.rank }) { item in
                HStack(spacing: 12) {
                    Text("\(item.rank)")
                        .font(.system(.headline, design: .rounded).weight(.heavy))
                        .foregroundStyle(Color.inkText)
                        .frame(width: 34, height: 34)
                        .background(rankColor(item.rank), in: Circle())

                    VStack(alignment: .leading, spacing: 4) {
                        Text(game.players[safe: item.player] ?? "玩家\(item.player + 1)")
                            .font(.system(.headline, design: .rounded).weight(.bold))
                            .foregroundStyle(Color.textPrimary)

                        Text("素点 \(item.score.formattedPoints)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Color.textSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text(item.settlement.signedOneDecimal)
                            .font(.system(.title3, design: .rounded).weight(.heavy))
                            .monospacedDigit()
                            .foregroundStyle(item.settlement >= 0 ? Color.feltBright : Color.accentRed)

                        Text("精算得点")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .padding(.vertical, 7)

                if item.id != settlement.players.sorted(by: { $0.rank < $1.rank }).last?.id {
                    Divider().overlay(Color.hairline)
                }
            }
        }
        .jantenCard()
    }

    private func calculate() {
        guard let game else {
            errorMessage = "找不到这局对局"
            Haptics.warning()
            return
        }
        do {
            settlement = try EngineBridge.shared.settleGame(
                stateJSON: game.engineState,
                mode: game.mode,
                returnScore: game.mode == .fourPlayer ? 30000 : 40000,
                uma: game.mode == .fourPlayer ? [20, 10, -10, -20] : [15, 0, -15]
            )
        } catch {
            errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }

    private func archiveAndStartNew() {
        do {
            let newGameID = try store.archiveAndStartNew(from: gameID)
            dismiss()
            onNewGame(newGameID)
        } catch {
            errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color.amber
        case 2: return Color(hexValue: 0xC7CED6)
        case 3: return Color(hexValue: 0xC38F64)
        default: return Color.backgroundSecondary
        }
    }
}

private struct MissingGameView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
            Text("对局不存在")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary.ignoresSafeArea())
    }
}

private extension Color {
    init(hexValue: UInt32) {
        self.init(
            .sRGB,
            red: Double((hexValue >> 16) & 0xFF) / 255.0,
            green: Double((hexValue >> 8) & 0xFF) / 255.0,
            blue: Double(hexValue & 0xFF) / 255.0,
            opacity: 1.0
        )
    }
}
