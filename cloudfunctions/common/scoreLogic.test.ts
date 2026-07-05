import { describe, expect, it } from "vitest";
import type { PlayerState, RoomDocument } from "./roomLogic";
import { validateDeltas } from "./roomLogic";
import {
  EngineApi,
  EngineScoreResult,
  buildScoreHandPreview,
  buildWinDeltas,
  buildWinEventAdjustments
} from "./scoreLogic";

const fourPlayers: PlayerState[] = [
  { openid: "east", nickName: "东家", seat: "east", score: 25000 },
  { openid: "south", nickName: "南家", seat: "south", score: 25000 },
  { openid: "west", nickName: "西家", seat: "west", score: 25000 },
  { openid: "north", nickName: "北家", seat: "north", score: 25000 }
];

const threePlayers: PlayerState[] = [
  { openid: "east", nickName: "东家", seat: "east", score: 35000 },
  { openid: "south", nickName: "南家", seat: "south", score: 35000 },
  { openid: "west", nickName: "西家", seat: "west", score: 35000 }
];

function score(overrides: Partial<EngineScoreResult>): EngineScoreResult {
  return {
    han: 1,
    fu: 30,
    yakuman: 0,
    basePoints: 240,
    limit: "none",
    isDealer: false,
    winType: "ron",
    mode: "4p",
    honba: 0,
    riichiBonus: 0,
    total: 0,
    ...overrides
  };
}

function room(players: PlayerState[] = fourPlayers): RoomDocument {
  return {
    roomCode: "123456",
    mode: players.length === 3 ? "3p" : "4p",
    status: "playing",
    players,
    round: {
      prevalentWind: "east",
      hand: 1,
      honba: 2,
      riichiSticks: 1,
      dealerSeat: "east"
    },
    events: [],
    createdAt: 1,
    updatedAt: 1
  };
}

describe("win delta generation", () => {
  it("generates dealer ron deltas with honba already included in the score and riichi sticks paid to winner", () => {
    const deltas = buildWinDeltas({
      players: fourPlayers,
      winnerOpenid: "east",
      loserOpenid: "south",
      dealerSeat: "east",
      winType: "ron",
      score: score({ isDealer: true, ron: 4200, total: 6200, riichiBonus: 2000 }),
      riichiSticks: 2
    });

    expect(deltas).toMatchObject({ east: 6200, south: -4200, west: 0, north: 0 });
    expect(() => validateDeltas(fourPlayers, deltas, -2)).not.toThrow();
  });

  it("generates child ron deltas without touching unrelated players", () => {
    const deltas = buildWinDeltas({
      players: fourPlayers,
      winnerOpenid: "south",
      loserOpenid: "west",
      dealerSeat: "east",
      winType: "ron",
      score: score({ ron: 2000, total: 2000 }),
      riichiSticks: 0
    });

    expect(deltas).toEqual({ east: 0, south: 2000, west: -2000, north: 0 });
    expect(() => validateDeltas(fourPlayers, deltas, 0)).not.toThrow();
  });

  it("generates dealer tsumo deltas in four-player games", () => {
    const deltas = buildWinDeltas({
      players: fourPlayers,
      winnerOpenid: "east",
      dealerSeat: "east",
      winType: "tsumo",
      score: score({
        isDealer: true,
        winType: "tsumo",
        tsumo: { all: 700, nonDealer: 700, total: 2100 },
        total: 2100
      }),
      riichiSticks: 0
    });

    expect(deltas).toEqual({ east: 2100, south: -700, west: -700, north: -700 });
    expect(() => validateDeltas(fourPlayers, deltas, 0)).not.toThrow();
  });

  it("generates child tsumo deltas with dealer and non-dealer payments plus riichi sticks", () => {
    const deltas = buildWinDeltas({
      players: fourPlayers,
      winnerOpenid: "south",
      dealerSeat: "east",
      winType: "tsumo",
      score: score({
        winType: "tsumo",
        tsumo: { dealer: 1600, nonDealer: 800, total: 3200 },
        riichiBonus: 1000,
        total: 4200
      }),
      riichiSticks: 1
    });

    expect(deltas).toEqual({ east: -1600, south: 4200, west: -800, north: -800 });
    expect(() => validateDeltas(fourPlayers, deltas, -1)).not.toThrow();
  });

  it("generates sanma dealer tsumo deltas for two payers", () => {
    const deltas = buildWinDeltas({
      players: threePlayers,
      winnerOpenid: "east",
      dealerSeat: "east",
      winType: "tsumo",
      score: score({
        mode: "3p",
        isDealer: true,
        winType: "tsumo",
        tsumo: { all: 1000, nonDealer: 1000, total: 2000 },
        total: 2000
      }),
      riichiSticks: 0
    });

    expect(deltas).toEqual({ east: 2000, south: -1000, west: -1000 });
    expect(() => validateDeltas(threePlayers, deltas, 0)).not.toThrow();
  });
});

