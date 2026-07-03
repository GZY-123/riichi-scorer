import { describe, expect, it } from "vitest";
import { allTileTypes, applyEvent, calcScore, createGame, detectYaku, parseHand, settleGame } from "../src/index.js";
import type { GameState, YakuResult } from "../src/index.js";

function yakuIds(result: YakuResult): string[] {
  return result.yaku.map((yaku) => yaku.id);
}

function settlementSum(deltas: number[]): number {
  return deltas.reduce((sum, delta) => sum + delta, 0);
}

describe("sanma expanded rules", () => {
  it("removes 2m through 8m from the sanma tile pool and validates hands against it", () => {
    expect(allTileTypes("3p")).toContain("1m");
    expect(allTileTypes("3p")).toContain("9m");
    for (const tile of ["2m", "3m", "4m", "5m", "6m", "7m", "8m"]) {
      expect(allTileTypes("3p")).not.toContain(tile);
    }

    expect(() =>
      parseHand({
        mode: "3p",
        tiles: ["2m", "3p", "4p", "2p", "3p", "4p", "2s", "3s", "4s", "6s", "7s", "8s", "5z"],
        winningTile: "5z"
      })
    ).toThrow(/2m through 8m/i);
  });

  it("counts each nuki north as one han of dora and allows riichi to satisfy the yaku requirement", () => {
    const hand = parseHand({
      mode: "3p",
      tiles: ["2p", "3p", "4p", "3p", "4p", "5p", "2s", "3s", "4s", "6s", "7s", "8s", "5z"],
      winningTile: "5z",
      melds: [
        { type: "north", tiles: ["4z"] },
        { type: "north", tiles: ["4z"] }
      ]
    });
    const yaku = detectYaku(hand, { mode: "3p", riichi: true });
    expect(yakuIds(yaku)).toContain("riichi");
    expect(yaku.yaku.find((item) => item.id === "nuki-dora")?.han).toBe(2);
    expect(yaku.yakuHan).toBe(1);
    expect(yaku.doraHan).toBe(2);
    expect(yaku.han).toBe(3);
  });

  it("treats a north triplet as yakuhai when the north tiles are not extracted", () => {
    const hand = parseHand({
      mode: "3p",
      tiles: ["4z", "4z", "4z", "2p", "3p", "4p", "3p", "4p", "5p", "2s", "3s", "4s", "5z"],
      winningTile: "5z"
    });
    const yaku = detectYaku(hand, { mode: "3p" });
    expect(yaku.yaku.find((item) => item.id === "yakuhai-north")?.han).toBe(1);
  });

  it("supports sanma tsumo-loss on/off and adds 100 honba from each payer", () => {
    expect(calcScore({ mode: "3p", han: 1, fu: 30, isDealer: false, winType: "tsumo", tsumoLoss: false }).tsumo).toMatchObject({
      dealer: 500,
      nonDealer: 500,
      total: 1000
    });
    expect(calcScore({ mode: "3p", han: 1, fu: 30, isDealer: false, winType: "tsumo", tsumoLoss: true }).tsumo).toMatchObject({
      dealer: 500,
      nonDealer: 300,
      total: 800
    });
    expect(calcScore({ mode: "3p", han: 1, fu: 30, isDealer: false, winType: "tsumo", tsumoLoss: true, honba: 1 }).tsumo).toMatchObject({
      dealer: 600,
      nonDealer: 400,
      total: 1000
    });
  });

  it("applies the sanma exhaustive-draw noten penalty table for every tenpai count", () => {
    const game = createGame({ mode: "3p" });
    expect(applyEvent(game, { type: "draw", tenpai: [false, false, false] }).lastResult?.deltas).toEqual([0, 0, 0]);
    expect(applyEvent(game, { type: "draw", tenpai: [true, true, true] }).lastResult?.deltas).toEqual([0, 0, 0]);
    expect(applyEvent(game, { type: "draw", tenpai: [true, false, false] }).lastResult?.deltas).toEqual([2000, -1000, -1000]);
    expect(applyEvent(game, { type: "draw", tenpai: [true, true, false] }).lastResult?.deltas).toEqual([1000, 1000, -2000]);
  });
});

