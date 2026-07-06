import Foundation
import JavaScriptCore

/// 通过 JavaScriptCore 运行打包后的 TS 记分引擎（engine.bundle.js），
/// 规则实现与小程序/云函数完全同源。
final class EngineBridge {
    static let shared = EngineBridge()

    private let context: JSContext
    private let engine: JSValue

    private init() {
        context = JSContext()!
        context.exceptionHandler = { _, exception in
            NSLog("[EngineBridge] JS exception: %@", exception?.toString() ?? "unknown")
        }
        let url = Bundle.main.url(forResource: "engine.bundle", withExtension: "js")!
        let source = try! String(contentsOf: url, encoding: .utf8)
        context.evaluateScript(source)
        engine = context.objectForKeyedSubscript("RiichiEngine")
    }

    /// 调用引擎导出的任意函数，参数与返回值走 JSON 兼容类型。
    func call(_ function: String, _ arguments: [Any]) -> JSValue? {
        engine.objectForKeyedSubscript(function)?.call(withArguments: arguments)
    }

    func smokeTest() -> String {
        guard let result = call("calcScore", [["han": 4, "fu": 30, "winType": "ron", "isDealer": false]]),
              let ron = result.objectForKeyedSubscript("ron")?.toNumber() else {
            return "引擎加载失败"
        }
        return "引擎就绪 · 4番30符荣和 = \(ron.intValue) 点"
    }
}
