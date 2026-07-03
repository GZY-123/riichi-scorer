import type { GameMode } from "./roomLogic";

export type MeldType = "chi" | "pon" | "kan-open" | "kan-closed" | "kan-added" | "north";

export interface MeldInput {
  type: MeldType;
  tiles: string[];
  calledTile?: string;
}

export interface TileValidationOptions {
  allowEmpty?: boolean;
  enforceCopyLimit?: boolean;
}

const MELD_TYPES = new Set<MeldType>(["chi", "pon", "kan-open", "kan-closed", "kan-added", "north"]);

export function parseTileText(value: string): string[] {
  return value
    .split(/[\s,，、/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function assertTileNotation(tile: string, mode: GameMode, label = "牌"): string {
  if (!/^[0-9][mpsz]$/.test(tile)) {
    throw new Error(`${label} ${tile} 不是有效牌记法`);
  }

  const rank = Number(tile[0]);
  const suit = tile[1];
  if (suit === "z") {
    if (rank < 1 || rank > 7) {
      throw new Error(`${label} ${tile} 不是有效字牌`);
    }
    return tile;
  }

  if (rank !== 0 && (rank < 1 || rank > 9)) {
    throw new Error(`${label} ${tile} 不是有效数牌`);
  }

  if (mode === "3p" && suit === "m" && rank >= 2 && rank <= 8) {
    throw new Error(`三麻不使用 ${tile}`);
  }

  return tile;
}

export function isTileNotation(tile: string, mode: GameMode): boolean {
  try {
    assertTileNotation(tile, mode);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTileForCount(tile: string, mode: GameMode): string {
  assertTileNotation(tile, mode);
  if (tile[0] === "0") {
    return `5${tile[1]}`;
  }
  return tile;
}

export function validateTileList(
  tiles: readonly string[] | undefined,
  mode: GameMode,
  label: string,
  options: TileValidationOptions = {}
): string[] {
  const normalized = [...(tiles ?? [])].map((tile, index) => assertTileNotation(tile, mode, `${label}${index + 1}`));
  if (!options.allowEmpty && normalized.length === 0) {
    throw new Error(`${label}不能为空`);
  }

  if (options.enforceCopyLimit === true) {
    assertTileCopiesWithinFour(normalized, mode);
  }

  return normalized;
}

export function validateMelds(melds: readonly MeldInput[] | undefined, mode: GameMode): MeldInput[] {
  return [...(melds ?? [])].map((meld, index) => normalizeMeld(meld, mode, index));
}

export function assertTileCopiesWithinFour(tiles: readonly string[], mode: GameMode): void {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const normalized = normalizeTileForCount(tile, mode);
    const nextCount = (counts.get(normalized) ?? 0) + 1;
    counts.set(normalized, nextCount);
    if (nextCount > 4) {
      throw new Error(`${normalized} 超过 4 张`);
    }
  }
}

function normalizeMeld(meld: MeldInput, mode: GameMode, index: number): MeldInput {
  if (!MELD_TYPES.has(meld.type)) {
    throw new Error(`第 ${index + 1} 组副露类型无效`);
  }

  const tiles = validateTileList(meld.tiles, mode, `第 ${index + 1} 组副露`, { allowEmpty: false });
  if (meld.type === "north") {
    if (tiles.length !== 1 || tiles[0] !== "4z") {
      throw new Error("拔北副露必须且只能包含 4z");
    }
  } else if (meld.type === "chi" || meld.type === "pon") {
    if (tiles.length !== 3) {
      throw new Error(`第 ${index + 1} 组副露需要 3 张牌`);
    }
  } else if (tiles.length !== 4) {
    throw new Error(`第 ${index + 1} 组杠需要 4 张牌`);
  }

  if (meld.calledTile !== undefined) {
    assertTileNotation(meld.calledTile, mode, `第 ${index + 1} 组副露叫牌`);
  }

  return {
    type: meld.type,
    tiles,
    ...(meld.calledTile === undefined ? {} : { calledTile: meld.calledTile })
  };
}
