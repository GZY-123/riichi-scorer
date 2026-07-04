export interface TileDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  confidence: number;
}

export interface DetectionToTilesResult {
  tiles: string[];
  confidence: number;
}

interface DetectionWithTile {
  detection: TileDetection;
  tile: string;
}

interface DetectionRow {
  centerY: number;
  count: number;
  items: DetectionWithTile[];
}

const HONOR_TILE_BY_CLASS: Record<string, string> = {
  east: "1z",
  ton: "1z",
  south: "2z",
  nan: "2z",
  west: "3z",
  sha: "3z",
  north: "4z",
  pei: "4z",
  white: "5z",
  whitedragon: "5z",
  haku: "5z",
  green: "6z",
  greendragon: "6z",
  hatsu: "6z",
  red: "7z",
  reddragon: "7z",
  chun: "7z",
  chung: "7z"
};

// 牌背/盖牌类别：不属于手牌，直接忽略
const IGNORED_CLASSES = new Set(["0z", "back", "ura", "facedown", "hidden"]);

export function detectionToTiles(detections: readonly TileDetection[]): DetectionToTilesResult {
  const mapped: DetectionWithTile[] = [];
  const unknownClasses: string[] = [];

  for (const detection of detections) {
    if (IGNORED_CLASSES.has(normalizeClassName(detection.class))) {
      continue;
    }
    const tile = mapRoboflowClassToTile(detection.class);
    if (tile === undefined) {
      unknownClasses.push(detection.class);
      continue;
    }
    mapped.push({ detection, tile });
  }

  if (unknownClasses.length > 0) {
    throw new Error(`未知 Roboflow 类别：${uniquePreserveOrder(unknownClasses).join("、")}`);
  }

  const tiles = clusterRows(mapped)
    .flatMap((row) =>
      [...row.items]
        .sort((left, right) => left.detection.x - right.detection.x)
        .map((item) => item.tile)
    );

  return {
    tiles,
    confidence: calculateDetectionConfidence(detections)
  };
}

export function mapRoboflowClassToTile(className: string): string | undefined {
  const normalized = normalizeClassName(className);
  if (!normalized) {
    return undefined;
  }

  const redFive = parseRedFive(normalized);
  if (redFive !== undefined) {
    return redFive;
  }

  const direct = normalized.match(/^([0-9])([mpsz])$/);
  if (direct !== null) {
    const rank = Number(direct[1]);
    const suit = direct[2];
    if (suit === "z") {
      return rank >= 1 && rank <= 7 ? `${rank}z` : undefined;
    }
    if (rank === 0 || (rank >= 1 && rank <= 9)) {
      return `${rank}${suit}`;
    }
    return undefined;
  }

  const numberedSuit = normalized.match(/^([1-9])([a-z]+)$/);
  if (numberedSuit !== null) {
    const suit = parseSuitAlias(numberedSuit[2]);
    if (suit !== undefined) {
      return `${numberedSuit[1]}${suit}`;
    }
  }

  return HONOR_TILE_BY_CLASS[normalized];
}

function clusterRows(items: readonly DetectionWithTile[]): DetectionRow[] {
  if (items.length === 0) {
    return [];
  }

  const averageHeight =
    items.reduce((sum, item) => sum + Math.max(0, item.detection.height), 0) / items.length;
  const threshold = averageHeight * 0.6;
  const rows: DetectionRow[] = [];

  for (const item of [...items].sort((left, right) => left.detection.y - right.detection.y)) {
    const row = findClosestRow(rows, item.detection.y, threshold);
    if (row === undefined) {
      rows.push({
        centerY: item.detection.y,
        count: 1,
        items: [item]
      });
      continue;
    }
    row.items.push(item);
    row.centerY = (row.centerY * row.count + item.detection.y) / (row.count + 1);
    row.count += 1;
  }

  return rows.sort((left, right) => left.centerY - right.centerY);
}

function findClosestRow(
  rows: readonly DetectionRow[],
  y: number,
  threshold: number
): DetectionRow | undefined {
  let closest: DetectionRow | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const distance = Math.abs(row.centerY - y);
    if (distance < threshold && distance < closestDistance) {
      closest = row;
      closestDistance = distance;
    }
  }
  return closest;
}

function calculateDetectionConfidence(detections: readonly TileDetection[]): number {
  if (detections.length === 0) {
    return 0;
  }
  const confidences = detections.map((detection) => clamp01(detection.confidence));
  const min = Math.min(...confidences);
  const average = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return min * 0.5 + average * 0.5;
}

function parseRedFive(normalized: string): string | undefined {
  const direct = normalized.match(/^0([mps])$/);
  if (direct !== null) {
    return `0${direct[1]}`;
  }

  const prefixShort = normalized.match(/^(?:red|aka|akadora)5([mps])$/);
  if (prefixShort !== null) {
    return `0${prefixShort[1]}`;
  }

  const suffixShort = normalized.match(/^5([mps])(?:r|red|aka|akadora)$/);
  if (suffixShort !== null) {
    return `0${suffixShort[1]}`;
  }

  const prefixLong = normalized.match(/^(?:red|aka|akadora)(?:five|5)([a-z]+)$/);
  if (prefixLong !== null) {
    const suit = parseSuitAlias(prefixLong[1]);
    return suit === undefined ? undefined : `0${suit}`;
  }

  const suffixLong = normalized.match(/^5([a-z]+)(?:r|red|aka|akadora)$/);
  if (suffixLong !== null) {
    const suit = parseSuitAlias(suffixLong[1]);
    return suit === undefined ? undefined : `0${suit}`;
  }

  return undefined;
}

function parseSuitAlias(value: string): "m" | "p" | "s" | undefined {
  if (["m", "man", "manzu", "wan", "wanzu", "character", "characters", "crak"].includes(value)) {
    return "m";
  }
  if (["p", "pin", "pinzu", "circle", "circles", "dot", "dots", "tong"].includes(value)) {
    return "p";
  }
  if (["s", "sou", "souzu", "so", "bamboo", "bamboos", "bam", "stick", "sticks"].includes(value)) {
    return "s";
  }
  return undefined;
}

function normalizeClassName(className: string): string {
  return className.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function uniquePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}
