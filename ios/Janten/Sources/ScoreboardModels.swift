import Foundation

enum GameLength: String, CaseIterable, Identifiable, Codable {
    case east
    case hanchan

    var id: String { rawValue }

    var title: String {
        switch self {
        case .east: return "东风"
        case .hanchan: return "半庄"
        }
    }
}

enum LocalGameStatus: String, Codable {
    case playing
    case ended
}

struct LocalGameEventLog: Codable, Identifiable, Equatable {
    let id: UUID
    let time: Date
    let roundLabel: String
    let text: String
    let deltas: [Int]

    init(id: UUID = UUID(), time: Date = Date(), roundLabel: String, text: String, deltas: [Int]) {
        self.id = id
        self.time = time
        self.roundLabel = roundLabel
        self.text = text
        self.deltas = deltas
    }
}

struct LocalGame: Codable, Identifiable, Equatable {
    let id: UUID
    var mode: GameMode
    var length: GameLength
    var players: [String]
    var engineState: String
    var history: [LocalGameEventLog]
    let createdAt: Date
    var status: LocalGameStatus
    var undoStateSnapshots: [String]

    var state: EngineGameState? {
        try? EngineGameState.decode(from: engineState)
    }

    var scoreSummary: String {
        guard let scores = state?.scores else {
            return "点数读取失败"
        }
        return scores.enumerated()
            .map { index, score in
                let name = players[safe: index] ?? "玩家\(index + 1)"
                return "\(name) \(score.formattedPoints)"
            }
            .joined(separator: " / ")
    }
}

struct EngineGameStateSnapshot {
    let json: String
    let state: EngineGameState
}

struct EngineGameState: Codable, Equatable {
    let mode: GameMode
    let playerCount: Int
    let length: GameLength
    let scores: [Int]
    let dealerIndex: Int
    let roundWind: String
    let handNumber: Int
    let honba: Int
    let riichiSticks: Int
    let riichiDeclared: [Bool]
    let status: LocalGameStatus
    let config: EngineGameConfig
    let lastResult: EngineGameEventResult?

    static func decode(from json: String) throws -> EngineGameState {
        guard let data = json.data(using: .utf8) else {
            throw EngineBridgeError.unexpectedReturn("GameState")
        }
        return try JSONDecoder().decode(EngineGameState.self, from: data)
    }

    var roundTitle: String {
        let wind: String
        switch roundWind {
        case "east": wind = "东"
        case "south": wind = "南"
        default: wind = roundWind
        }
        return "\(wind)\(handNumber + 1)局"
    }
}

struct EngineGameConfig: Codable, Equatable {
    let mode: GameMode
    let length: GameLength
    let startingPoints: Int
    let returnPoints: Int
    let uma: [Int]
    let tsumoLoss: Bool
    let agariYame: Bool
}

struct EngineGameEventResult: Codable, Equatable {
    let type: String
    let deltas: [Int]
}

enum ScoreboardEngineEvent {
    case riichi(player: Int)
    case win(winner: Int, loser: Int?, winType: ScoreWinType, han: Int?, fu: Int?, yakuman: Int?)
    case draw(tenpai: [Bool])

    var payload: [String: Any] {
        switch self {
        case .riichi(let player):
            return [
                "type": "riichi",
                "player": player
            ]
        case .win(let winner, let loser, let winType, let han, let fu, let yakuman):
            var payload: [String: Any] = [
                "type": "win",
                "winner": winner,
                "winType": winType.rawValue
            ]
            if let loser {
                payload["loser"] = loser
            }
            if let yakuman, yakuman > 0 {
                payload["yakuman"] = yakuman
            } else {
                if let han {
                    payload["han"] = han
                }
                if let fu {
                    payload["fu"] = fu
                }
            }
            return payload
        case .draw(let tenpai):
            return [
                "type": "draw",
                "tenpai": tenpai
            ]
        }
    }
}

struct EngineSettlementResult: Codable, Equatable {
    let players: [EnginePlayerSettlement]
    let deltas: [Double]
}

struct EnginePlayerSettlement: Codable, Identifiable, Equatable {
    let player: Int
    let rank: Int
    let score: Int
    let adjustedScore: Int
    let uma: Int
    let oka: Int
    let settlement: Double

    var id: Int { player }
}

@MainActor
final class GameStore: ObservableObject {
    @Published private(set) var games: [LocalGame] = []
    @Published var errorMessage: String?

    private let fileURL: URL

    init(fileManager: FileManager = .default) {
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = documentsURL.appendingPathComponent("games.json")
        load()
    }

