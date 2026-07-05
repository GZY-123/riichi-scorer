import { describe, expect, it } from "vitest";
import * as engineModule from "../../utils/engine-lib/index.js";
import {
  resolveRules,
  rulesSummary,
  SettlementEngineApi,
  settleView
} from "./settlementLogic";

const engine = engineModule as unknown as SettlementEngineApi;

const players = [
  { openid: "east", nickName: "东家", seat: "east" as const, score: 30000 },
  { openid: "south", nickName: "南家", seat: "south" as const, score: 30000 },
  { openid: "west", nickName: "西家", seat: "west" as const, score: 25000 },
  { openid: "north", nickName: "北家", seat: "north" as const, score: 15000 }
];

describe("settlement view", () => {
  it("falls back to default room rules for old room documents", () => {
    const rules = resolveRules({ mode: "4p" });

    expect(rules).toMatchObject({
      length: "hanchan",
      startScore: 25000,
      returnScore: 30000,
      uma: [20, 10, -10, -20]
    });
    expect(rulesSummary("4p", rules)).toBe("半庄 · 马10-20");
  });

  it("settles by engine rank, breaking ties by starting seat", () => {
    const rules = resolveRules({ mode: "4p" });
    const rows = settleView({
      players,
      mode: "4p",
      rules,
      riichiSticks: 0,
      engine
    });

    expect(rows.map((row) => [row.openid, row.rank, row.finalScoreText])).toEqual([
      ["east", 1, "+40.0"],
      ["south", 2, "+10.0"],
      ["west", 3, "-15.0"],
      ["north", 4, "-35.0"]
    ]);
  });

  it("adds leftover riichi sticks to the top player before final points", () => {
    const rules = resolveRules({ mode: "4p" });
    const rows = settleView({
      players,
      mode: "4p",
      rules,
      riichiSticks: 1,
      engine
    });

    expect(rows[0]).toMatchObject({
      openid: "east",
      rawScore: 30000,
      adjustedScore: 31000,
      finalScoreText: "+41.0",
      scoreClass: "score-positive",
      rankClass: "rank-1"
    });
  });
});
