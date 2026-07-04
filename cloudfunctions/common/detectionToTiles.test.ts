import { describe, expect, it } from "vitest";
import { detectionToTiles, mapRoboflowClassToTile } from "./detectionToTiles";
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

describe("detectionToTiles ordering", () => {
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

describe("Roboflow class mapping", () => {
  it("accepts direct engine notation", () => {
    expect(mapRoboflowClassToTile("1m")).toBe("1m");
    expect(mapRoboflowClassToTile("9p")).toBe("9p");
    expect(mapRoboflowClassToTile("7z")).toBe("7z");
  });

  it("accepts number plus suit names with case and separator tolerance", () => {
    expect(mapRoboflowClassToTile("1man")).toBe("1m");
    expect(mapRoboflowClassToTile("1-man")).toBe("1m");
    expect(mapRoboflowClassToTile("2-Pin")).toBe("2p");
    expect(mapRoboflowClassToTile("3 sou")).toBe("3s");
    expect(mapRoboflowClassToTile("4_Bamboo")).toBe("4s");
  });

  it("accepts English honor names", () => {
    expect(mapRoboflowClassToTile("east")).toBe("1z");
    expect(mapRoboflowClassToTile("South")).toBe("2z");
    expect(mapRoboflowClassToTile("west")).toBe("3z");
    expect(mapRoboflowClassToTile("north")).toBe("4z");
    expect(mapRoboflowClassToTile("white dragon")).toBe("5z");
    expect(mapRoboflowClassToTile("haku")).toBe("5z");
    expect(mapRoboflowClassToTile("green-dragon")).toBe("6z");
    expect(mapRoboflowClassToTile("hatsu")).toBe("6z");
    expect(mapRoboflowClassToTile("red")).toBe("7z");
    expect(mapRoboflowClassToTile("red dragon")).toBe("7z");
    expect(mapRoboflowClassToTile("chun")).toBe("7z");
  });

  it("accepts red fives before red dragon aliases", () => {
    expect(mapRoboflowClassToTile("0m")).toBe("0m");
    expect(mapRoboflowClassToTile("red5m")).toBe("0m");
    expect(mapRoboflowClassToTile("aka5p")).toBe("0p");
    expect(mapRoboflowClassToTile("5sr")).toBe("0s");
    expect(mapRoboflowClassToTile("Aka 5 Man")).toBe("0m");
    expect(mapRoboflowClassToTile("5-pin-red")).toBe("0p");
  });
});

describe("detectionToTiles errors and confidence", () => {
  it("throws with original class names for unknown classes", () => {
    expect(() =>
      detectionToTiles([
        detection("1m", 100, 100),
        detection("mystery-tile", 200, 100),
        detection("another unknown", 300, 100)
      ])
    ).toThrow("未知 Roboflow 类别：mystery-tile、another unknown");
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