describe("win event adjustments", () => {
  it("keeps dealer on dealer win and increments honba", () => {
    expect(buildWinEventAdjustments({ winnerIsDealer: true, honba: 2, riichiSticks: 1 })).toEqual({
      riichiStickDelta: -1,
      honbaDelta: 1,
      advanceRound: false
    });
  });

  it("advances after child win and clears honba", () => {
    expect(buildWinEventAdjustments({ winnerIsDealer: false, honba: 2, riichiSticks: 0 })).toEqual({
      riichiStickDelta: 0,
      honbaDelta: -2,
      advanceRound: true
    });
  });
});

describe("score hand preview", () => {
  it("combines engine output with room state into an applyEvent payload", () => {
    const engine: EngineApi = {
      parseHand: () => ({ divisions: true }),
      detectYaku: () => ({
        yaku: [{ id: "riichi", name: "Riichi", han: 1 }],
        han: 1,
        yakuHan: 1,
        doraHan: 0,
        yakuman: 0,
        hasYaku: true
      }),
      calcFu: () => ({ fu: 30, rawFu: 30, details: [] }),
      calcScore: () => score({ ron: 4500, total: 5500, riichiBonus: 1000 })
    };

    const preview = buildScoreHandPreview(
      {
        winnerOpenid: "south",
        loserOpenid: "west",
        winType: "ron",
        tiles: ["1m", "2m", "3m", "4p", "5p", "6p", "2s", "3s", "4s", "7s", "8s", "9s", "5z", "5z"],
        winningTile: "3m",
        riichi: true
      },
      room(),
      engine
    );

    expect(preview.applyEvent).toMatchObject({
      type: "win",
      deltas: { east: 0, south: 5500, west: -4500, north: 0 },
      riichiStickDelta: -1,
      honbaDelta: -2,
      advanceRound: true
    });
    expect(preview.context).toMatchObject({ seatWind: "south", prevalentWind: "east", riichi: true });
    expect(preview.note).toContain("拍照算点");
  });

  it("passes room score rules through to engine scoring", () => {
    let scoreInput: Parameters<EngineApi["calcScore"]>[0] | undefined;
    const engine: EngineApi = {
      parseHand: () => ({ divisions: true }),
      detectYaku: () => ({
        yaku: [{ id: "riichi", name: "Riichi", han: 1 }],
        han: 3,
        yakuHan: 3,
        doraHan: 0,
        yakuman: 0,
        hasYaku: true
      }),
      calcFu: () => ({ fu: 60, rawFu: 60, details: [] }),
      calcScore: (input) => {
        scoreInput = input;
        return score({ ron: 8000, total: 9000, riichiBonus: 1000 });
      }
    };

    buildScoreHandPreview(
      {
        winnerOpenid: "south",
        loserOpenid: "west",
        winType: "ron",
        tiles: ["1m", "2m", "3m", "4p", "5p", "6p", "2s", "3s", "4s", "7s", "8s", "9s", "5z", "5z"],
        winningTile: "3m"
      },
      {
        ...room(),
        rules: {
          length: "hanchan",
          startScore: 25000,
          returnScore: 30000,
          uma: [20, 10, -10, -20],
          tobi: true,
          kiriageMangan: true,
          tsumoLoss: true
        }
      },
      engine
    );

    expect(scoreInput).toMatchObject({
      kiriageMangan: true,
      tsumoLoss: true
    });
  });
});
