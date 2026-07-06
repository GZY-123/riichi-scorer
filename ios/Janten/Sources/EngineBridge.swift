import Foundation
import JavaScriptCore

/// 通过 JavaScriptCore 运行打包后的 TS 记分引擎（engine.bundle.js），
/// 规则实现与小程序/云函数完全同源。
final class EngineBridge {
    static let shared = EngineBridge()

    private let context: JSContext
    private let engine: JSValue
    private let exceptionStore: EngineExceptionStore

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

    func smokeTest() -> String {
        guard let result = call("calcScore", [["han": 4, "fu": 30, "winType": "ron", "isDealer": false]]),
              let ron = result.objectForKeyedSubscript("ron")?.toNumber() else {
            return "引擎加载失败"
        }
        return "引擎就绪 · 4番30符荣和 = \(ron.intValue) 点"
    }

    private func invoke(_ function: String, _ arguments: [Any]) throws -> JSValue {
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
}

struct ParsedHandDivision: Equatable {
    let pattern: String
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
