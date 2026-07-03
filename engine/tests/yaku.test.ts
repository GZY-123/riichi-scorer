import { describe, expect, it } from "vitest";
import { detectYaku, parseHand } from "../src/index.js";

function yakuIds(tiles: string[], win: string, context = {}): string[] {
  return detectYaku(parseHand(tiles, win), { seatWind: "east", prevalentWind: "east", ...context }).yaku.map((yaku) => yaku.id);
}

describe("detectYaku", () => {
  it("detects common one-han yaku and their close negatives", () => {
    expect(yakuIds(["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z", "2z"], "5p")).toContain("pinfu");
    expect(yakuIds(["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "5z", "5z"], "5p")).not.toContain("pinfu");

    expect(yakuIds(["2m", "3m", "4m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5m", "5m"], "4p")).toContain("tanyao");
    expect(yakuIds(["1m", "2m", "3m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5m", "5m"], "3m")).not.toContain("tanyao");

    expect(yakuIds(["5z", "5z", "5z", "2m", "3m", "4m", "2p", "3p", "4p", "6s", "7s", "8s", "2z", "2z"], "4m")).toContain("yakuhai-5z");
    expect(yakuIds(["5z", "5z", "2m", "3m", "4m", "2p", "3p", "4p", "6s", "7s", "8s", "3s", "4s", "5s"], "5s")).not.toContain("yakuhai-5z");

    expect(yakuIds(["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "7p", "3s", "4s", "5s", "6z", "6z"], "4m")).toContain("iipeikou");
    expect(yakuIds(["2m", "3m", "4m", "2p", "3p", "4p", "5p", "6p", "7p", "3s", "4s", "5s", "6z", "6z"], "4m")).not.toContain("iipeikou");
  });

  it("detects two- and three-han shape yaku with open hand downgrades", () => {
    expect(yakuIds(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "6z", "6z"], "9m")).toContain("ittsuu");
    const openIttsuu = detectYaku(
      parseHand({
        tiles: ["4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "6z", "6z"],
        winningTile: "9m",
        melds: [{ type: "chi", tiles: ["1m", "2m", "3m"] }]
      }),
      {}
    );
    expect(openIttsuu.yaku.find((yaku) => yaku.id === "ittsuu")?.han).toBe(1);

    expect(yakuIds(["1m", "2m", "3m", "1p", "2p", "3p", "1s", "2s", "3s", "5z", "5z", "5z", "9m", "9m"], "3s")).toContain("sanshoku-doujun");
    expect(yakuIds(["2m", "2m", "2m", "2p", "2p", "2p", "2s", "2s", "2s", "5z", "5z", "5z", "9m", "9m"], "2s")).toContain("sanshoku-doukou");
    expect(yakuIds(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "1s", "2s", "3s", "9m", "9m"], "4s", { winType: "tsumo" })).toContain("sanankou");
    expect(yakuIds(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "1s", "2s", "3s", "9m", "9m"], "4s")).not.toContain("sanankou");
    expect(yakuIds(["2m", "2m", "2m", "3p", "3p", "3p", "4s", "4s", "4s", "5z", "5z", "5z", "9m", "9m"], "4s")).toContain("toitoi");
    expect(yakuIds(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "1m", "2m", "3m", "9p", "9p", "9p"], "7z")).toContain("shousangen");
    expect(yakuIds(["1m", "1m", "1m", "9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "1z", "1z"], "9p")).toContain("honroutou");
  });

  it("detects flushes, chanta family, chiitoitsu, ryanpeikou, and dora as non-yaku", () => {
    expect(yakuIds(["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "5z", "5z"], "3m")).toContain("chanta");
    expect(yakuIds(["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "1m", "1m"], "3m")).toContain("junchan");
    expect(yakuIds(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "4m", "5z", "5z"], "9m")).toContain("honitsu");
    expect(yakuIds(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2m", "3m", "4m", "5m", "5m"], "9m")).toContain("chinitsu");
    expect(yakuIds(["1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "7z", "7z"], "7z")).toContain("chiitoitsu");
    expect(yakuIds(["2m", "3m", "4m", "2m", "3m", "4m", "5p", "6p", "7p", "5p", "6p", "7p", "6z", "6z"], "4m")).toContain("ryanpeikou");

    const doraOnly = detectYaku(parseHand(["1m", "2m", "3m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "1m", "1m"], "3m"), {
      doraIndicators: ["1m"]
    });
    expect(doraOnly.doraHan).toBeGreaterThan(0);
    expect(doraOnly.hasYaku).toBe(false);
  });

  it("detects yakuman and double yakuman", () => {
    expect(yakuIds(["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], "1m")).toContain("kokushi-13");
    expect(yakuIds(["1z", "1z", "1z", "2z", "2z", "2z", "3z", "3z", "3z", "4z", "4z", "4z", "5z", "5z"], "4z")).toContain("daisuushi");
    expect(yakuIds(["2s", "3s", "4s", "2s", "3s", "4s", "6s", "6s", "6s", "8s", "8s", "8s", "6z", "6z"], "4s")).toContain("ryuuiisou");
    expect(yakuIds(["1m", "1m", "1m", "9m", "9m", "9m", "1p", "1p", "1p", "9p", "9p", "9p", "1s", "1s"], "1s")).toContain("chinroutou");
    expect(yakuIds(["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m"], "5m")).toContain("junsei-chuuren");
    expect(yakuIds(["5z", "5z", "5z", "6z", "6z", "6z", "7z", "7z", "7z", "1m", "2m", "3m", "9p", "9p"], "7z")).toContain("daisangen");
  });
});
