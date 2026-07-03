import { describe, expect, it } from "vitest";
import { calcFu, calcScore, parseHand } from "../src/index.js";
import type { FuResult, HandDivision, Meld, WaitType } from "../src/index.js";

function divisionForWait(tiles: string[], win: string, wait: WaitType): HandDivision {
  const division = parseHand(tiles, win).find((candidate) => candidate.wait === wait);
  if (division === undefined) {
    throw new Error(`No ${wait} division for ${tiles.join(" ")} + ${win}.`);
  }
  return division;
}

function openHand(tiles: string[], win: string, melds: Meld[]): HandDivision[] {
  return parseHand({ tiles, winningTile: win, melds });
}

function detailFu(result: FuResult, reason: string): number | undefined {
  return result.details.find((detail) => detail.reason === reason)?.fu;
}

describe("calcFu expanded coverage", () => {
  it("keeps pinfu tsumo at 20 fu and chiitoitsu at fixed 25 fu", () => {
    const pinfu = parseHand(
      ["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z", "2z"],
      "5p"
    );
    const pinfuTsumo = calcFu(pinfu, { winType: "tsumo", seatWind: "east", prevalentWind: "east" });
    expect(pinfuTsumo.fu).toBe(20);
    expect(pinfuTsumo.rawFu).toBe(20);
    expect(pinfuTsumo.details).toEqual([{ reason: "pinfu tsumo fixed 20 fu", fu: 20 }]);
    expect(detailFu(pinfuTsumo, "tsumo")).toBeUndefined();

    const chiitoitsu = calcFu(parseHand(["1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "7z"], "7z"));
    expect(chiitoitsu.fu).toBe(25);
    expect(chiitoitsu.rawFu).toBe(25);
    expect(chiitoitsu.details).toEqual([{ reason: "chiitoitsu fixed fu", fu: 25 }]);
  });

  it("adds double wind pair fu and rounds raw fu up to the next ten", () => {
    const hand = parseHand(
      ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "4p", "5p", "6p", "1z", "1z"],
      "6p"
    );
    const fu = calcFu(hand, { winType: "ron", seatWind: "east", prevalentWind: "east" });
    expect(fu.rawFu).toBe(34);
    expect(fu.fu).toBe(40);
    expect(detailFu(fu, "value pair")).toBe(4);
  });

  it("scores terminal and honor triplets/quads across open and concealed states", () => {
    const openTriplet = calcFu(
      openHand(
        ["2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "2z", "2z"],
        "8s",
        [{ type: "pon", tiles: ["1m", "1m", "1m"] }]
      ),
      { winType: "ron" }
    );
    expect(openTriplet.rawFu).toBe(24);
    expect(openTriplet.fu).toBe(30);
    expect(detailFu(openTriplet, "open triplet")).toBe(4);

    const concealedTriplet = calcFu(
      parseHand(["1m", "1m", "1m", "2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "2z", "2z"], "8s"),
      { winType: "ron" }
    );
    expect(concealedTriplet.rawFu).toBe(38);
    expect(concealedTriplet.fu).toBe(40);
    expect(detailFu(concealedTriplet, "concealed triplet")).toBe(8);

    const openKan = calcFu(
      openHand(
        ["2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "2z", "2z"],
        "8s",
        [{ type: "kan-open", tiles: ["1m", "1m", "1m", "1m"] }]
      ),
      { winType: "ron" }
    );
    expect(openKan.rawFu).toBe(36);
    expect(openKan.fu).toBe(40);
    expect(detailFu(openKan, "open quad")).toBe(16);

    const closedKan = calcFu(
      openHand(
        ["2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "2z", "2z"],
        "8s",
        [{ type: "kan-closed", tiles: ["1m", "1m", "1m", "1m"] }]
      ),
      { winType: "ron" }
    );
    expect(closedKan.rawFu).toBe(62);
    expect(closedKan.fu).toBe(70);
    expect(detailFu(closedKan, "concealed quad")).toBe(32);
  });

  it("adds tanki, kanchan, and penchan wait fu without changing the 10-fu rounding rule", () => {
    const tanki = calcFu(
      divisionForWait(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "2z"], "2z", "tanki"),
      { winType: "ron", seatWind: "east", prevalentWind: "east" }
    );
    expect(tanki.rawFu).toBe(32);
    expect(tanki.fu).toBe(40);
    expect(detailFu(tanki, "tanki wait")).toBe(2);

    const kanchan = calcFu(
      divisionForWait(["1m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "2z", "2z"], "2m", "kanchan"),
      { winType: "ron", seatWind: "east", prevalentWind: "east" }
    );
    expect(kanchan.rawFu).toBe(32);
    expect(kanchan.fu).toBe(40);
    expect(detailFu(kanchan, "kanchan wait")).toBe(2);

    const penchan = calcFu(
      divisionForWait(["1m", "2m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "2z", "2z"], "3m", "penchan"),
      { winType: "ron", seatWind: "east", prevalentWind: "east" }
    );
    expect(penchan.rawFu).toBe(32);
    expect(penchan.fu).toBe(40);
    expect(detailFu(penchan, "penchan wait")).toBe(2);
  });
});

describe("calcScore expanded table checks", () => {
  it("matches dealer and non-dealer ron/tsumo rows from low fu through high fu", () => {
    expect(calcScore({ han: 1, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(1000);
    expect(calcScore({ han: 1, fu: 30, isDealer: true, winType: "ron" }).ron).toBe(1500);
    expect(calcScore({ han: 1, fu: 30, isDealer: false, winType: "tsumo" }).tsumo).toMatchObject({ dealer: 500, nonDealer: 300, total: 1100 });
    expect(calcScore({ han: 1, fu: 30, isDealer: true, winType: "tsumo" }).tsumo).toMatchObject({ all: 500, total: 1500 });

    expect(calcScore({ han: 2, fu: 25, isDealer: false, winType: "ron" }).ron).toBe(1600);
    expect(calcScore({ han: 2, fu: 25, isDealer: true, winType: "ron" }).ron).toBe(2400);
    expect(calcScore({ han: 2, fu: 25, isDealer: false, winType: "tsumo" }).tsumo).toMatchObject({ dealer: 800, nonDealer: 400, total: 1600 });
    expect(calcScore({ han: 2, fu: 25, isDealer: true, winType: "tsumo" }).tsumo).toMatchObject({ all: 800, total: 2400 });

    expect(calcScore({ han: 3, fu: 60, isDealer: false, winType: "ron" }).ron).toBe(7700);
    expect(calcScore({ han: 3, fu: 60, isDealer: true, winType: "ron" }).ron).toBe(11600);
    expect(calcScore({ han: 3, fu: 60, isDealer: false, winType: "tsumo" }).tsumo).toMatchObject({ dealer: 3900, nonDealer: 2000, total: 7900 });
    expect(calcScore({ han: 3, fu: 60, isDealer: true, winType: "tsumo" }).tsumo).toMatchObject({ all: 3900, total: 11700 });

    expect(calcScore({ han: 4, fu: 30, isDealer: false, winType: "ron" }).ron).toBe(7700);
    expect(calcScore({ han: 4, fu: 30, isDealer: true, winType: "ron" }).ron).toBe(11600);
    expect(calcScore({ han: 1, fu: 110, isDealer: false, winType: "ron" }).ron).toBe(3600);
    expect(calcScore({ han: 1, fu: 110, isDealer: true, winType: "ron" }).ron).toBe(5300);
    expect(calcScore({ han: 2, fu: 110, isDealer: false, winType: "ron" }).ron).toBe(7100);
    expect(calcScore({ han: 2, fu: 110, isDealer: true, winType: "ron" }).ron).toBe(10600);
    expect(calcScore({ han: 3, fu: 110, isDealer: false, winType: "ron" })).toMatchObject({ limit: "mangan", ron: 8000 });
    expect(calcScore({ han: 3, fu: 110, isDealer: true, winType: "ron" })).toMatchObject({ limit: "mangan", ron: 12000 });
    expect(calcScore({ han: 4, fu: 110, isDealer: false, winType: "ron" })).toMatchObject({ limit: "mangan", ron: 8000 });
    expect(calcScore({ han: 4, fu: 110, isDealer: true, winType: "ron" })).toMatchObject({ limit: "mangan", ron: 12000 });
  });

  it("matches limit, kazoe yakuman, and multiple yakuman point values", () => {
    expect(calcScore({ han: 6, fu: 30, isDealer: false, winType: "ron" })).toMatchObject({ limit: "haneman", ron: 12000 });
    expect(calcScore({ han: 6, fu: 30, isDealer: true, winType: "ron" })).toMatchObject({ limit: "haneman", ron: 18000 });
    expect(calcScore({ han: 8, fu: 30, isDealer: false, winType: "ron" })).toMatchObject({ limit: "baiman", ron: 16000 });
    expect(calcScore({ han: 11, fu: 30, isDealer: true, winType: "ron" })).toMatchObject({ limit: "sanbaiman", ron: 36000 });

    expect(calcScore({ han: 13, fu: 30, isDealer: false, winType: "ron" })).toMatchObject({ limit: "yakuman", ron: 32000 });
    expect(calcScore({ han: 13, fu: 30, isDealer: true, winType: "ron" })).toMatchObject({ limit: "yakuman", ron: 48000 });

    expect(calcScore({ yakuman: 2, isDealer: false, winType: "ron" })).toMatchObject({ limit: "yakuman", ron: 64000 });
    expect(calcScore({ yakuman: 2, isDealer: true, winType: "ron" })).toMatchObject({ limit: "yakuman", ron: 96000 });
    expect(calcScore({ yakuman: 2, isDealer: false, winType: "tsumo" }).tsumo).toMatchObject({ dealer: 32000, nonDealer: 16000, total: 64000 });
    expect(calcScore({ yakuman: 2, isDealer: true, winType: "tsumo" }).tsumo).toMatchObject({ all: 32000, total: 96000 });
  });
});
