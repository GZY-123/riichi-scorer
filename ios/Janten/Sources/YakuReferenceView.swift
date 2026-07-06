import SwiftUI

struct YakuReferenceView: View {
    @State private var searchText = ""

    private var filteredItems: [YakuItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return YakuData.items
        }
        return YakuData.items.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                VStack(spacing: 0) {
                    groupIndexBar(proxy: proxy)

                    List {
                        ForEach(YakuData.groups, id: \.self) { group in
                            let items = filteredItems.filter { $0.group == group }
                            if !items.isEmpty {
                                Section(group) {
                                    ForEach(items) { item in
                                        YakuRow(item: item)
                                    }
                                }
                                .id(group)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
                .background(Color.backgroundPrimary)
            }
            .navigationTitle("役种")
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "搜索役种")
        }
    }

    /// 番数快速索引：点击滚动到对应分组
    private func groupIndexBar(proxy: ScrollViewProxy) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(YakuData.groups, id: \.self) { group in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo(group, anchor: .top)
                        }
                    } label: {
                        Text(group)
                            .font(.system(.subheadline, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.felt)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(Color.backgroundSecondary, in: Capsule())
                            .overlay(Capsule().stroke(Color.hairline, lineWidth: 0.8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
    }
}

private struct YakuRow: View {
    let item: YakuItem

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(item.name)
                    .font(.system(.headline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)

                Text(item.desc)
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 7) {
                Text(item.han)
                    .font(.system(.subheadline, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.felt)
                    .lineLimit(2)
                    .multilineTextAlignment(.trailing)

                if item.menzenOnly {
                    Text("门清")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.ivory)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.amber, in: Capsule())
                }
            }
        }
        .padding(.vertical, 6)
        .listRowBackground(Color.cardBackground)
    }
}

private struct YakuItem: Identifiable, Hashable {
    let id: String
    let name: String
    let han: String
    let menzenOnly: Bool
    let desc: String

    var group: String {
        if han.hasPrefix("双倍役满") { return "双倍役满" }
        if han.hasPrefix("役满") { return "役满" }
        if han.hasPrefix("6番") { return "6番" }
        if han.hasPrefix("3番") { return "3番" }
        if han.hasPrefix("2番") { return "2番" }
        return "1番"
    }
}

private enum YakuData {
    static let groups = ["1番", "2番", "3番", "6番", "役满", "双倍役满"]

