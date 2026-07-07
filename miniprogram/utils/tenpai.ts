import type { EngineApi, GameMode } from "./engine";

declare const require: (id: string) => unknown;

export interface TenpaiWait {
  tile: string;
  remaining: number;
}

export interface TenpaiResult {
  waits: TenpaiWait[];
  error?: string;
}

export interface TenpaiDrawAnalysis {
  draw: string;
  waits: TenpaiWait[];
  totalRemaining: number;
}

type TileSuit = "m" | "p" | "s" | "z";

const engine = require("./engine-lib/index.js") as EngineApi;
const SUIT_ORDER: Record<TileSuit, number> = { m: 0, p: 1, s: 2, z: 3 };
const RED_FIVE_CODES = ["0m", "0p", "0s"] as const;
const FOUR_PLAYER_TILES = buildTileTypes("4p");
const THREE_PLAYER_TILES = buildTileTypes("3p");

export function calcWaits(tiles: string[], mode: GameMode): TenpaiResult {
  if (tiles.length !== 13) {
    return { waits: [], error: `请先输入 13 张手牌（当前 ${tiles.length} 张）` };
  }

  const cleanedTiles = tiles.map((tile) => tile.trim());
  let normalizedTiles: string[];
  try {
    normalizedTiles = cleanedTiles.map((tile) => normalizeTile(tile, mode));
  } catch (error) {
    return { waits: [], error: error instanceof Error ? error.message : "牌面包含无效牌" };
  }

  const limitError = tileLimitError(cleanedTiles, normalizedTiles);
  if (limitError !== undefined) {
    return { waits: [], error: limitError };
  }

  const counts = countTiles(normalizedTiles);
  const waits: TenpaiWait[] = [];
  for (const candidate of tileTypesForMode(mode)) {
    const count = counts.get(candidate) ?? 0;
    if (count >= 4) {
      continue;
    }

    try {
      engine.parseHand({ tiles: cleanedTiles, winningTile: candidate, mode });
      waits.push({ tile: candidate, remaining: 4 - count });
    } catch {
      // 不能组成和牌形时，引擎会抛错；听牌计算只关心成功候选。
    }
  }

  return { waits };
}

export function analyzeDraws(tiles12: string[], mode: GameMode): TenpaiDrawAnalysis[] {
  if (tiles12.length !== 12) {
    return [];
  }

  const cleanedTiles = tiles12.map((tile) => tile.trim());
  let normalizedTiles: string[];
  try {
    normalizedTiles = cleanedTiles.map((tile) => normalizeTile(tile, mode));
  } catch {
    return [];
  }

  if (tileLimitError(cleanedTiles, normalizedTiles) !== undefined) {
    return [];
  }

  const counts = countTiles(normalizedTiles);
  const analyses: TenpaiDrawAnalysis[] = [];
  for (const candidate of tileTypesForMode(mode)) {
    const count = counts.get(candidate) ?? 0;
    if (count >= 4) {
      continue;
    }

    const result = calcWaits([...cleanedTiles, candidate], mode);
    if (result.error || result.waits.length === 0) {
      continue;
    }

    analyses.push({
      draw: candidate,
      waits: result.waits,
      totalRemaining: result.waits.reduce((sum, wait) => sum + wait.remaining, 0)
    });
  }

  return analyses.sort((left, right) => right.totalRemaining - left.totalRemaining || compareTiles(left.draw, right.draw));
}

export function sortTileCodes(tiles: readonly string[]): string[] {
  return [...tiles].sort(compareTiles);
}

export function normalizeTileForCount(tile: string, mode: GameMode): string {
  return normalizeTile(tile, mode);
}

function buildTileTypes(mode: GameMode): string[] {
  const tiles: string[] = [];
  for (const suit of ["m", "p", "s"] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      if (mode === "3p" && suit === "m" && rank >= 2 && rank <= 8) {
        continue;
      }
      tiles.push(`${rank}${suit}`);
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    tiles.push(`${rank}z`);
  }
  return tiles;
}

function tileTypesForMode(mode: GameMode): string[] {
  return mode === "3p" ? THREE_PLAYER_TILES : FOUR_PLAYER_TILES;
}

function countTiles(tiles: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  return counts;
}

function tileLimitError(cleanedTiles: readonly string[], normalizedTiles: readonly string[]): string | undefined {
  const redCounts = countTiles(cleanedTiles);
  for (const code of RED_FIVE_CODES) {
    if ((redCounts.get(code) ?? 0) > 1) {
      return `${code} 已超过 1 枚`;
    }
  }

  const counts = countTiles(normalizedTiles);
  const overLimit = [...counts.entries()].find(([, count]) => count > 4);
  if (overLimit !== undefined) {
    return `${overLimit[0]} 已超过 4 枚`;
  }
  return undefined;
}

function normalizeTile(tile: string, mode: GameMode): string {
  const trimmed = tile.trim();
  const match = /^([0-9])([mpsz])$/.exec(trimmed);
  if (match === null) {
    throw new Error(`牌面包含无效牌：${tile}`);
  }

  const rank = Number(match[1]);
  const suit = match[2] as TileSuit;
  if (suit === "z") {
    if (rank < 1 || rank > 7) {
      throw new Error(`牌面包含无效牌：${tile}`);
    }
    return `${rank}${suit}`;
  }

  const normalizedRank = rank === 0 ? 5 : rank;
  if (normalizedRank < 1 || normalizedRank > 9) {
    throw new Error(`牌面包含无效牌：${tile}`);
  }
  if (mode === "3p" && suit === "m" && normalizedRank >= 2 && normalizedRank <= 8) {
    throw new Error(`三麻不使用 ${normalizedRank}m`);
  }
  return `${normalizedRank}${suit}`;
}

function compareTiles(left: string, right: string): number {
  const parsedLeft = parseSortTile(left);
  const parsedRight = parseSortTile(right);
  return (
    SUIT_ORDER[parsedLeft.suit] - SUIT_ORDER[parsedRight.suit] ||
    parsedLeft.rank - parsedRight.rank ||
    left.localeCompare(right)
  );
}

function parseSortTile(tile: string): { suit: TileSuit; rank: number } {
  const match = /^([0-9])([mpsz])$/.exec(tile);
  if (match === null) {
    return { suit: "z", rank: 99 };
  }
  const suit = match[2] as TileSuit;
  const rank = Number(match[1]);
  return { suit, rank: rank === 0 ? 5.5 : rank };
}
