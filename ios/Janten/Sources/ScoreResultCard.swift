import SwiftUI
import UIKit

struct ScoreResultCard: View {
    let result: ScoreCalculationResult
    let onClose: () -> Void

    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 18) {
                    header
                    pointBlock
                    yakuList
                    closeButton
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 22)
            }
        }
        .scaleEffect(appeared ? 1 : 0.94)
        .opacity(appeared ? 1 : 0)
        .onAppear {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                appeared = true
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("结算")
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Text(result.winType.title)
                    .font(.system(.subheadline, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.ivory)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.felt, in: Capsule())
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(Array(result.tiles.enumerated()), id: \.offset) { index, tile in
                        TileImageView(code: tile, size: 34)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(index == result.winningTileIndex ? Color.accentRed : Color.clear, lineWidth: 2.5)
                            )
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .jantenCard()
    }

    private var pointBlock: some View {
        VStack(spacing: 12) {
            Text(pointText)
                .font(.system(size: 46, weight: .heavy, design: .rounded))
                .minimumScaleFactor(0.55)
                .lineLimit(1)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity)

            HStack(spacing: 8) {
                if isLimitHand {
                    Text(limitTitle)
                        .font(.system(.subheadline, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.amber)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.amber.opacity(0.12), in: Capsule())
                        .overlay(
                            Capsule()
                                .stroke(Color.amber.opacity(0.75), lineWidth: 1)
                        )
                }

                Text(scoreLine)
                    .font(.system(.headline, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .jantenCard()
    }

    private var yakuList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("役种")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Color.textPrimary)

            ForEach(result.yaku) { yaku in
                HStack(spacing: 10) {
                    Text(yaku.name)
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.textPrimary)

                    Spacer()

                    Text(yakuValueText(yaku))
                        .font(.system(.subheadline, design: .rounded).weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(yaku.isYakuman ? Color.amber : Color.textSecondary)
                }
                .padding(.vertical, 8)

                if yaku.id != result.yaku.last?.id {
                    Divider().overlay(Color.hairline)
                }
            }
        }
        .jantenCard()
    }

    private var closeButton: some View {
        Button {
            withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
                appeared = false
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                onClose()
            }
        } label: {
            Text("关闭")
                .font(.system(.headline, design: .rounded).weight(.bold))
                .foregroundStyle(Color.ivory)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.felt, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.top, 2)
    }

    private var pointText: String {
        if result.winType == .ron {
            return "\(result.total) 点"
        }
        guard let tsumo = result.tsumo else {
            return "\(result.total) 点"
        }
        if let all = tsumo.all {
            return "\(all) all"
        }
        return "庄\(tsumo.dealer ?? 0)/闲\(tsumo.nonDealer ?? 0)"
    }

    private var scoreLine: String {
        if result.yakuman > 0 {
            return result.yakuman == 1 ? "役满" : "\(result.yakuman)倍役满"
        }
        if result.limit != "none" {
            return "\(limitTitle) · \(result.han)番\(result.fu)符"
        }
        return "\(result.han)番\(result.fu)符"
    }

    private var isLimitHand: Bool {
        result.yakuman > 0 || result.limit != "none"
    }

    private var limitTitle: String {
        if result.yakuman > 0 {
            return result.yakuman == 1 ? "役满" : "\(result.yakuman)倍役满"
        }
        switch result.limit {
        case "mangan": return "满贯"
        case "haneman": return "跳满"
        case "baiman": return "倍满"
        case "sanbaiman": return "三倍满"
        case "yakuman": return "役满"
        default: return "\(result.han)番"
        }
    }

    private func yakuValueText(_ yaku: ScoreYaku) -> String {
        if yaku.isYakuman {
            let multiplier = yaku.yakuman ?? 1
            return multiplier == 1 ? "役满" : "\(multiplier)倍役满"
        }
        return "\(yaku.han ?? 0)番"
    }
}
