import { describe, expect, it } from "vitest";
import { analyzeDraws, calcWaits } from "./tenpai";

function waitTiles(tiles: string[], mode: "3p" | "4p" = "4p"): string[] {
  return calcWaits(tiles, mode).waits.map((wait) => wait.tile);
}

describe("calcWaits", () => {
  it("finds a two-sided wait", () => {
    const result = calcWaits(["2m", "3m", "4m", "5m", "6m", "7m", "2p", "3p", "4p", "8s", "8s", "4s", "5s"], "4p");

    expect(result.error).toBeUndefined();
    expect(result.waits).toEqual([
      { tile: "3s", remaining: 4 },
      { tile: "6s", remaining: 4 }
    ]);
  });

  it("finds a single tile wait", () => {
    expect(waitTiles(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5s"])).toEqual([
      "5s"
    ]);
  });

  it("finds pure nine gates as nine wait types", () => {
    expect(waitTiles(["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m", "9m"])).toEqual([
      "1m",
      "2m",
      "3m",
      "4m",
      "5m",
      "6m",
      "7m",
      "8m",
      "9m"
    ]);
  });

  it("returns an empty wait list for a non-tenpai hand", () => {
    expect(waitTiles(["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "3z", "5z"])).toEqual([]);
  });

  it("counts red fives as ordinary fives for remaining tiles", () => {
    const result = calcWaits(["0m", "5m", "5m", "4m", "6m", "1p", "2p", "3p", "1s", "2s", "3s", "7s", "7s"], "4p");

    expect(result.waits.find((wait) => wait.tile === "5m")).toEqual({ tile: "5m", remaining: 1 });
  });

  it("validates the 13 tile input length", () => {
    const result = calcWaits(["1m", "2m", "3m"], "4p");

    expect(result.waits).toEqual([]);
    expect(result.error).toContain("13 张");
  });

  it("filters removed manzu tiles in three-player mode", () => {
    const result = calcWaits(["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"], "3p");

    expect(result.error).toBeUndefined();
    expect(result.waits.map((wait) => wait.tile)).toEqual(["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"]);
    expect(result.waits.some((wait) => /^[2-8]m$/.test(wait.tile))).toBe(false);
  });
});

describe("analyzeDraws", () => {
  it("finds the 9m draw that makes 111m 2345678m 99m tenpai", () => {
    const analyses = analyzeDraws(["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "9m"], "4p");
    const draw9m = analyses.find((analysis) => analysis.draw === "9m");

    expect(draw9m).toBeDefined();
    expect(draw9m?.waits.length).toBeGreaterThan(0);
    expect(draw9m?.totalRemaining).toBe(draw9m?.waits.reduce((sum, wait) => sum + wait.remaining, 0));
  });

  it("sorts draw candidates by total remaining tiles", () => {
    const analyses = analyzeDraws(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p"], "4p");

    expect(analyses.length).toBeGreaterThan(1);
    for (let index = 1; index < analyses.length; index += 1) {
      expect(analyses[index - 1].totalRemaining).toBeGreaterThanOrEqual(analyses[index].totalRemaining);
    }
  });

  it("filters removed manzu draw candidates in three-player mode", () => {
    const analyses = analyzeDraws(["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z"], "3p");

    expect(analyses.some((analysis) => /^[2-8]m$/.test(analysis.draw))).toBe(false);
    expect(analyses.find((analysis) => analysis.draw === "7z")?.waits.length).toBeGreaterThan(0);
  });
});
