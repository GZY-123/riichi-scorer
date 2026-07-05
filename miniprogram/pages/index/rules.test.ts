import { describe, expect, it } from "vitest";
import {
  defaultRoomRules,
  rulesSummary,
  umaOptionIndex,
  umaOptionsForMode,
  validateRoomRules
} from "./rules";

describe("index room rules", () => {
  it("maps four-player uma picker options to engine order", () => {
    const options = umaOptionsForMode("4p");

    expect(options.map((option) => option.label)).toEqual(["10-20", "5-10", "无马"]);
    expect(options.map((option) => option.value)).toEqual([
      [20, 10, -10, -20],
      [10, 5, -5, -10],
      [0, 0, 0, 0]
    ]);
    expect(umaOptionIndex("4p", [10, 5, -5, -10])).toBe(1);
  });

  it("maps three-player uma picker options to engine order", () => {
    const options = umaOptionsForMode("3p");

    expect(options.map((option) => option.label)).toEqual(["15-0", "10-0", "无马"]);
    expect(options.map((option) => option.value)).toEqual([
      [15, 0, -15],
      [10, 0, -10],
      [0, 0, 0]
    ]);
    expect(umaOptionIndex("3p", [0, 0, 0])).toBe(2);
  });

  it("builds concise rule summaries", () => {
    expect(rulesSummary("4p", defaultRoomRules("4p"))).toBe("半庄 · 25000/30000 · 马10-20 · 击飞");
    expect(
      rulesSummary("3p", {
        ...defaultRoomRules("3p"),
        length: "east",
        uma: [0, 0, 0],
        tobi: false,
        kiriageMangan: true,
        tsumoLoss: true
      })
    ).toBe("东风 · 35000/40000 · 无马 · 切上 · 自摸损");
  });

  it("validates create-room rules before cloud calls", () => {
    expect(validateRoomRules("4p", defaultRoomRules("4p"))).toBeNull();
    expect(validateRoomRules("4p", { ...defaultRoomRules("4p"), startScore: 25050 })).toBe(
      "起始点必须是 1000-99999 的百点整数"
    );
    expect(validateRoomRules("4p", { ...defaultRoomRules("4p"), returnScore: 24000 })).toBe(
      "返点不能低于起始点"
    );
    expect(validateRoomRules("3p", { ...defaultRoomRules("3p"), uma: [15, 5, -15] })).toBe(
      "顺位马总和必须为 0"
    );
  });
});
