import { describe, expect, it } from "vitest";
import { parseVisionRecognition } from "./recognition";
import { assertTileNotation, isTileNotation, parseTileText } from "./tileNotation";

describe("tile notation validation", () => {
  it("accepts engine tile notation and red fives", () => {
    expect(isTileNotation("1m", "4p")).toBe(true);
    expect(isTileNotation("9s", "4p")).toBe(true);
    expect(isTileNotation("7z", "4p")).toBe(true);
    expect(isTileNotation("0p", "4p")).toBe(true);
  });

  it("rejects invalid tiles and sanma removed manzu tiles", () => {
    expect(() => assertTileNotation("8z", "4p")).toThrow("不是有效字牌");
    expect(() => assertTileNotation("2m", "3p")).toThrow("三麻不使用 2m");
    expect(isTileNotation("10m", "4p")).toBe(false);
  });

  it("splits freeform tile text", () => {
    expect(parseTileText("1m 2m,3p，4s、5z/0p")).toEqual(["1m", "2m", "3p", "4s", "5z", "0p"]);
  });
});

describe("vision recognition parsing", () => {
  it("parses fenced JSON with recognized tiles and melds", () => {
    const result = parseVisionRecognition(
      [
        "```json",
        "{",
        "  \"tiles\": [\"1m\", \"2m\", \"3m\", \"0p\"],",
        "  \"melds\": [{\"type\":\"pon\",\"tiles\":[\"5z\",\"5z\",\"5z\"]}],",
        "  \"confidence\": 92",
        "}",
        "```"
      ].join("\n"),
      "4p"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tiles).toEqual(["1m", "2m", "3m", "0p"]);
      expect(result.value.melds[0]).toMatchObject({ type: "pon", tiles: ["5z", "5z", "5z"] });
      expect(result.value.confidence).toBe(0.92);
    }
  });

  it("parses JSON embedded after explanatory text", () => {
    const result = parseVisionRecognition('结果如下：\n{"tiles":["1p"],"confidence":0.5}', "4p");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tiles).toEqual(["1p"]);
    }
  });

  it("returns an explicit parse error code for malformed JSON", () => {
    const result = parseVisionRecognition("```json\n{\"tiles\": [\"1m\",]\n```", "4p");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("VISION_JSON_PARSE_FAILED");
    }
  });

  it("returns an explicit validation error code for invalid tile payloads", () => {
    const result = parseVisionRecognition("{\"tiles\":[\"8z\"],\"confidence\":1}", "4p");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("VISION_JSON_INVALID");
      expect(result.message).toContain("不是有效字牌");
    }
  });
});
