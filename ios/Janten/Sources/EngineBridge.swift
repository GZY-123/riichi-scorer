import Foundation
import JavaScriptCore

/// 通过 JavaScriptCore 运行打包后的 TS 记分引擎（engine.bundle.js），
/// 规则实现与小程序/云函数完全同源。
final class EngineBridge {
    static let shared = EngineBridge()

    private let context: JSContext
    private let engine: JSValue
    private let exceptionStore: EngineExceptionStore
    private let lock = NSLock()

    private init() {
        let exceptionStore = EngineExceptionStore()
        self.exceptionStore = exceptionStore

        context = JSContext()!
        context.exceptionHandler = { _, exception in
            exceptionStore.message = exception?.toString()
        }

        let url = Bundle.main.url(forResource: "engine.bundle", withExtension: "js")!
        let source = try! String(contentsOf: url, encoding: .utf8)
        exceptionStore.message = nil
        context.exception = nil
        context.evaluateScript(source)
        // init 中不可用依赖 self 的计算属性，直接读取本地异常状态
        let loadException = context.exception?.toString() ?? exceptionStore.message
        if let loadException, !loadException.isEmpty {
            fatalError("Failed to load RiichiEngine: \(loadException)")
        }

        guard let loadedEngine = context.objectForKeyedSubscript("RiichiEngine"),
              !loadedEngine.isUndefined,
              !loadedEngine.isNull else {
            fatalError("RiichiEngine global was not found in engine.bundle.js")
        }
        engine = loadedEngine
    }

    /// 调用引擎导出的任意函数，参数与返回值走 JSON 兼容类型。
    func call(_ function: String, _ arguments: [Any]) -> JSValue? {
        try? invoke(function, arguments)
    }

    @discardableResult
    func parseHand(tiles: [String], winningTile: String, mode: GameMode) throws -> [ParsedHandDivision] {
        let input: [String: Any] = [
            "tiles": tiles,
            "winningTile": winningTile,
            "mode": mode.rawValue
        ]
        let value = try invoke("parseHand", [input])
        guard let divisions = value.toArray() as? [[String: Any]] else {
            throw EngineBridgeError.unexpectedReturn("parseHand")
        }
        return divisions.map { division in
            ParsedHandDivision(pattern: division["pattern"] as? String ?? "unknown")
        }
    }

    func scoreHand(_ input: ScoreHandInput) throws -> ScoreCalculationResult {
        let parseInput: [String: Any] = [
            "mode": input.mode.rawValue,
            "tiles": input.tiles,
            "winningTile": input.winningTile,
            "melds": []
        ]
        let divisions = try invoke("parseHand", [parseInput])
        let context: [String: Any] = [
            "mode": input.mode.rawValue,
            "winType": input.winType.rawValue,
            "seatWind": input.seatWind.rawValue,
            "prevalentWind": input.prevalentWind.rawValue,
            "riichi": input.riichi,
            "doubleRiichi": input.doubleRiichi,
            "ippatsu": input.ippatsu,
            "doraIndicators": input.doraIndicators,
            "uraDoraIndicators": [],
            "redDora": true,
            "nukiDora": input.nukiDora
        ]

        let yakuValue = try invoke("detectYaku", [divisions, context])
        let yakuDictionary = try dictionary(from: yakuValue, function: "detectYaku")
        let yakuman = intValue(yakuDictionary["yakuman"])
        let hasYaku = boolValue(yakuDictionary["hasYaku"])
        if !hasYaku && yakuman <= 0 {
            throw ScoreCalculationError.noYaku
        }

        let fuValue = try invoke("calcFu", [divisions, context])
        let fuDictionary = try dictionary(from: fuValue, function: "calcFu")
        let fu = intValue(fuDictionary["fu"])
        let han = intValue(yakuDictionary["han"])

        let scoreInput: [String: Any] = [
            "han": han,
            "fu": fu,
            "yakuman": yakuman,
            "isDealer": input.isDealer,
            "winType": input.winType.rawValue,
            "mode": input.mode.rawValue,
            "honba": input.honba,
            "riichiSticks": 0,
            "kiriageMangan": false
        ]
        let scoreValue = try invoke("calcScore", [scoreInput])
        let scoreDictionary = try dictionary(from: scoreValue, function: "calcScore")

        return ScoreCalculationResult(
            tiles: input.tiles,
            winningTile: input.winningTile,
            winningTileIndex: input.winningTileIndex,
            mode: input.mode,
            winType: input.winType,
            isDealer: input.isDealer,
            han: intValue(scoreDictionary["han"]),
            fu: intValue(scoreDictionary["fu"]),
            yakuman: intValue(scoreDictionary["yakuman"]),
            limit: stringValue(scoreDictionary["limit"]) ?? "none",
            yaku: parseYaku(yakuDictionary["yaku"]),
            ron: intValueOrNil(scoreDictionary["ron"]),
            tsumo: parseTsumo(scoreDictionary["tsumo"]),
            total: intValue(scoreDictionary["total"])
        )
    }