describe("state machine expanded coverage", () => {
  it("carries riichi sticks across a draw, clears per-hand declarations, and awards sticks to the next winner", () => {
    const afterRiichi = applyEvent(createGame({ mode: "4p" }), { type: "riichi", player: 1 });
    const afterDraw = applyEvent(afterRiichi, { type: "draw", tenpai: [true, true, true, true] });
    expect(afterDraw.riichiSticks).toBe(1);
    expect(afterDraw.riichiDeclared).toEqual([false, false, false, false]);

    const afterWin = applyEvent(afterDraw, { type: "win", winner: 2, loser: 1, han: 1, fu: 30 });
    expect(afterWin.lastResult?.deltas).toEqual([0, -1300, 2300, 0]);
    expect(afterWin.riichiSticks).toBe(0);
  });

  it("allows multiple players to declare riichi in sequence and tracks all deposits", () => {
    const game = createGame();
    const p0 = applyEvent(game, { type: "riichi", player: 0 });
    const p2 = applyEvent(p0, { type: "riichi", player: 2 });
    const p3 = applyEvent(p2, { type: "riichi", player: 3 });
    expect(p3.scores).toEqual([24000, 25000, 24000, 24000]);
    expect(p3.riichiSticks).toBe(3);
    expect(p3.riichiDeclared).toEqual([true, false, true, true]);
    expect(() => applyEvent(p3, { type: "riichi", player: 2 })).toThrow(/already declared/i);
  });

  it("repeats the dealer on dealer tenpai draw and rotates on dealer noten draw", () => {
    const game = createGame({ length: "hanchan" });
    const dealerTenpai = applyEvent(game, { type: "draw", tenpai: [true, false, false, false] });
    expect(dealerTenpai.dealerIndex).toBe(0);
    expect(dealerTenpai.handNumber).toBe(0);
    expect(dealerTenpai.honba).toBe(1);

    const dealerNoten = applyEvent(game, { type: "draw", tenpai: [false, true, false, false] });
    expect(dealerNoten.dealerIndex).toBe(1);
    expect(dealerNoten.handNumber).toBe(1);
    expect(dealerNoten.honba).toBe(1);
  });

  it("handles south four end conditions for child wins, dealer agari-yame, and dealer renchan", () => {
    const allLast: GameState = {
      ...createGame({ length: "hanchan" }),
      roundWind: "south",
      handNumber: 3,
      dealerIndex: 3
    };

    const childWin = applyEvent({ ...allLast, scores: [30000, 30000, 30000, 10000] }, { type: "win", winner: 0, loser: 1, han: 1, fu: 30 });
    expect(childWin.status).toBe("ended");

    const dealerTopWin = applyEvent({ ...allLast, scores: [10000, 10000, 10000, 70000] }, { type: "win", winner: 3, loser: 0, han: 1, fu: 30 });
    expect(dealerTopWin.status).toBe("ended");
    expect(dealerTopWin.honba).toBe(1);

    const dealerNotTopWin = applyEvent({ ...allLast, scores: [50000, 30000, 20000, 5000] }, { type: "win", winner: 3, loser: 0, han: 1, fu: 30 });
    expect(dealerNotTopWin.status).toBe("playing");
    expect(dealerNotTopWin.dealerIndex).toBe(3);
    expect(dealerNotTopWin.honba).toBe(1);
  });

  it("ends immediately on bust and rejects subsequent events", () => {
    const busted = applyEvent({ ...createGame(), scores: [1000, 1000, 1000, 1000] }, { type: "win", winner: 0, loser: 1, han: 5, fu: 30 });
    expect(busted.status).toBe("ended");
    expect(busted.scores[1]).toBeLessThan(0);
    expect(() => applyEvent(busted, { type: "draw", tenpai: [true, true, true, true] })).toThrow(/ended/i);
  });

  it("leaves prior immutable states intact so undo can restore the exact previous snapshot", () => {
    const before = createGame();
    const snapshot = JSON.parse(JSON.stringify(before)) as GameState;
    const after = applyEvent(before, { type: "riichi", player: 0 });
    expect(after).not.toEqual(snapshot);
    expect(before).toEqual(snapshot);

    const undone = before;
    expect(undone).toEqual(snapshot);
  });
});

describe("settleGame expanded coverage", () => {
  it("settles four-player 25000/30000 uma and oka with zero-sum totals", () => {
    const result = settleGame([50000, 30000, 15000, 5000], { mode: "4p" });
    expect(result.players.map((player) => player.player)).toEqual([0, 1, 2, 3]);
    expect(result.deltas).toEqual([60, 10, -25, -45]);
    expect(settlementSum(result.deltas)).toBe(0);
  });

  it("settles sanma 35000/40000 uma and oka with zero-sum totals", () => {
    const result = settleGame([50000, 35000, 20000], { mode: "3p" });
    expect(result.players.map((player) => player.player)).toEqual([0, 1, 2]);
    expect(result.deltas).toEqual([40, -5, -35]);
    expect(settlementSum(result.deltas)).toBe(0);
  });

  it("breaks ties by dealer order and assigns leftover riichi sticks to first place", () => {
    const result = settleGame([29000, 29000, 20000, 20000], {
      mode: "4p",
      riichiSticks: 2,
      dealerOrder: [1, 0, 3, 2]
    });
    expect(result.players.map((player) => player.player)).toEqual([1, 0, 3, 2]);
    expect(result.players[0]).toMatchObject({ player: 1, adjustedScore: 31000, settlement: 41 });
    expect(result.deltas).toEqual([9, 41, -30, -20]);
    expect(settlementSum(result.deltas)).toBe(0);
  });
});
