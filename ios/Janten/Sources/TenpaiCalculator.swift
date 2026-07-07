import Foundation

enum GameMode: String, CaseIterable, Identifiable, Codable {
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
    static func disabledCodes(for tiles: [String]) -> Set<String> {
        Set(keyboardTileTypes.filter { !canAppendTile($0, to: tiles) })
    }

    static func canAppendTile(_ code: String, to tiles: [String]) -> Bool {
        let cleanedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let normalizedCode = try? normalizeTileForCopyLimit(cleanedCode) else {
            return false
        }

        let cleanedTiles = cleanTiles(tiles)
        let normalizedTiles = cleanedTiles.compactMap { try? normalizeTileForCopyLimit($0) }
        let counts = countTiles(normalizedTiles)
        let redCounts = countTiles(cleanedTiles)

        if counts[normalizedCode, default: 0] >= 4 {
            return false
        }
        if redFiveCodes.contains(cleanedCode), redCounts[cleanedCode, default: 0] >= 1 {
            return false
        }
        return true
    }

    static func calcWaits(
        tiles: [String],
        mode: GameMode,
        engine: EngineBridge = .shared
    ) -> TenpaiResult {
        guard tiles.count == 13 else {
            return TenpaiResult(waits: [], error: "请先输入 13 张手牌（当前 \(tiles.count) 张）")
        }

        let cleanedTiles = cleanTiles(tiles)
        let normalizedTiles: [String]
        do {
            normalizedTiles = try cleanedTiles.map { try normalizeTileForCount($0, mode: mode) }
        } catch {
            return TenpaiResult(waits: [], error: error.localizedDescription)
        }

        if let limitError = tileLimitError(cleanedTiles: cleanedTiles, normalizedTiles: normalizedTiles) {
            return TenpaiResult(waits: [], error: limitError.localizedDescription)
        }

        let counts = countTiles(normalizedTiles)
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

    static func analyzeDraws(
        tiles12: [String],
        mode: GameMode,
        engine: EngineBridge = .shared
    ) -> [(draw: String, waits: [TenpaiWait])] {
        guard tiles12.count == 12 else {
            return []
        }

        let cleanedTiles = cleanTiles(tiles12)
        let normalizedTiles: [String]
        do {
            normalizedTiles = try cleanedTiles.map { try normalizeTileForCount($0, mode: mode) }
        } catch {
            return []
        }

        guard tileLimitError(cleanedTiles: cleanedTiles, normalizedTiles: normalizedTiles) == nil else {
            return []
        }

        let counts = countTiles(normalizedTiles)
        var analyses: [(draw: String, waits: [TenpaiWait])] = []
        for candidate in tileTypes(for: mode) {
            guard counts[candidate, default: 0] < 4 else {
                continue
            }

            let result = calcWaits(tiles: cleanedTiles + [candidate], mode: mode, engine: engine)
            guard !result.waits.isEmpty else {
                continue
            }
            analyses.append((draw: candidate, waits: result.waits))
        }

        return analyses.sorted { left, right in
            let leftRemaining = left.waits.reduce(0) { $0 + $1.remaining }
            let rightRemaining = right.waits.reduce(0) { $0 + $1.remaining }
            if leftRemaining != rightRemaining {
                return leftRemaining > rightRemaining
            }
            return compareTiles(left.draw, right.draw)
        }
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

    private static let redFiveCodes: Set<String> = ["0m", "0p", "0s"]

    private static let keyboardTileTypes: [String] = {
        var tiles: [String] = []
        for suit in ["m", "p", "s"] {
            for rank in 1...9 {
                tiles.append("\(rank)\(suit)")
            }
        }
        for rank in 1...7 {
            tiles.append("\(rank)z")
        }
        tiles.append(contentsOf: ["0m", "0p", "0s"])
        return tiles
    }()

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

    private static func cleanTiles(_ tiles: [String]) -> [String] {
        tiles.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    }

    private static func normalizeTileForCopyLimit(_ tile: String) throws -> String {
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
        return "\(normalizedRank)\(suit)"
    }

    private static func tileLimitError(
        cleanedTiles: [String],
        normalizedTiles: [String]
    ) -> TenpaiCalculatorError? {
        let redCounts = countTiles(cleanedTiles)
        for code in ["0m", "0p", "0s"] where redCounts[code, default: 0] > 1 {
            return .redFiveOverLimit(code)
        }

        let counts = countTiles(normalizedTiles)
        for code in tileTypes(for: .fourPlayer) where counts[code, default: 0] > 4 {
            return .tileOverLimit(code)
        }

        return nil
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
    case redFiveOverLimit(String)
    case tileOverLimit(String)

    var errorDescription: String? {
        switch self {
        case .invalidTile(let tile):
            return "牌面包含无效牌：\(tile)"
        case .invalidSanmaTile(let tile):
            return "三麻不使用 \(tile)"
        case .redFiveOverLimit(let tile):
            return "\(tile) 已超过 1 枚"
        case .tileOverLimit(let tile):
            return "\(tile) 已超过 4 枚"
        }
    }
}
