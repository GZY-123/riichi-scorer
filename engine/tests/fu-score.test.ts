import { describe, expect, it } from "vitest";
import { calcFu, calcScore, parseHand } from "../src/index.js";

describe("calcFu", () => {
  it("handles pinfu tsumo, chiitoitsu, menzen ron, kan fu, and rounding", () => {
    const pinfu = parseHand(["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z", "2z"], "5p");
    expect(calcFu(pinfu, { winType: "tsumo", seatWind: "east", prevalentWind: "east" }).fu).toBe(20);
    expect(calcFu(parseHand(["1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "7z", "7z"], "7z")).fu).toBe(25);
    expect(calcFu(pinfu, { winType: "ron", seatWind: "east", prevalentWind: "east" }).fu).toBe(30);

    const kan = parseHand({
      tiles: ["2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5z", "5z"],
      winningTile: "4p",
      melds: [{ type: "kan-closed", tiles: ["1m", "1m", "1m", "1m"] }]
    });
    expect(calcFu(kan, { winType: "ron" }).details.some((detail) => detail.fu === 32)).toBe(true);

    const openPinfuShape = parseHand({
      tiles: ["3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z", "2z"],
      winningTile: "5p",
      melds: [{ type: "chi", tiles: ["2m", "3m", "4m"] }]
    });
    expect(calcFu(openPinfuShape, { winType: "ron", seatWind: "east", prevalentWind: "east" }).fu).toBe(30);
  });
});

describe("calcScore", () => {
  it("matches representative point table entries", () => {
    expect(calcScore({ han: 1, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(1000);
    expect(calcScore({ han: 1, fu: 30, isDealer: true, winType: "ron" }).ron).toBe(1500);
    expect(calcScore({ han: 1, fu: 30, isDealer: false, winType: "tsumo" }).tsumo).toMatchObject({ dealer: 500, nonDealer: 300 });
    expect(calcScore({ han: 4, fu: 40, isDealer: false, winType: "ron" }).ron).toBe(8000);
    expect(calcScore({ han: 5, fu: 30, isDealer: true, winType: "ron" }).ron).toBe(12000);
    expect(calcScore({ han: 6, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(12000);
    expect(calcScore({ han: 8, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(16000);
    expect(calcScore({ han: 11, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(24000);
    expect(calcScore({ yakuman: 1, isDealer: false, winType: "ron" }).ron).toBe(32000);
  });
});
