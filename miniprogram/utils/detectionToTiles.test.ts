import { describe, expect, it } from "vitest";
import { detectionToTiles, mapDetectionClassToTile } from "./detectionToTiles";
import type { TileDetection } from "./detectionToTiles";

function detection(
  tileClass: string,
  x: number,
  y: number,
  confidence = 0.9,
  width = 42,
  height = 60
): TileDetection {
  return {
    x,
    y,
    width,
    height,
    class: tileClass,
    confidence
  };
}

describe("miniprogram detectionToTiles ordering", () => {
  it("sorts a single row from left to right", () => {
    const result = detectionToTiles([
      detection("3m", 300, 100),
      detection("1m", 100, 104),
      detection("2m", 200, 96)
    ]);

    expect(result.tiles).toEqual(["1m", "2m", "3m"]);
  });

  it("clusters rows from top to bottom, then sorts each row left to right", () => {
    const result = detectionToTiles([
      detection("4p", 210, 205),
      detection("1m", 220, 100),
      detection("3p", 110, 198),
      detection("2m", 90, 112)
    ]);

    expect(result.tiles).toEqual(["2m", "1m", "3p", "4p"]);
  });
});

describe("miniprogram detection class mapping", () => {
  it("accepts direct engine notation and common aliases", () => {
    expect(mapDetectionClassToTile("1m")).toBe("1m");
    expect(mapDetectionClassToTile("red5m")).toBe("0m");
    expect(mapDetectionClassToTile("5-pin-red")).toBe("0p");
    expect(mapDetectionClassToTile("white dragon")).toBe("5z");
    expect(mapDetectionClassToTile("green-dragon")).toBe("6z");
  });

  it("throws with original class names for unknown classes", () => {
    expect(() =>
      detectionToTiles([
        detection("1m", 100, 100),
        detection("mystery-tile", 200, 100),
        detection("another unknown", 300, 100)
      ])
    ).toThrow("未知检测类别：mystery-tile、another unknown");
  });
});

describe("miniprogram detection cleanup", () => {
  it("ignores 0z and face-down classes", () => {
    const result = detectionToTiles([
      detection("7z", 10, 10),
      detection("0z", 40, 10, 0.8),
      detection("Back", 70, 10, 0.7),
      detection("6z", 100, 10, 0.85)
    ]);

    expect(result.tiles).toEqual(["7z", "6z"]);
  });

  it("trims tiles beyond four copies and lowers confidence", () => {
    const result = detectionToTiles([
      detection("5m", 10, 10, 0.95),
      detection("5m", 40, 10, 0.95),
      detection("0m", 70, 10, 0.95),
      detection("5m", 100, 10, 0.95),
      detection("5m", 130, 10, 0.95)
    ]);

    expect(result.tiles).toEqual(["5m", "5m", "0m", "5m"]);
    expect(result.confidence).toBe(0.3);
  });

  it("combines min and average confidence with equal weights", () => {
    const result = detectionToTiles([
      detection("1m", 100, 100, 0.8),
      detection("2m", 200, 100, 0.6),
      detection("3m", 300, 100, 0.4)
    ]);

    expect(result.confidence).toBeCloseTo(0.5);
  });
});
