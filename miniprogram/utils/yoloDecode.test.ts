import { describe, expect, it } from "vitest";
import { decodeYoloOutput } from "./yoloDecode";
import type { LetterboxInfo } from "./yoloDecode";

const LEGACY_ROWS = 42;
const SEGMENTATION_ROWS = 74;
const ANCHORS = 6;

const squareLetterbox: LetterboxInfo = {
  inputWidth: 640,
  inputHeight: 640,
  originalWidth: 640,
  originalHeight: 640,
  scale: 1,
  padX: 0,
  padY: 0
};

function tensor(rows = LEGACY_ROWS): Float32Array {
  return new Float32Array(rows * ANCHORS);
}

function setAnchor(
  output: Float32Array,
  anchorIndex: number,
  box: { cx: number; cy: number; width: number; height: number },
  classIndex: number,
  score: number
) {
  output[anchorIndex] = box.cx;
  output[ANCHORS + anchorIndex] = box.cy;
  output[ANCHORS * 2 + anchorIndex] = box.width;
  output[ANCHORS * 3 + anchorIndex] = box.height;
  output[ANCHORS * (4 + classIndex) + anchorIndex] = score;
}

describe("decodeYoloOutput", () => {
  it("decodes legacy 42-row tensors and maps class indexes", () => {
    const output = tensor();
    setAnchor(output, 0, { cx: 100, cy: 120, width: 40, height: 60 }, 0, 0.8);
    setAnchor(output, 1, { cx: 200, cy: 120, width: 40, height: 60 }, 4, 0.44);
    setAnchor(output, 2, { cx: 300, cy: 120, width: 40, height: 60 }, 37, 0.7);

    const detections = decodeYoloOutput({
      output,
      outputShape: [1, LEGACY_ROWS, ANCHORS],
      letterbox: squareLetterbox
    });

    expect(detections.map((detection) => detection.class)).toEqual(["0m", "9s"]);
  });

  it("decodes 74-row segmentation tensors while ignoring mask coefficients", () => {
    const output = tensor(SEGMENTATION_ROWS);
    setAnchor(output, 0, { cx: 100, cy: 120, width: 40, height: 60 }, 4, 0.82);
    setAnchor(output, 1, { cx: 200, cy: 120, width: 40, height: 60 }, 5, 0.2);
    output[ANCHORS * LEGACY_ROWS + 1] = 0.99;
    output[ANCHORS * (LEGACY_ROWS + 20) + 2] = 0.98;

    const detections = decodeYoloOutput({
      output,
      outputShape: [1, SEGMENTATION_ROWS, ANCHORS],
      letterbox: squareLetterbox
    });

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      class: "1m"
    });
    expect(detections[0].confidence).toBeCloseTo(0.82);
  });

  it("restores letterboxed coordinates back to original image space", () => {
    const output = tensor();
    setAnchor(output, 0, { cx: 320, cy: 320, width: 64, height: 128 }, 20, 0.9);

    const detections = decodeYoloOutput({
      output,
      outputShape: [1, LEGACY_ROWS, ANCHORS],
      letterbox: {
        inputWidth: 640,
        inputHeight: 640,
        originalWidth: 1280,
        originalHeight: 640,
        scale: 0.5,
        padX: 0,
        padY: 160
      }
    });

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      class: "5m",
      x: 640,
      y: 320,
      width: 128,
      height: 256
    });
  });

  it("applies IoU NMS and keeps the highest confidence box", () => {
    const output = tensor();
    setAnchor(output, 0, { cx: 120, cy: 120, width: 60, height: 80 }, 12, 0.9);
    setAnchor(output, 1, { cx: 122, cy: 121, width: 60, height: 80 }, 13, 0.7);
    setAnchor(output, 2, { cx: 300, cy: 120, width: 60, height: 80 }, 36, 0.8);

    const detections = decodeYoloOutput({
      output,
      outputShape: [1, LEGACY_ROWS, ANCHORS],
      letterbox: squareLetterbox
    });

    expect(detections.map((detection) => detection.class)).toEqual(["3m", "9p"]);
  });

  it("rejects unexpected tensor shapes", () => {
    expect(() =>
      decodeYoloOutput({
        output: tensor(),
        outputShape: [1, LEGACY_ROWS - 1, ANCHORS],
        letterbox: squareLetterbox
      })
    ).toThrow("YOLO 输出 rows 至少应为");
  });
});
