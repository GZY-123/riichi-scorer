import Foundation

enum GameMode: String, CaseIterable, Identifiable {
    case fourPlayer = "4p"
    case threePlayer = "3p"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fourPlayer: return "四麻"
        case .threePlayer: return "三麻"
        }
    }
}

struct TenpaiWait: Identifiable, Equatable {
    let tile: String
    let remaining: Int

    var id: String { tile }
}

struct TenpaiResult: Equatable {
    let waits: [TenpaiWait]
    let error: String?

    static let empty = TenpaiResult(waits: [], error: nil)
}

enum TenpaiCalculator {
    static func calcWaits(
        tiles: [String],
        mode: GameMode,
        engine: EngineBridge = .shared
    ) -> TenpaiResult {
        guard tiles.count == 13 else {
            return TenpaiResult(waits: [], error: "请先输入 13 张手牌（当前 \(tiles.count) 张）")
        }

        let cleanedTiles = tiles.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let normalizedTiles: [String]
        do {
            normalizedTiles = try cleanedTiles.map { try normalizeTileForCount($0, mode: mode) }
        } catch {
            return TenpaiResult(waits: [], error: error.localizedDescription)
        }

        let counts = countTiles(normalizedTiles)
        if let overLimit = counts.first(where: { $0.value > 4 }) {
            return TenpaiResult(waits: [], error: "\(overLimit.key) 已超过 4 枚")
        }

        var waits: [TenpaiWait] = []
        for candidate in tileTypes(for: mode) {
            let count = counts[candidate, default: 0]
            guard count < 4 else {
                continue
            }

            do {
                try engine.parseHand(tiles: cleanedTiles, winningTile: candidate, mode: mode)
                waits.append(TenpaiWait(tile: candidate, remaining: 4 - count))
            } catch {
                continue
            }
        }

        return TenpaiResult(waits: waits, error: nil)
    }

    static func sortTileCodes(_ tiles: [String]) -> [String] {
        tiles.sorted(by: compareTiles)
    }

    static func normalizeTileForCount(_ tile: String, mode: GameMode) throws -> String {
        let trimmed = tile.trimmingCharacters(in: .whitespacesAndNewlines)
        let characters = Array(trimmed)
        guard characters.count == 2,
              let rank = characters[0].wholeNumberValue else {
            throw TenpaiCalculatorError.invalidTile(tile)
        }

        let suit = String(characters[1])
        guard ["m", "p", "s", "z"].contains(suit) else {
            throw TenpaiCalculatorError.invalidTile(tile)
        }

        if suit == "z" {
            guard (1...7).contains(rank) else {
                throw TenpaiCalculatorError.invalidTile(tile)
            }
            return "\(rank)z"
        }

        let normalizedRank = rank == 0 ? 5 : rank
        guard (1...9).contains(normalizedRank) else {
            throw TenpaiCalculatorError.invalidTile(tile)
        }

        if mode == .threePlayer,
           suit == "m",
           (2...8).contains(normalizedRank) {
            throw TenpaiCalculatorError.invalidSanmaTile("\(normalizedRank)m")
        }

        return "\(normalizedRank)\(suit)"
    }

    private static func tileTypes(for mode: GameMode) -> [String] {
        var tiles: [String] = []
        for suit in ["m", "p", "s"] {
            for rank in 1...9 {
                if mode == .threePlayer, suit == "m", (2...8).contains(rank) {
                    continue
                }
                tiles.append("\(rank)\(suit)")
            }
        }
        for rank in 1...7 {
            tiles.append("\(rank)z")
        }
        return tiles
    }

    private static func countTiles(_ tiles: [String]) -> [String: Int] {
        tiles.reduce(into: [:]) { counts, tile in
            counts[tile, default: 0] += 1
        }
    }

    private static func compareTiles(_ left: String, _ right: String) -> Bool {
        let parsedLeft = parseSortTile(left)
        let parsedRight = parseSortTile(right)
        if parsedLeft.suitOrder != parsedRight.suitOrder {
            return parsedLeft.suitOrder < parsedRight.suitOrder
        }
        if parsedLeft.rank != parsedRight.rank {
            return parsedLeft.rank < parsedRight.rank
        }
        return left < right
    }

    private static func parseSortTile(_ tile: String) -> (suitOrder: Int, rank: Double) {
        let characters = Array(tile)
        guard characters.count == 2,
              let rawRank = characters[0].wholeNumberValue else {
            return (99, 99)
        }
        let suit = String(characters[1])
        let suitOrder = ["m": 0, "p": 1, "s": 2, "z": 3][suit] ?? 99
        let rank = rawRank == 0 ? 5.5 : Double(rawRank)
        return (suitOrder, rank)
    }
}

private enum TenpaiCalculatorError: LocalizedError {
    case invalidTile(String)
    case invalidSanmaTile(String)

    var errorDescription: String? {
        switch self {
        case .invalidTile(let tile):
            return "牌面包含无效牌：\(tile)"
        case .invalidSanmaTile(let tile):
            return "三麻不使用 \(tile)"
        }
    }
}