    func smokeTest() -> String {
        guard let result = call("calcScore", [["han": 4, "fu": 30, "winType": "ron", "isDealer": false]]),
              let ron = result.objectForKeyedSubscript("ron")?.toNumber() else {
            return "引擎加载失败"
        }
        return "引擎就绪 · 4番30符荣和 = \(ron.intValue) 点"
    }

    func createGame(mode: GameMode, length: GameLength) throws -> EngineGameStateSnapshot {
        let value = try invoke("createGame", [[
            "mode": mode.rawValue,
            "length": length.rawValue
        ]])
        return try snapshot(from: value, function: "createGame")
    }

    func applyEvent(stateJSON: String, event: ScoreboardEngineEvent) throws -> EngineGameStateSnapshot {
        let stateObject = try jsonObject(from: stateJSON, function: "applyEvent")
        let value = try invoke("applyEvent", [stateObject, event.payload])
        return try snapshot(from: value, function: "applyEvent")
    }

    func settleGame(stateJSON: String, mode: GameMode, returnScore: Int, uma: [Int]) throws -> EngineSettlementResult {
        let stateObject = try jsonObject(from: stateJSON, function: "settleGame")
        let value = try invoke("settleGame", [
            stateObject,
            [
                "mode": mode.rawValue,
                "returnPoints": returnScore,
                "uma": uma
            ] as [String: Any]
        ])
        return try decode(EngineSettlementResult.self, from: value, function: "settleGame")
    }

    private func invoke(_ function: String, _ arguments: [Any]) throws -> JSValue {
        lock.lock()
        defer {
            lock.unlock()
        }

        exceptionStore.message = nil
        context.exception = nil

        guard let target = engine.objectForKeyedSubscript(function),
              !target.isUndefined,
              !target.isNull else {
            throw EngineBridgeError.missingFunction(function)
        }

        let result = target.call(withArguments: arguments)
        if let exception = currentExceptionMessage {
            exceptionStore.message = nil
            context.exception = nil
            throw EngineBridgeError.javascript(exception)
        }

        guard let result else {
            throw EngineBridgeError.unexpectedReturn(function)
        }
        return result
    }

    private var currentExceptionMessage: String? {
        if let message = context.exception?.toString(), !message.isEmpty {
            return message
        }
        return exceptionStore.message
    }

    private func dictionary(from value: JSValue, function: String) throws -> [String: Any] {
        guard let raw = value.toDictionary() else {
            throw EngineBridgeError.unexpectedReturn(function)
        }
        return raw.reduce(into: [:]) { result, pair in
            guard let key = pair.key as? String else {
                return
            }
            result[key] = pair.value
        }
    }

    private func snapshot(from value: JSValue, function: String) throws -> EngineGameStateSnapshot {
        let object = try jsonCompatibleObject(from: value, function: function)
        let data = try jsonData(from: object, function: function)
        let state = try JSONDecoder().decode(EngineGameState.self, from: data)
        guard let json = String(data: data, encoding: .utf8) else {
            throw EngineBridgeError.unexpectedReturn(function)
        }
        return EngineGameStateSnapshot(json: json, state: state)
    }

    private func decode<T: Decodable>(_ type: T.Type, from value: JSValue, function: String) throws -> T {
        let object = try jsonCompatibleObject(from: value, function: function)
        let data = try jsonData(from: object, function: function)
        return try JSONDecoder().decode(type, from: data)
    }

    private func jsonObject(from json: String, function: String) throws -> Any {
        guard let data = json.data(using: .utf8) else {
            throw EngineBridgeError.unexpectedReturn(function)
        }
        return try JSONSerialization.jsonObject(with: data)
    }

    private func jsonCompatibleObject(from value: JSValue, function: String) throws -> Any {
        let raw = value.toObject() as Any
        let object = jsonCompatible(raw)
        guard JSONSerialization.isValidJSONObject(object) else {
            throw EngineBridgeError.unexpectedReturn(function)
        }
        return object
    }

    private func jsonData(from object: Any, function: String) throws -> Data {
        do {
            return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        } catch {
            throw EngineBridgeError.unexpectedReturn(function)
        }
    }

    private func jsonCompatible(_ value: Any) -> Any {
        if value is NSNull {
            return NSNull()
        }
        if let dictionary = value as? [AnyHashable: Any] {
            return dictionary.reduce(into: [String: Any]()) { result, pair in
                guard let key = pair.key as? String else {
                    return
                }
                result[key] = jsonCompatible(pair.value)
            }
        }
        if let dictionary = value as? [String: Any] {
            return dictionary.reduce(into: [String: Any]()) { result, pair in
                result[pair.key] = jsonCompatible(pair.value)
            }
        }
        if let array = value as? [Any] {
            return array.map(jsonCompatible)
        }
        if let number = value as? NSNumber {
            return number
        }
        if let string = value as? String {
            return string
        }
        if let bool = value as? Bool {
            return bool
        }
        return value
    }

