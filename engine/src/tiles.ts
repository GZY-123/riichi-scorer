import type { GameMode, TileString, Wind } from "./types.js";

export interface ParsedTile {
  suit: "m" | "p" | "s" | "z";
  rank: number;
  red: boolean;
}

const SUIT_OFFSETS: Record<ParsedTile["suit"], number> = {
  m: 0,
  p: 9,
  s: 18,
  z: 27
};

const WIND_TO_TILE: Record<Wind, TileString> = {
  east: "1z",
  south: "2z",
  west: "3z",
  north: "4z"
};

export function parseTile(tile: TileString): ParsedTile {
  if (!/^[0-9][mpsz]$/.test(tile)) {
    throw new Error(`Invalid tile "${tile}". Expected 1m..9m, 1p..9p, 1s..9s, 1z..7z, or red five 0m/0p/0s.`);
  }

  const rank = Number(tile[0]);
  const suit = tile[1] as ParsedTile["suit"];
  if (suit === "z") {
    if (rank < 1 || rank > 7) {
      throw new Error(`Invalid honor tile "${tile}". Honors must be 1z..7z.`);
    }
    return { suit, rank, red: false };
  }

  if (rank === 0) {
    return { suit, rank: 5, red: true };
  }

  if (rank < 1 || rank > 9) {
    throw new Error(`Invalid suited tile "${tile}". Suited tiles must be 1..9, with 0 only for red five.`);
  }
  return { suit, rank, red: false };
}

export function normalizeTile(tile: TileString): TileString {
  const parsed = parseTile(tile);
  return `${parsed.rank}${parsed.suit}`;
}

export function isRedFive(tile: TileString): boolean {
  return parseTile(tile).red;
}

export function tileIndex(tile: TileString): number {
  const parsed = parseTile(normalizeTile(tile));
  return SUIT_OFFSETS[parsed.suit] + parsed.rank - 1;
}

export function tileFromIndex(index: number): TileString {
  if (index < 0 || index >= 34) {
    throw new Error(`Invalid tile index ${index}.`);
  }
  if (index < 9) return `${index + 1}m`;
  if (index < 18) return `${index - 8}p`;
  if (index < 27) return `${index - 17}s`;
  return `${index - 26}z`;
}

export function sortTiles(tiles: TileString[]): TileString[] {
  return [...tiles].sort((a, b) => tileIndex(a) - tileIndex(b) || a.localeCompare(b));
}

export function tileCounts(tiles: TileString[]): number[] {
  const counts = Array<number>(34).fill(0);
  for (const tile of tiles) {
    const index = tileIndex(tile);
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

export function assertTileCountsWithinFour(tiles: TileString[]): void {
  const counts = tileCounts(tiles);
  for (let index = 0; index < counts.length; index += 1) {
    const count = counts[index] ?? 0;
    if (count > 4) {
      throw new Error(`Invalid hand: ${tileFromIndex(index)} appears ${count} times, more than four copies.`);
    }
  }
}

export function assertModeTile(tile: TileString, mode: GameMode): void {
  const parsed = parseTile(tile);
  if (mode === "3p" && parsed.suit === "m" && parsed.rank >= 2 && parsed.rank <= 8) {
    throw new Error(`Invalid sanma tile "${tile}". Three-player riichi removes 2m through 8m.`);
  }
}

export function assertModeTiles(tiles: TileString[], mode: GameMode): void {
  for (const tile of tiles) {
    assertModeTile(tile, mode);
  }
}

export function isHonor(tile: TileString): boolean {
  return parseTile(tile).suit === "z";
}

export function isTerminal(tile: TileString): boolean {
  const parsed = parseTile(tile);
  return parsed.suit !== "z" && (parsed.rank === 1 || parsed.rank === 9);
}

export function isYaochu(tile: TileString): boolean {
  return isHonor(tile) || isTerminal(tile);
}

export function isSimple(tile: TileString): boolean {
  const parsed = parseTile(tile);
  return parsed.suit !== "z" && parsed.rank >= 2 && parsed.rank <= 8;
}

export function isDragon(tile: TileString): boolean {
  const normalized = normalizeTile(tile);
  return normalized === "5z" || normalized === "6z" || normalized === "7z";
}

export function isWind(tile: TileString): boolean {
  const normalized = normalizeTile(tile);
  return normalized === "1z" || normalized === "2z" || normalized === "3z" || normalized === "4z";
}

export function windToTile(wind: Wind | TileString | undefined): TileString | undefined {
  if (wind === undefined) return undefined;
  if (wind === "east" || wind === "south" || wind === "west" || wind === "north") {
    return WIND_TO_TILE[wind];
  }
  return normalizeTile(wind);
}

export function nextDoraTile(indicator: TileString): TileString {
  const tile = parseTile(indicator);
  if (tile.suit !== "z") {
    return `${tile.rank === 9 ? 1 : tile.rank + 1}${tile.suit}`;
  }
  if (tile.rank >= 1 && tile.rank <= 4) {
    return `${tile.rank === 4 ? 1 : tile.rank + 1}z`;
  }
  return `${tile.rank === 7 ? 5 : tile.rank + 1}z`;
}

export function allTileTypes(mode: GameMode = "4p"): TileString[] {
  const tiles: TileString[] = [];
  for (const suit of ["m", "p", "s"] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      const tile = `${rank}${suit}`;
      if (mode === "4p" || suit !== "m" || rank === 1 || rank === 9) {
        tiles.push(tile);
      }
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    tiles.push(`${rank}z`);
  }
  return tiles;
}

export const ORPHANS: TileString[] = [
  "1m",
  "9m",
  "1p",
  "9p",
  "1s",
  "9s",
  "1z",
  "2z",
  "3z",
  "4z",
  "5z",
  "6z",
  "7z"
];
