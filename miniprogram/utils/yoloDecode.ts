export interface LetterboxInfo {
  inputWidth: number;
  inputHeight: number;
  originalWidth: number;
  originalHeight: number;
  scale: number;
  padX: number;
  padY: number;
}

export interface YoloDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  confidence: number;
}

export interface DecodeYoloOptions {
  output: ArrayLike<number>;
  outputShape?: readonly number[];
  letterbox: LetterboxInfo;
  confidenceThreshold?: number;
  nmsThreshold?: number;
}

interface Candidate extends YoloDetection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  classIndex: number;
}

export const YOLO_TILE_CLASSES = [
  "0m",
  "0p",
  "0s",
  "0z",
  "1m",
  "1p",
  "1s",
  "1z",
  "2m",
  "2p",
  "2s",
  "2z",
  "3m",
  "3p",
  "3s",
  "3z",
  "4m",
  "4p",
  "4s",
  "4z",
  "5m",
  "5p",
  "5s",
  "5z",
  "6m",
  "6p",
  "6s",
  "6z",
  "7m",
  "7p",
  "7s",
  "7z",
  "8m",
  "8p",
  "8s",
  "9m",
  "9p",
  "9s"
] as const;

const BOX_ROWS = 4;
const CLASS_COUNT = YOLO_TILE_CLASSES.length;
const MIN_OUTPUT_ROWS = BOX_ROWS + CLASS_COUNT;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;
const DEFAULT_NMS_THRESHOLD = 0.45;

export function decodeYoloOutput(options: DecodeYoloOptions): YoloDetection[] {
  const confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const nmsThreshold = options.nmsThreshold ?? DEFAULT_NMS_THRESHOLD;
  const shape = normalizeOutputShape(options.outputShape, options.output.length);
  const rowStride = shape.anchorCount;
  const candidates: Candidate[] = [];

  for (let anchorIndex = 0; anchorIndex < shape.anchorCount; anchorIndex += 1) {
    const classScore = maxClassScore(options.output, rowStride, anchorIndex);
    if (classScore.score < confidenceThreshold) {
      continue;
    }

    const cx = options.output[anchorIndex];
    const cy = options.output[rowStride + anchorIndex];
    const width = options.output[rowStride * 2 + anchorIndex];
    const height = options.output[rowStride * 3 + anchorIndex];
    const candidate = restoreBox({
      cx,
      cy,
      width,
      height,
      classIndex: classScore.classIndex,
      confidence: classScore.score,
      letterbox: options.letterbox
    });

    if (candidate !== undefined) {
      candidates.push(candidate);
    }
  }

  return nonMaxSuppression(candidates, nmsThreshold).map(({ x1: _x1, y1: _y1, x2: _x2, y2: _y2, classIndex: _classIndex, ...detection }) => detection);
}

function normalizeOutputShape(
  outputShape: readonly number[] | undefined,
  dataLength: number
): { anchorCount: number } {
  if (outputShape === undefined || outputShape.length === 0) {
    throw new Error("YOLO 输出 shape 缺失，无法推导布局");
  }

  if (outputShape.length !== 3 || outputShape[0] !== 1) {
    throw new Error(`YOLO 输出 shape 应为 [1,rows,anchors]，实际为 [${outputShape.join(",")}]`);
  }

  const rowCount = outputShape[1];
  const anchorCount = outputShape[2];
  if (!Number.isSafeInteger(rowCount) || rowCount < MIN_OUTPUT_ROWS) {
    throw new Error(`YOLO 输出 rows 至少应为 ${MIN_OUTPUT_ROWS}，实际为 ${rowCount}`);
  }
  if (!Number.isSafeInteger(anchorCount) || anchorCount <= 0) {
    throw new Error(`YOLO 输出 anchor 数无效：${anchorCount}`);
  }
  if (dataLength < rowCount * anchorCount) {
    throw new Error(`YOLO 输出长度不足：需要 ${rowCount * anchorCount}，实际 ${dataLength}`);
  }
  return { anchorCount };
}

function maxClassScore(
  output: ArrayLike<number>,
  rowStride: number,
  anchorIndex: number
): { classIndex: number; score: number } {
  let classIndex = 0;
  let score = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < CLASS_COUNT; index += 1) {
    const value = output[rowStride * (BOX_ROWS + index) + anchorIndex];
    if (value > score) {
      score = value;
      classIndex = index;
    }
  }
  return { classIndex, score };
}

function restoreBox(input: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  classIndex: number;
  confidence: number;
  letterbox: LetterboxInfo;
}): Candidate | undefined {
  if (![input.cx, input.cy, input.width, input.height, input.confidence].every(Number.isFinite)) {
    return undefined;
  }
  if (input.width <= 0 || input.height <= 0 || input.letterbox.scale <= 0) {
    return undefined;
  }

  const left = (input.cx - input.width / 2 - input.letterbox.padX) / input.letterbox.scale;
  const top = (input.cy - input.height / 2 - input.letterbox.padY) / input.letterbox.scale;
  const right = (input.cx + input.width / 2 - input.letterbox.padX) / input.letterbox.scale;
  const bottom = (input.cy + input.height / 2 - input.letterbox.padY) / input.letterbox.scale;
  const x1 = clamp(left, 0, input.letterbox.originalWidth);
  const y1 = clamp(top, 0, input.letterbox.originalHeight);
  const x2 = clamp(right, 0, input.letterbox.originalWidth);
  const y2 = clamp(bottom, 0, input.letterbox.originalHeight);
  const width = x2 - x1;
  const height = y2 - y1;

  if (width <= 0 || height <= 0) {
    return undefined;
  }

  return {
    x: x1 + width / 2,
    y: y1 + height / 2,
    width,
    height,
    class: YOLO_TILE_CLASSES[input.classIndex],
    confidence: clamp(input.confidence, 0, 1),
    x1,
    y1,
    x2,
    y2,
    classIndex: input.classIndex
  };
}

function nonMaxSuppression(candidates: readonly Candidate[], threshold: number): Candidate[] {
  const kept: Candidate[] = [];
  const sorted = [...candidates].sort((left, right) => right.confidence - left.confidence);

  for (const candidate of sorted) {
    if (kept.every((existing) => calculateIou(candidate, existing) <= threshold)) {
      kept.push(candidate);
    }
  }

  return kept;
}

function calculateIou(left: Candidate, right: Candidate): number {
  const x1 = Math.max(left.x1, right.x1);
  const y1 = Math.max(left.y1, right.y1);
  const x2 = Math.min(left.x2, right.x2);
  const y2 = Math.min(left.y2, right.y2);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) {
    return 0;
  }

  const leftArea = (left.x2 - left.x1) * (left.y2 - left.y1);
  const rightArea = (right.x2 - right.x1) * (right.y2 - right.y1);
  return intersection / (leftArea + rightArea - intersection);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
