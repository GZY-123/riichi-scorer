import { describe, expect, it } from "vitest";
import { applyEvent, createGame, detectYaku, parseHand, settleGame } from "../src/index.js";

describe("sanma rules", () => {
  it("uses 35000 start, disallows chi, counts nuki dora, and applies sanma draw penalties", () => {
    const game = createGame({ mode: "3p" });
    expect(game.scores).toEqual([35000, 35000, 35000]);
    expect(() =>
      parseHand({
        mode: "3p",
        tiles: ["4p", "5p", "6p", "7p", "8p", "9p", "2s", "3s", "4s", "5z", "5z"],
        winningTile: "6p",
        melds: [{ type: "chi", tiles: ["1p", "2p", "3p"] }]
      })
    ).toThrow(/chi/i);

    const withNorth = parseHand({
      mode: "3p",
      tiles: ["2p", "3p", "4p", "3s", "4s", "5s", "6s", "7s", "8s", "5z", "5z", "6z", "6z"],
      winningTile: "6z",
      melds: [{ type: "north", tiles: ["4z"] }]
    });
    const yaku = detectYaku(withNorth, { mode: "3p", riichi: true });
    expect(yaku.yaku.find((item) => item.id === "nuki-dora")?.han).toBe(1);

    const afterDraw = applyEvent(game, { type: "draw", tenpai: [true, false, false] });
    expect(afterDraw.lastResult?.deltas).toEqual([2000, -1000, -1000]);
  });
});

describe("game state and settlement", () => {
  it("moves riichi sticks, honba, dealer rotation, and bust termination", () => {
    const game = createGame({ mode: "4p", length: "east" });
    const afterRiichi = applyEvent(game, { type: "riichi", player: 1 });
    expect(afterRiichi.scores[1]).toBe(24000);
    expect(afterRiichi.riichiSticks).toBe(1);

    const afterDealerWin = applyEvent(afterRiichi, { type: "win", winner: 0, loser: 1, han: 1, fu: 30 });
    expect(afterDealerWin.dealerIndex).toBe(0);
    expect(afterDealerWin.honba).toBe(1);
    expect(afterDealerWin.riichiSticks).toBe(0);
    expect(afterDealerWin.scores[0]).toBe(27500);
    expect(afterDealerWin.scores[1]).toBe(22500);

    const afterChildWin = applyEvent(afterDealerWin, { type: "win", winner: 1, loser: 2, han: 1, fu: 30 });
    expect(afterChildWin.dealerIndex).toBe(1);
    expect(afterChildWin.honba).toBe(0);

    const busted = applyEvent({ ...afterChildWin, scores: [1000, 1000, 1000, 1000] }, { type: "win", winner: 0, loser: 1, han: 5, fu: 30 });
    expect(busted.status).toBe("ended");
  });

  it("settles uma, oka, leftover riichi sticks, and ties by dealer order", () => {
    const result = settleGame([30000, 30000, 20000, 20000], { mode: "4p", riichiSticks: 1 });
    expect(result.players.map((player) => player.player)).toEqual([0, 1, 2, 3]);
    expect(result.players[0]?.adjustedScore).toBe(31000);
    expect(result.players[0]?.uma).toBe(20);
    expect(result.players[0]?.oka).toBe(20);

    const sanma = settleGame([40000, 35000, 30000], { mode: "3p" });
    expect(sanma.players.map((player) => player.uma)).toEqual([15, 0, -15]);
  });
});
