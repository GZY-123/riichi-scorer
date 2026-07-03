import { describe, expect, it } from "vitest";
import { parseHand } from "../src/index.js";

describe("parseHand", () => {
  it("returns multiple divisions for ambiguous normal hands", () => {
    const divisions = parseHand(["1m", "1m", "2m", "2m", "3m", "3m", "4m", "4m", "5m", "5m", "6m", "6m", "7m", "7m"], "7m");
    expect(divisions.length).toBeGreaterThan(1);
    expect(divisions.some((division) => division.pattern === "seven-pairs")).toBe(true);
    expect(divisions.some((division) => division.pattern === "standard")).toBe(true);
  });

  it("decomposes seven pairs", () => {
    const divisions = parseHand(["1m", "1m", "2p", "2p", "3s", "3s", "4m", "4m", "5p", "5p", "6s", "6s", "7z"], "7z");
    expect(divisions.some((division) => division.pattern === "seven-pairs")).toBe(true);
  });

  it("decomposes thirteen orphans and detects 13-sided wait", () => {
    const before = ["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"];
    const divisions = parseHand(before, "1m");
    const kokushi = divisions.find((division) => division.pattern === "thirteen-orphans");
    expect(kokushi?.isThirteenSided).toBe(true);
  });

  it("rejects invalid tile counts and five copies", () => {
    expect(() => parseHand(["1m", "1m"], "1m")).toThrow(/expected/i);
    expect(() =>
      parseHand(["1m", "1m", "1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m"], "9m")
    ).toThrow(/more than four/i);
  });
});
