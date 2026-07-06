import SwiftUI
import UIKit

extension Color {
    static let feltDeep = Color(hex: 0x0A3D31)
    static let felt = Color(hex: 0x0F5342)
    static let feltBright = Color(hex: 0x1A7A5E)
    static let ivory = Color(hex: 0xFBF8EF)
    static let ivoryDeep = Color(hex: 0xF3EDDA)
    static let accentRed = Color(hex: 0xB93A28)
    static let amber = Color(hex: 0xB8862C)
    static let inkText = Color(hex: 0x1F2B27)

    static var backgroundPrimary: Color {
        dynamic(light: UIColor(hex: 0xFBF8EF), dark: UIColor(hex: 0x0A3D31))
    }

    static var backgroundSecondary: Color {
        dynamic(light: UIColor(hex: 0xF3EDDA), dark: UIColor(hex: 0x0F5342))
    }

    static var cardBackground: Color {
        dynamic(light: UIColor(hex: 0xFFFDF7), dark: UIColor(hex: 0x123F34))
    }

    static var textPrimary: Color {
        dynamic(light: UIColor(hex: 0x1F2B27), dark: UIColor(hex: 0xFBF8EF))
    }

    static var textSecondary: Color {
        dynamic(light: UIColor(hex: 0x66756F), dark: UIColor(hex: 0xD9D0BC))
    }

    static var hairline: Color {
        dynamic(light: UIColor(hex: 0xD9D0BC), dark: UIColor(hex: 0x2B6E5A))
    }

    private init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: 1.0
        )
    }

    private static func dynamic(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255.0,
            green: CGFloat((hex >> 8) & 0xFF) / 255.0,
            blue: CGFloat(hex & 0xFF) / 255.0,
            alpha: 1.0
        )
    }
}

struct TileImageView: View {
    let code: String
    let size: CGFloat

    var body: some View {
        Image(assetName)
            .resizable()
            .aspectRatio(3.0 / 4.0, contentMode: .fit)
            .frame(width: size, height: size * 4.0 / 3.0)
            .background(Color.ivory, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.hairline.opacity(0.85), lineWidth: 0.8)
            )
            .shadow(color: Color.black.opacity(0.14), radius: 4, x: 0, y: 2)
            .accessibilityLabel(tileAccessibilityLabel(code))
    }

    private var assetName: String {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.validCodes.contains(trimmed) else {
            return "tile_front"
        }
        return "tile_\(trimmed)"
    }

    private var cornerRadius: CGFloat {
        max(4, min(size * 0.13, 8))
    }

    private static let validCodes: Set<String> = {
        var codes: Set<String> = ["front", "back"]
        for suit in ["m", "p", "s"] {
            for rank in 1...9 {
                codes.insert("\(rank)\(suit)")
            }
            codes.insert("0\(suit)")
        }
        for rank in 1...7 {
            codes.insert("\(rank)z")
        }
        return codes
    }()
}

struct TileKeyboardView: View {
    let onTap: (String) -> Void
    let onDelete: () -> Void

    private let rows: [(title: String, tiles: [String])] = [
        ("萬", (1...9).map { "\($0)m" }),
        ("筒", (1...9).map { "\($0)p" }),
        ("索", (1...9).map { "\($0)s" }),
        ("字", (1...7).map { "\($0)z" })
    ]

    var body: some View {
        // 9 键按可用宽度均分，整行铺开不滚动
        GeometryReader { geo in
            let keySize = max(28, (geo.size.width - 24 - 10 - 8 * 6) / 9)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(rows.indices, id: \.self) { index in
                    let row = rows[index]
                    keyboardRow(title: row.title, tiles: row.tiles, keySize: keySize)
                }
                HStack(spacing: 6) {
                    Text("赤")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .frame(width: 24, alignment: .leading)

                    ForEach(["0m", "0p", "0s"], id: \.self) { code in
                        tileKey(code, keySize: keySize)
                    }

                    deleteKey
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(height: keyboardHeight)
    }

    // 5 行键盘的固定总高：按标准屏宽的键高估算，避免 GeometryReader 撑坏父布局
    private var keyboardHeight: CGFloat {
        let keySize = max(28, (UIScreen.main.bounds.width - 48 - 24 - 10 - 8 * 6) / 9)
        return keySize * 4 / 3 * 5 + 10 * 4
    }

    private func keyboardRow(title: String, tiles: [String], keySize: CGFloat) -> some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 24, alignment: .leading)

            ForEach(tiles, id: \.self) { code in
                tileKey(code, keySize: keySize)
            }
            Spacer(minLength: 0)
        }
    }

    private func tileKey(_ code: String, keySize: CGFloat) -> some View {
        Button {
            impact()
            onTap(code)
        } label: {
            TileImageView(code: code, size: keySize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tileAccessibilityLabel(code))
    }

    private var deleteKey: some View {
        Button {
            impact()
            onDelete()
        } label: {
            Image(systemName: "delete.left")
                .font(.system(size: 21, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .frame(width: 52, height: 44)
                .background(Color.backgroundSecondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.hairline, lineWidth: 0.8)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("退格")
    }

    private func impact() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

struct JantenCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Color.cardBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.hairline.opacity(0.7), lineWidth: 0.8)
            )
            .shadow(color: Color.black.opacity(0.12), radius: 16, x: 0, y: 8)
    }
}

extension View {
    func jantenCard() -> some View {
        modifier(JantenCardModifier())
    }
}

private func tileAccessibilityLabel(_ code: String) -> String {
    let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
    let characters = Array(trimmed)
    guard characters.count == 2 else {
        return "牌面"
    }

    let rank = String(characters[0])
    let suit = String(characters[1])
    if suit == "z" {
        let names = [
            "1": "东风",
            "2": "南风",
            "3": "西风",
            "4": "北风",
            "5": "白",
            "6": "发",
            "7": "中"
        ]
        return names[rank] ?? "字牌"
    }

    let rankName = rank == "0" ? "赤五" : rank
    let suitName: String
    switch suit {
    case "m": suitName = "万"
    case "p": suitName = "筒"
    case "s": suitName = "索"
    default: suitName = ""
    }
    return "\(rankName)\(suitName)"
}