    static let items: [YakuItem] = [
        YakuItem(id: "riichi", name: "立直", han: "1番", menzenOnly: true, desc: "门前听牌后宣言立直"),
        YakuItem(id: "ippatsu", name: "一发", han: "1番", menzenOnly: true, desc: "立直后一巡内和牌，期间无人鸣牌"),
        YakuItem(id: "menzen-tsumo", name: "门前清自摸和", han: "1番", menzenOnly: true, desc: "门前状态自摸和牌"),
        YakuItem(id: "pinfu", name: "平和", han: "1番", menzenOnly: true, desc: "全顺子+非役牌雀头+两面听"),
        YakuItem(id: "tanyao", name: "断幺九", han: "1番", menzenOnly: false, desc: "全部由2-8的数牌组成"),
        YakuItem(id: "iipeikou", name: "一杯口", han: "1番", menzenOnly: true, desc: "同色同数字的两组顺子"),
        YakuItem(id: "yakuhai-5z", name: "役牌 白", han: "1番", menzenOnly: false, desc: "白板刻子或杠子"),
        YakuItem(id: "yakuhai-6z", name: "役牌 发", han: "1番", menzenOnly: false, desc: "发财刻子或杠子"),
        YakuItem(id: "yakuhai-7z", name: "役牌 中", han: "1番", menzenOnly: false, desc: "红中刻子或杠子"),
        YakuItem(id: "yakuhai-seat-wind", name: "自风牌", han: "1番", menzenOnly: false, desc: "自风牌刻子或杠子"),
        YakuItem(id: "yakuhai-prevalent-wind", name: "场风牌", han: "1番", menzenOnly: false, desc: "场风牌刻子或杠子"),
        YakuItem(id: "yakuhai-north", name: "役牌 北", han: "1番", menzenOnly: false, desc: "三麻未拔北时，北刻子或杠子"),
        YakuItem(id: "rinshan-kaihou", name: "岭上开花", han: "1番", menzenOnly: false, desc: "杠后从岭上牌自摸和牌"),
        YakuItem(id: "chankan", name: "抢杠", han: "1番", menzenOnly: false, desc: "他人加杠时以该牌荣和"),
        YakuItem(id: "haitei", name: "海底摸月", han: "1番", menzenOnly: false, desc: "牌山最后一张自摸和牌"),
        YakuItem(id: "houtei", name: "河底捞鱼", han: "1番", menzenOnly: false, desc: "最后一张舍牌荣和"),
        YakuItem(id: "dora", name: "宝牌", han: "1番/张", menzenOnly: false, desc: "宝牌指示牌的下一张，每张加1番"),
        YakuItem(id: "ura-dora", name: "里宝牌", han: "1番/张", menzenOnly: false, desc: "立直和牌后翻开的里宝牌，每张加1番"),
        YakuItem(id: "aka-dora", name: "赤宝牌", han: "1番/张", menzenOnly: false, desc: "红五万、红五筒、红五索，每张加1番"),
        YakuItem(id: "nuki-dora", name: "拔北宝牌", han: "1番/枚", menzenOnly: false, desc: "三麻拔北计宝牌番，不单独成役"),
        YakuItem(id: "double-riichi", name: "两立直", han: "2番", menzenOnly: true, desc: "第一巡未被鸣牌前宣言立直"),
        YakuItem(id: "chiitoitsu", name: "七对子", han: "2番", menzenOnly: true, desc: "七组不同对子组成的和牌"),
        YakuItem(id: "chanta", name: "混全带幺九", han: "2番(副露1番)", menzenOnly: false, desc: "每组含幺九牌，且至少有顺子和字牌"),
        YakuItem(id: "ittsuu", name: "一气通贯", han: "2番(副露1番)", menzenOnly: false, desc: "同一花色的123、456、789顺子"),
        YakuItem(id: "sanshoku-doujun", name: "三色同顺", han: "2番(副露1番)", menzenOnly: false, desc: "万筒索三色各有同数字顺子"),
        YakuItem(id: "sanshoku-doukou", name: "三色同刻", han: "2番", menzenOnly: false, desc: "万筒索三色各有同数字刻子或杠子"),
        YakuItem(id: "sanankou", name: "三暗刻", han: "2番", menzenOnly: false, desc: "三组暗刻或暗杠"),
        YakuItem(id: "sankantsu", name: "三杠子", han: "2番", menzenOnly: false, desc: "一手牌中有三组杠子"),
        YakuItem(id: "toitoi", name: "对对和", han: "2番", menzenOnly: false, desc: "四组刻子或杠子组成的和牌"),
        YakuItem(id: "shousangen", name: "小三元", han: "2番", menzenOnly: false, desc: "两组三元牌刻子，另一组三元牌作雀头"),
        YakuItem(id: "honroutou", name: "混老头", han: "2番", menzenOnly: false, desc: "全部由幺九牌和字牌组成"),
        YakuItem(id: "ryanpeikou", name: "二杯口", han: "3番", menzenOnly: true, desc: "两组不同的一杯口"),
        YakuItem(id: "honitsu", name: "混一色", han: "3番(副露2番)", menzenOnly: false, desc: "一种数牌花色加字牌组成"),
        YakuItem(id: "junchan", name: "纯全带幺九", han: "3番(副露2番)", menzenOnly: false, desc: "每组含老头牌，且至少有顺子、无字牌"),
        YakuItem(id: "chinitsu", name: "清一色", han: "6番(副露5番)", menzenOnly: false, desc: "全部由同一种数牌花色组成"),
        YakuItem(id: "kokushi", name: "国士无双", han: "役满", menzenOnly: true, desc: "十三种幺九牌各一张，再加其中任意一张"),
        YakuItem(id: "suuankou", name: "四暗刻", han: "役满", menzenOnly: true, desc: "四组暗刻或暗杠"),
        YakuItem(id: "daisangen", name: "大三元", han: "役满", menzenOnly: false, desc: "白、发、中三组三元牌刻子或杠子"),
        YakuItem(id: "tsuuiisou", name: "字一色", han: "役满", menzenOnly: false, desc: "全部由字牌组成"),
        YakuItem(id: "shousuushi", name: "小四喜", han: "役满", menzenOnly: false, desc: "三组风牌刻子或杠子，另一种风牌作雀头"),
        YakuItem(id: "ryuuiisou", name: "绿一色", han: "役满", menzenOnly: false, desc: "全部由绿色牌组成"),
        YakuItem(id: "chinroutou", name: "清老头", han: "役满", menzenOnly: false, desc: "全部由1和9的数牌组成"),
        YakuItem(id: "chuuren", name: "九莲宝灯", han: "役满", menzenOnly: true, desc: "门前同花色1112345678999加同色任意一张"),
        YakuItem(id: "suukantsu", name: "四杠子", han: "役满", menzenOnly: false, desc: "一手牌中有四组杠子"),
        YakuItem(id: "tenhou", name: "天和", han: "役满", menzenOnly: true, desc: "庄家起手配牌即和牌"),
        YakuItem(id: "chiihou", name: "地和", han: "役满", menzenOnly: true, desc: "闲家第一巡自摸和牌，之前无人鸣牌"),
        YakuItem(id: "kokushi-13", name: "国士无双十三面", han: "双倍役满", menzenOnly: true, desc: "国士无双十三面听牌后和牌"),
        YakuItem(id: "suuankou-tanki", name: "四暗刻单骑", han: "双倍役满", menzenOnly: true, desc: "四暗刻以单骑等待雀头和牌"),
        YakuItem(id: "daisuushi", name: "大四喜", han: "双倍役满", menzenOnly: false, desc: "东、南、西、北四组风牌刻子或杠子"),
        YakuItem(id: "junsei-chuuren", name: "纯正九莲宝灯", han: "双倍役满", menzenOnly: true, desc: "门前九莲宝灯九面等待后和牌")
    ]
}