    var ongoingGames: [LocalGame] {
        games
            .filter { $0.status == .playing && $0.state?.status == .playing }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var historyGames: [LocalGame] {
        games
            .filter { $0.status == .ended || $0.state?.status == .ended }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func game(id: UUID) -> LocalGame? {
        games.first { $0.id == id }
    }

    @discardableResult
    func createGame(mode: GameMode, length: GameLength, playerNames: [String]) throws -> UUID {
        let snapshot = try EngineBridge.shared.createGame(mode: mode, length: length)
        let game = LocalGame(
            id: UUID(),
            mode: mode,
            length: length,
            players: normalizedPlayers(from: playerNames, mode: mode),
            engineState: snapshot.json,
            history: [],
            createdAt: Date(),
            status: .playing,
            undoStateSnapshots: []
        )
        games.insert(game, at: 0)
        save()
        return game.id
    }

    @discardableResult
    func applyEvent(gameID: UUID, event: ScoreboardEngineEvent, text: String, roundLabel: String) throws -> EngineGameState {
        guard let index = games.firstIndex(where: { $0.id == gameID }) else {
            throw GameStoreError.gameNotFound
        }

        let previousJSON = games[index].engineState
        let snapshot = try EngineBridge.shared.applyEvent(stateJSON: previousJSON, event: event)
        var game = games[index]
        game.undoStateSnapshots.append(previousJSON)
        if game.undoStateSnapshots.count > 10 {
            game.undoStateSnapshots.removeFirst(game.undoStateSnapshots.count - 10)
        }
        game.engineState = snapshot.json
        game.history.append(
            LocalGameEventLog(
                roundLabel: roundLabel,
                text: text,
                deltas: snapshot.state.lastResult?.deltas ?? []
            )
        )
        if snapshot.state.status == .ended {
            game.status = .ended
        }
        games[index] = game
        save()
        return snapshot.state
    }

    func undo(gameID: UUID) throws {
        guard let index = games.firstIndex(where: { $0.id == gameID }) else {
            throw GameStoreError.gameNotFound
        }
        guard let previousJSON = games[index].undoStateSnapshots.popLast() else {
            throw GameStoreError.noUndoSnapshot
        }
        var game = games[index]
        game.engineState = previousJSON
        if !game.history.isEmpty {
            game.history.removeLast()
        }
        game.status = (game.state?.status == .ended) ? .ended : .playing
        games[index] = game
        save()
    }

    func markEnded(gameID: UUID) throws {
        guard let index = games.firstIndex(where: { $0.id == gameID }) else {
            throw GameStoreError.gameNotFound
        }
        games[index].status = .ended
        save()
    }

    @discardableResult
    func archiveAndStartNew(from gameID: UUID) throws -> UUID {
        guard let game = game(id: gameID) else {
            throw GameStoreError.gameNotFound
        }
        try markEnded(gameID: gameID)
        return try createGame(mode: game.mode, length: game.length, playerNames: game.players)
    }

    @discardableResult
    func createDemoGame() -> UUID? {
        do {
            let id = try createGame(
                mode: .fourPlayer,
                length: .east,
                playerNames: ["东家", "南家", "西家", "北家"]
            )
            guard let demoGame = game(id: id), let state = demoGame.state else {
                return id
            }
            _ = try applyEvent(
                gameID: id,
                event: .riichi(player: 1),
                text: "南家立直",
                roundLabel: state.roundTitle
            )
            let afterRiichi = self.game(id: id)?.state ?? state
            _ = try applyEvent(
                gameID: id,
                event: .win(winner: 0, loser: 1, winType: .ron, han: 2, fu: 30, yakuman: nil),
                text: "东家荣和南家 · 2番30符",
                roundLabel: afterRiichi.roundTitle
            )
            return id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            games = []
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            games = try decoder.decode([LocalGame].self, from: data)
        } catch {
            errorMessage = "记分簿读取失败：\(error.localizedDescription)"
            games = []
        }
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(games)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            errorMessage = "记分簿保存失败：\(error.localizedDescription)"
        }
    }

    private func normalizedPlayers(from names: [String], mode: GameMode) -> [String] {
        let defaults = ["东家", "南家", "西家", "北家"]
        return (0..<mode.playerCount).map { index in
            let name = names[safe: index]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return name.isEmpty ? defaults[index] : name
        }
    }
}

enum GameStoreError: LocalizedError {
    case gameNotFound
    case noUndoSnapshot

    var errorDescription: String? {
        switch self {
        case .gameNotFound:
            return "找不到这局对局"
        case .noUndoSnapshot:
            return "没有可撤销的操作"
        }
    }
}

extension GameMode {
    var playerCount: Int {
        switch self {
        case .fourPlayer: return 4
        case .threePlayer: return 3
        }
    }
}

extension Int {
    var formattedPoints: String {
        String(self)
    }
}

extension Double {
    var signedOneDecimal: String {
        let value = String(format: "%.1f", abs(self))
        return self >= 0 ? "+\(value)" : "-\(value)"
    }
}

extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
