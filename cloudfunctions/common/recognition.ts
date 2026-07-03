import type { GameMode } from "./roomLogic";
import { MeldInput, normalizeTileForCount, validateMelds, validateTileList } from "./tileNotation";

export interface RecognizedTilesPayload {
  tiles: string[];
  melds: MeldInput[];
  confidence: number;
  rawText: string;
}

export interface RecognitionParseError {
  ok: false;
  errorCode: "VISION_JSON_PARSE_FAILED" | "VISION_JSON_INVALID";
  message: string;
  rawText: string;
}

export interface RecognitionParseSuccess {
  ok: true;
  value: RecognizedTilesPayload;
}

export type RecognitionParseResult = RecognitionParseSuccess | RecognitionParseError;

interface LooseRecognitionPayload {
  tiles?: unknown;
  melds?: unknown;
  confidence?: unknown;
}

export function parseVisionRecognition(rawText: string, mode: GameMode): RecognitionParseResult {
  const candidate = extractJsonCandidate(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(candidate);
  } catch {
    return {
      ok: false,
      errorCode: "VISION_JSON_PARSE_FAILED",
      message: "视觉模型返回不是可解析的 JSON",
      rawText
    };
  }

  try {
    const value = normalizeRecognitionPayload(parsed, mode, rawText);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      errorCode: "VISION_JSON_INVALID",
      message: error instanceof Error ? error.message : "视觉模型返回字段不符合要求",
      rawText
    };
  }
}

export function extractJsonCandidate(rawText: string): string {
  const trimmed = rawText.trim().replace(/^\uFEFF/, "");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function normalizeRecognitionPayload(
  parsed: unknown,
  mode: GameMode,
  rawText: string
): RecognizedTilesPayload {
  if (!isRecord(parsed)) {
    throw new Error("视觉模型 JSON 顶层必须是对象");
  }

  const payload = parsed as LooseRecognitionPayload;
  if (!Array.isArray(payload.tiles)) {
    throw new Error("视觉模型 JSON 必须包含 tiles 数组");
  }

  const validated = validateTileList(payload.tiles.map(String), mode, "识别牌面", {
    allowEmpty: false
  });
  const melds = normalizeLooseMelds(payload.melds, mode);

  // 视觉模型计数易出错：同种牌超过 4 张时裁掉多余的，压低置信度交给人工修正，而不是让整次识别报废
  const counts = new Map<string, number>();
  for (const tile of melds.flatMap((meld) => meld.tiles)) {
    const key = normalizeTileForCount(tile, mode);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const tiles: string[] = [];
  let trimmedCount = 0;
  for (const tile of validated) {
    const key = normalizeTileForCount(tile, mode);
    const next = (counts.get(key) ?? 0) + 1;
    if (next > 4) {
      trimmedCount += 1;
      continue;
    }
    counts.set(key, next);
    tiles.push(tile);
  }

  const confidence = normalizeConfidence(payload.confidence);
  return {
    tiles,
    melds,
    confidence: trimmedCount > 0 ? Math.min(confidence, 0.3) : confidence,
    rawText
  };
}

function normalizeLooseMelds(value: unknown, mode: GameMode): MeldInput[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("melds 必须是数组");
  }

  const melds = value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("副露必须是对象");
    }
    const type = typeof item.type === "string" ? item.type : "";
    const tiles = Array.isArray(item.tiles) ? item.tiles.map(String) : [];
    const calledTile = typeof item.calledTile === "string" ? item.calledTile : undefined;
    return {
      type,
      tiles,
      ...(calledTile === undefined ? {} : { calledTile })
    } as MeldInput;
  });

  return validateMelds(melds, mode);
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const scaled = value > 1 && value <= 100 ? value / 100 : value;
  return Math.max(0, Math.min(1, scaled));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