    private func parseYaku(_ value: Any?) -> [ScoreYaku] {
        let items: [[String: Any]]
        if let direct = value as? [[String: Any]] {
            items = direct
        } else if let raw = value as? [[AnyHashable: Any]] {
            items = raw.map { dictionary in
                dictionary.reduce(into: [:]) { result, pair in
                    guard let key = pair.key as? String else {
                        return
                    }
                    result[key] = pair.value
                }
            }
        } else {
            items = []
        }

        return items.map { item in
            ScoreYaku(
                id: stringValue(item["id"]) ?? UUID().uuidString,
                name: stringValue(item["name"]) ?? "役种",
                han: intValueOrNil(item["han"]),
                yakuman: intValueOrNil(item["yakuman"]),
                isYakuman: boolValue(item["isYakuman"]),
                isDora: boolValue(item["isDora"])
            )
        }
    }

    private func parseTsumo(_ value: Any?) -> ScoreTsumoPayments? {
        let dictionary: [String: Any]?
        if let direct = value as? [String: Any] {
            dictionary = direct
        } else if let raw = value as? [AnyHashable: Any] {
            dictionary = raw.reduce(into: [:]) { result, pair in
                guard let key = pair.key as? String else {
                    return
                }
                result[key] = pair.value
            }
        } else {
            dictionary = nil
        }
        guard let dictionary else {
            return nil
        }
        return ScoreTsumoPayments(
            dealer: intValueOrNil(dictionary["dealer"]),
            nonDealer: intValueOrNil(dictionary["nonDealer"]),
            all: intValueOrNil(dictionary["all"]),
            total: intValue(dictionary["total"])
        )
    }

    private func intValue(_ value: Any?) -> Int {
        intValueOrNil(value) ?? 0
    }

    private func intValueOrNil(_ value: Any?) -> Int? {
        if let number = value as? NSNumber {
            return number.intValue
        }
        if let int = value as? Int {
            return int
        }
        if let double = value as? Double {
            return Int(double)
        }
        if let string = value as? String {
            return Int(string)
        }
        return nil
    }

    private func boolValue(_ value: Any?) -> Bool {
        if let bool = value as? Bool {
            return bool
        }
        if let number = value as? NSNumber {
            return number.boolValue
        }
        return false
    }

    private func stringValue(_ value: Any?) -> String? {
        if let string = value as? String {
            return string
        }
        if let number = value as? NSNumber {
            return number.stringValue
        }
        return nil
    }
}

struct ParsedHandDivision: Equatable {
    let pattern: String
}

struct ScoreHandInput {
    let tiles: [String]
    let winningTile: String
    let winningTileIndex: Int
    let mode: GameMode
    let winType: ScoreWinType
    let isDealer: Bool
    let seatWind: SeatWind
    let prevalentWind: SeatWind
    let riichi: Bool
    let doubleRiichi: Bool
    let ippatsu: Bool
    let doraIndicators: [String]
    let honba: Int
    let nukiDora: Int
}

enum ScoreWinType: String, CaseIterable, Identifiable {
    case ron
    case tsumo

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ron: return "荣和"
        case .tsumo: return "自摸"
        }
    }
}

enum SeatWind: String, CaseIterable, Identifiable {
    case east
    case south
    case west
    case north

    var id: String { rawValue }

    var title: String {
        switch self {
        case .east: return "东"
        case .south: return "南"
        case .west: return "西"
        case .north: return "北"
        }
    }
}

struct ScoreYaku: Identifiable, Equatable {
    let id: String
    let name: String
    let han: Int?
    let yakuman: Int?
    let isYakuman: Bool
    let isDora: Bool
}

struct ScoreTsumoPayments: Equatable {
    let dealer: Int?
    let nonDealer: Int?
    let all: Int?
    let total: Int
}

struct ScoreCalculationResult: Identifiable, Equatable {
    let id = UUID()
    let tiles: [String]
    let winningTile: String
    let winningTileIndex: Int
    let mode: GameMode
    let winType: ScoreWinType
    let isDealer: Bool
    let han: Int
    let fu: Int
    let yakuman: Int
    let limit: String
    let yaku: [ScoreYaku]
    let ron: Int?
    let tsumo: ScoreTsumoPayments?
    let total: Int
}

enum ScoreCalculationError: LocalizedError {
    case noYaku

    var errorDescription: String? {
        switch self {
        case .noYaku:
            return "没有役，不能和牌"
        }
    }
}

enum EngineBridgeError: LocalizedError {
    case missingFunction(String)
    case javascript(String)
    case unexpectedReturn(String)

    var errorDescription: String? {
        switch self {
        case .missingFunction(let function):
            return "引擎函数不存在：\(function)"
        case .javascript(let message):
            return message
        case .unexpectedReturn(let function):
            return "引擎函数返回格式异常：\(function)"
        }
    }
}

private final class EngineExceptionStore {
    var message: String?
}
