import { describe, expect, it } from "vitest";
import { applyEvent, createGame, detectYaku, parseHand } from "../src/index.js";
import type { Meld, YakuContext, YakuResult } from "../src/index.js";

function result(tiles: string[], win: string, context: YakuContext = {}): YakuResult {
  return detectYaku(parseHand(tiles, win), context);
}

function openResult(tiles: string[], win: string, melds: Meld[], context: YakuContext = {}): YakuResult {
  return detectYaku(parseHand({ tiles, winningTile: win, melds }), context);
}

function ids(result: YakuResult): string[] {
  return result.yaku.map((yaku) => yaku.id);
}

function expectHan(result: YakuResult, id: string, han: number): void {
  const yaku = result.yaku.find((item) => item.id === id);
  expect(yaku?.han).toBe(han);
}

function expectYakuman(result: YakuResult, id: string, yakuman: number): void {
  const yaku = result.yaku.find((item) => item.id === id);
  expect(yaku?.yakuman).toBe(yakuman);
}

describe("detectYaku expanded one-han and context yaku", () => {
  it("detects riichi, double riichi, ippatsu, menzen tsumo, and their close negatives", () => {
    const base = ["1m", "2m", "3m", "4p", "5p", "6p", "3s", "4s", "5s", "6s", "7s", "8s", "1z"];
    expectHan(result(base, "1z", { riichi: true }), "riichi", 1);
    expect(ids(result(base, "1z"))).not.toContain("riichi");

    const double = result(base, "1z", { doubleRiichi: true });
    expectHan(double, "double-riichi", 2);
    expect(ids(double)).not.toContain("riichi");
    expect(ids(result(base, "1z", { riichi: true }))).not.toContain("double-riichi");

    expectHan(result(base, "1z", { riichi: true, ippatsu: true }), "ippatsu", 1);
    expect(ids(result(base, "1z", { ippatsu: true }))).not.toContain("ippatsu");

    expectHan(result(base, "1z", { winType: "tsumo" }), "menzen-tsumo", 1);
    const open = openResult(
      ["4p", "5p", "6p", "3s", "4s", "5s", "6s", "7s", "8s", "1z"],
      "1z",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }],
      { winType: "tsumo" }
    );
    expect(ids(open)).not.toContain("menzen-tsumo");
  });

  it("detects tanyao, pinfu, iipeikou, yakuhai, and easy-miss negatives", () => {
    expectHan(result(["2m", "3m", "4m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5m"], "5m"), "tanyao", 1);
    expect(ids(result(["1m", "2m", "3m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5m"], "5m"))).not.toContain("tanyao");

    const pinfu = result(
      ["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z", "2z"],
      "5p",
      { seatWind: "east", prevalentWind: "east" }
    );
    expectHan(pinfu, "pinfu", 1);
    const valuePair = result(
      ["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "1z", "1z"],
      "5p",
      { seatWind: "east", prevalentWind: "east" }
    );
    expect(ids(valuePair)).not.toContain("pinfu");
    const kanchanWait = result(
      ["1m", "3m", "4m", "5m", "6m", "2p", "3p", "4p", "4s", "5s", "6s", "2z", "2z"],
      "2m"
    );
    expect(ids(kanchanWait)).not.toContain("pinfu");

    const iipeikou = result(["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "7p", "3s", "4s", "5s", "6z"], "6z");
    expectHan(iipeikou, "iipeikou", 1);
    const openIipeikouShape = openResult(
      ["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "6z", "6z"],
      "7p",
      [{ type: "chi", tiles: ["3s", "4s", "5s"] }]
    );
    expect(ids(openIipeikouShape)).not.toContain("iipeikou");

    const yakuhai = result(
      ["1z", "1z", "1z", "5z", "5z", "5z", "2m", "3m", "4m", "6p", "7p", "8p", "9s"],
      "9s",
      { seatWind: "east", prevalentWind: "east" }
    );
    expectHan(yakuhai, "yakuhai-seat-wind", 1);
    expectHan(yakuhai, "yakuhai-prevalent-wind", 1);
    expectHan(yakuhai, "yakuhai-5z", 1);
    expect(ids(result(["1z", "1z", "2m", "3m", "4m", "6p", "7p", "8p", "3s", "4s", "5s", "6s", "7s"], "8s"))).not.toContain("yakuhai-seat-wind");
  });

  it("detects rinshan, chankan, haitei, and houtei only in matching contexts", () => {
    const hand = ["2m", "3m", "4m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "2z"];
    expectHan(result(hand, "2z", { rinshan: true }), "rinshan-kaihou", 1);
    expect(ids(result(hand, "2z"))).not.toContain("rinshan-kaihou");

    expectHan(result(hand, "2z", { chankan: true }), "chankan", 1);
    expect(ids(result(hand, "2z"))).not.toContain("chankan");

    expectHan(result(hand, "2z", { winType: "tsumo", haitei: true }), "haitei", 1);
    expect(ids(result(hand, "2z", { winType: "ron", haitei: true }))).not.toContain("haitei");

    expectHan(result(hand, "2z", { winType: "ron", hotei: true }), "houtei", 1);
    expect(ids(result(hand, "2z", { winType: "tsumo", hotei: true }))).not.toContain("houtei");
  });
});

describe("detectYaku expanded two- through six-han yaku", () => {
  it("detects chiitoitsu, chanta, junchan, honroutou, and their boundaries", () => {
    expectHan(result(["1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "7z"], "7z"), "chiitoitsu", 2);
    expect(ids(result(["1m", "1m", "1m", "2p", "2p", "2p", "3s", "3s", "3s", "4m", "5m", "6m", "7z"], "7z"))).not.toContain("chiitoitsu");

    const chanta = result(["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "5z"], "5z");
    expectHan(chanta, "chanta", 2);
    expect(ids(chanta)).not.toContain("junchan");

    const openChanta = openResult(
      ["7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "5z"],
      "5z",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openChanta, "chanta", 1);

    const junchan = result(["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "1m"], "1m");
    expectHan(junchan, "junchan", 3);
    expect(ids(junchan)).not.toContain("chanta");

    const openJunchan = openResult(
      ["7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "1m"],
      "1m",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openJunchan, "junchan", 2);

    const honroutou = openResult(
      ["9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "1z"],
      "1z",
      [{ type: "pon", tiles: ["1m", "1m", "1m"] }]
    );
    expectHan(honroutou, "honroutou", 2);
    expect(ids(honroutou)).not.toContain("chanta");
    expect(ids(result(["1m", "1m", "1m", "9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "2s"], "2s"))).not.toContain("honroutou");
  });

  it("detects ittsuu, sanshoku doujun, open-hand downgrades, and close negatives", () => {
    const ittsuu = result(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "6z"], "6z");
    expectHan(ittsuu, "ittsuu", 2);
    const openIttsuu = openResult(
      ["4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "6z", "6z"],
      "4p",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openIttsuu, "ittsuu", 1);
    expect(ids(result(["1m", "2m", "3m", "4m", "5m", "6m", "6m", "7m", "8m", "2p", "3p", "4p", "6z", "6z"], "8m"))).not.toContain("ittsuu");

    const sanshoku = result(["1m", "2m", "3m", "1p", "2p", "3p", "1s", "2s", "3s", "5z", "5z", "5z", "9m"], "9m");
    expectHan(sanshoku, "sanshoku-doujun", 2);
    const openSanshoku = openResult(
      ["1p", "2p", "3p", "1s", "2s", "3s", "5z", "5z", "5z", "9m"],
      "9m",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openSanshoku, "sanshoku-doujun", 1);
    expect(ids(result(["1m", "2m", "3m", "1p", "2p", "3p", "2s", "3s", "4s", "5z", "5z", "5z", "9m"], "9m"))).not.toContain("sanshoku-doujun");
  });

  it("detects triplet and quad yaku with ron-completed concealed-triplet negatives", () => {
    expectHan(
      openResult(
        ["2m", "2m", "2m", "2p", "2p", "2p", "2s", "2s", "2s", "9m"],
        "9m",
        [{ type: "pon", tiles: ["5z", "5z", "5z"] }]
      ),
      "sanshoku-doukou",
      2
    );
    expect(ids(result(["2m", "2m", "2m", "2p", "2p", "2p", "3s", "3s", "3s", "5z", "5z", "5z", "9m"], "9m"))).not.toContain("sanshoku-doukou");

    expectHan(result(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "1s", "2s", "3s", "9m"], "9m", { winType: "tsumo" }), "sanankou", 2);
    expect(ids(result(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "1s", "2s", "3s", "9m", "9m"], "4s", { winType: "ron" }))).not.toContain("sanankou");

    const sankantsu = openResult(
      ["4m", "5m", "7z", "7z"],
      "6m",
      [
        { type: "kan-open", tiles: ["1m", "1m", "1m", "1m"] },
        { type: "kan-open", tiles: ["2p", "2p", "2p", "2p"] },
        { type: "kan-closed", tiles: ["3s", "3s", "3s", "3s"] }
      ]
    );
    expectHan(sankantsu, "sankantsu", 2);
    const twoKans = openResult(
      ["4m", "5m", "6m", "7p", "8p", "7z", "7z"],
      "9p",
      [
        { type: "kan-open", tiles: ["1m", "1m", "1m", "1m"] },
        { type: "kan-closed", tiles: ["3s", "3s", "3s", "3s"] }
      ]
    );
    expect(ids(twoKans)).not.toContain("sankantsu");

    expectHan(
      openResult(
        ["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "9m"],
        "9m",
        [{ type: "pon", tiles: ["5z", "5z", "5z"] }]
      ),
      "toitoi",
      2
    );
    expect(ids(result(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "5s", "6s", "5z", "5z", "5z", "9m"], "9m"))).not.toContain("toitoi");

    expectHan(result(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "1m", "2m", "3m", "9p", "9p"], "9p"), "shousangen", 2);
    expect(ids(result(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "7z", "1m", "2m", "3m", "9p"], "9p"))).not.toContain("shousangen");
  });

  it("detects ryanpeikou, honitsu, chinitsu, and closed/open han values", () => {
    const ryanpeikou = result(["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "7p", "5p", "6p", "7p", "6z"], "6z");
    expectHan(ryanpeikou, "ryanpeikou", 3);
    expect(ids(ryanpeikou)).not.toContain("iipeikou");
    const openTwoPairs = openResult(
      ["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "6z", "6z"],
      "7p",
      [{ type: "chi", tiles: ["5p", "6p", "7p"] }]
    );
    expect(ids(openTwoPairs)).not.toContain("ryanpeikou");

    const honitsu = result(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "4m", "5z"], "5z");
    expectHan(honitsu, "honitsu", 3);
    const openHonitsu = openResult(
      ["4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "5z", "5z"],
      "4m",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openHonitsu, "honitsu", 2);
    expect(ids(result(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "5z"], "5z"))).not.toContain("honitsu");

    const chinitsu = result(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "4m", "5m"], "5m");
    expectHan(chinitsu, "chinitsu", 6);
    const openChinitsu = openResult(
      ["4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "5m", "5m"],
      "4m",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expectHan(openChinitsu, "chinitsu", 5);
    expect(ids(honitsu)).not.toContain("chinitsu");
  });
});

describe("detectYaku expanded yakuman and dora boundaries", () => {
  it("detects heavenly/earthly hand yakuman and keeps them separate from normal yaku", () => {
    const hand = ["2m", "3m", "4m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "2z"];
    const tenhou = result(hand, "2z", { tenhou: true });
    expectYakuman(tenhou, "tenhou", 1);
    expect(tenhou.yakuHan).toBe(0);
    expect(ids(result(hand, "2z"))).not.toContain("tenhou");

    const chiihou = result(hand, "2z", { chiihou: true });
    expectYakuman(chiihou, "chiihou", 1);
    expect(ids(result(hand, "2z"))).not.toContain("chiihou");
  });

  it("distinguishes ordinary kokushi, thirteen-sided kokushi, chuuren, and pure chuuren", () => {
    const ordinaryKokushi = result(["1m", "1m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], "9m");
    expectYakuman(ordinaryKokushi, "kokushi", 1);
    expect(ids(ordinaryKokushi)).not.toContain("kokushi-13");

    const thirteenSided = result(["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], "1m");
    expectYakuman(thirteenSided, "kokushi-13", 2);

    const chuuren = result(["1m", "1m", "1m", "2m", "3m", "4m", "5m", "5m", "6m", "7m", "8m", "9m", "9m"], "9m");
    expectYakuman(chuuren, "chuuren", 1);
    expect(ids(chuuren)).not.toContain("junsei-chuuren");

    const pure = result(["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m"], "5m");
    expectYakuman(pure, "junsei-chuuren", 2);
  });

  it("handles suuankou variants and ron-completed shanpon as sanankou instead", () => {
    const shanponRon = result(
      ["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "5z", "5z", "5z", "9m", "9m"],
      "4s",
      { winType: "ron" }
    );
    expect(ids(shanponRon)).not.toContain("suuankou");
    expect(ids(shanponRon)).not.toContain("suuankou-tanki");
    expectHan(shanponRon, "sanankou", 2);

    const tsumo = result(
      ["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "5z", "5z", "5z", "9m", "9m"],
      "4s",
      { winType: "tsumo" }
    );
    expectYakuman(tsumo, "suuankou", 1);

    const tanki = result(
      ["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "5z", "5z", "5z", "9m"],
      "9m",
      { winType: "ron" }
    );
    expectYakuman(tanki, "suuankou-tanki", 2);
  });

  it("detects dragon, honor, wind, green, terminal, and quad yakuman with exact multipliers", () => {
    expectYakuman(result(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "7z", "1m", "2m", "3m", "9p"], "9p"), "daisangen", 1);
    expect(ids(result(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "1m", "2m", "3m", "9p", "9p"], "9p"))).not.toContain("daisangen");

    const tsuuiisouDaisuushi = openResult(
      ["5z"],
      "5z",
      [
        { type: "pon", tiles: ["1z", "1z", "1z"] },
        { type: "pon", tiles: ["2z", "2z", "2z"] },
        { type: "pon", tiles: ["3z", "3z", "3z"] },
        { type: "pon", tiles: ["4z", "4z", "4z"] }
      ]
    );
    expectYakuman(tsuuiisouDaisuushi, "tsuuiisou", 1);
    expectYakuman(tsuuiisouDaisuushi, "daisuushi", 2);
    expect(tsuuiisouDaisuushi.yakuman).toBe(3);
    expect(ids(tsuuiisouDaisuushi)).not.toContain("shousuushi");
    expect(ids(result(["1z", "1z", "1z", "2z", "2z", "2z", "3z", "3z", "3z", "4z", "4z", "1m", "1m"], "4z"))).not.toContain("tsuuiisou");

    const shousuushi = result(["1z", "1z", "1z", "2z", "2z", "2z", "3z", "3z", "3z", "4z", "4z", "1m", "2m"], "3m");
    expectYakuman(shousuushi, "shousuushi", 1);
    expect(ids(shousuushi)).not.toContain("daisuushi");

    expectYakuman(result(["2s", "3s", "4s", "2s", "3s", "4s", "6s", "6s", "6s", "8s", "8s", "8s", "6z"], "6z"), "ryuuiisou", 1);
    expect(ids(result(["2s", "3s", "4s", "2s", "3s", "4s", "5s", "5s", "5s", "8s", "8s", "8s", "6z"], "6z"))).not.toContain("ryuuiisou");

    const chinroutou = result(["1m", "1m", "1m", "9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "1s"], "1s");
    expectYakuman(chinroutou, "chinroutou", 1);
    expect(chinroutou.yaku.every((yaku) => yaku.isYakuman)).toBe(true);
    expect(ids(chinroutou)).not.toContain("toitoi");
    expect(ids(result(["1m", "1m", "1m", "9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "1z"], "1z"))).not.toContain("chinroutou");

    const suukantsu = openResult(
      ["7z"],
      "7z",
      [
        { type: "kan-open", tiles: ["1m", "1m", "1m", "1m"] },
        { type: "kan-open", tiles: ["2p", "2p", "2p", "2p"] },
        { type: "kan-closed", tiles: ["3s", "3s", "3s", "3s"] },
        { type: "kan-open", tiles: ["5z", "5z", "5z", "5z"] }
      ]
    );
    expectYakuman(suukantsu, "suukantsu", 1);
    expect(ids(suukantsu)).not.toContain("sankantsu");
    const openNineGatesShape = openResult(
      ["1m", "1m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m"],
      "9m",
      [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
    );
    expect(ids(openNineGatesShape)).not.toContain("chuuren");
    expect(ids(openNineGatesShape)).not.toContain("junsei-chuuren");
  });

  it("keeps dora out of the one-yaku requirement", () => {
    const doraOnly = parseHand(["1m", "2m", "3m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "1m"], "1m");
    const yaku = detectYaku(doraOnly, { doraIndicators: ["1m"] });
    expect(yaku.doraHan).toBe(1);
    expect(yaku.hasYaku).toBe(false);

    expect(() =>
      applyEvent(createGame(), {
        type: "win",
        winner: 0,
        loser: 1,
        division: doraOnly,
        context: { doraIndicators: ["1m"] }
      })
    ).toThrow(/dora alone/i);
  });
});

// 回归：14 张含和牌张的输入形态（拍照识别路径）也要能判出「和牌前 13 张」相关的双倍役满
describe("14-tile input with embedded winning tile", () => {
  it("detects junsei chuuren on tsumo and ron", () => {
    const tiles = ["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m", "5m"];
    for (const winType of ["ron", "tsumo"] as const) {
      const result = detectYaku(parseHand(tiles, "5m"), { winType });
      expect(result.yaku.map((yaku) => yaku.id)).toContain("junsei-chuuren");
      expect(result.yakuman).toBe(2);
    }
  });

  it("detects kokushi 13-sided wait", () => {
    const tiles = ["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z", "1z"];
    const result = detectYaku(parseHand(tiles, "1z"), { winType: "tsumo" });
    expect(result.yaku.map((yaku) => yaku.id)).toContain("kokushi-13");
    expect(result.yakuman).toBe(2);
  });

  it("rejects a winning tile absent from the 14 tiles", () => {
    const tiles = ["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m", "5m"];
    expect(() => parseHand(tiles, "6p")).toThrow(/winning tile/i);
  });
});
