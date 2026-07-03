import type {
  GameMode,
  HandDivision,
  HandSet,
  Meld,
  ParseHandInput,
  ParseHandOptions,
  TileString,
  WaitType
} from "./types.js";
import {
  ORPHANS,
  assertModeTiles,
  assertTileCountsWithinFour,
  isHonor,
  normalizeTile,
  parseTile,
  sortTiles,
  tileCounts,
  tileFromIndex,
  tileIndex
} from "./tiles.js";

interface NormalizedInput {
  mode: GameMode;
  concealedInput: TileString[];
  concealedAll: TileString[];
  concealedAllOriginal: TileString[];
  concealedBeforeWin?: TileString[];
  concealedBeforeWinOriginal?: TileString[];
  winningTile?: TileString;
  melds: Meld[];
  meldSets: HandSet[];
  nukiDora: number;
}

export function parseHand(
  input: ParseHandInput | TileString[],
  winningTile?: TileString,
  options: ParseHandOptions = {}
): HandDivision[] {
  const normalized = normalizeInput(input, winningTile, options);
  const divisions: HandDivision[] = [];

  if (normalized.meldSets.length === 0 && normalized.concealedAll.length === 14) {
    const sevenPairs = decomposeSevenPairs(normalized);
    if (sevenPairs !== undefined) divisions.push(sevenPairs);

    const thirteenOrphans = decomposeThirteenOrphans(normalized);
    if (thirteenOrphans !== undefined) divisions.push(thirteenOrphans);
  }

  divisions.push(...decomposeStandard(normalized));

  if (divisions.length === 0) {
    throw new Error("Invalid hand: tiles do not form a winning hand shape.");
  }

  return divisions;
}

function normalizeInput(
  input: ParseHandInput | TileString[],
  winningTile: TileString | undefined,
  options: ParseHandOptions
): NormalizedInput {
  const objectInput = Array.isArray(input) ? undefined : input;
  const mode = objectInput?.mode ?? options.mode ?? "4p";
  const concealedRawInput = Array.isArray(input) ? input : objectInput?.tiles ?? objectInput?.concealedTiles ?? [];
  const concealedInput = concealedRawInput.map(normalizeTile);
  const win = objectInput?.winningTile ?? winningTile;
  const normalizedWin = win === undefined ? undefined : normalizeTile(win);
  const melds = objectInput?.melds ?? [];
  const { sets: meldSets, nukiDora } = normalizeMelds(melds, mode);

  for (const tile of concealedInput) {
    normalizeTile(tile);
  }
  if (normalizedWin !== undefined) {
    normalizeTile(normalizedWin);
  }

  const shapeFromMelds = meldSets.length * 3;
  const shapeWithoutWin = concealedInput.length + shapeFromMelds;
  let concealedAll: TileString[];
  let concealedAllOriginal: TileString[];
  let concealedBeforeWin: TileString[] | undefined;
  let concealedBeforeWinOriginal: TileString[] | undefined;

  if (normalizedWin !== undefined && shapeWithoutWin === 13) {
    concealedBeforeWin = [...concealedInput];
    concealedBeforeWinOriginal = [...concealedRawInput];
    concealedAll = [...concealedInput, normalizedWin];
    concealedAllOriginal = [...concealedRawInput, win as TileString];
  } else if (shapeWithoutWin === 14) {
    concealedAll = [...concealedInput];
    concealedAllOriginal = [...concealedRawInput];
    if (normalizedWin !== undefined) {
      const winIndex = concealedInput.findIndex((tile) => tile === normalizedWin);
      if (winIndex < 0) {
        throw new Error("Invalid hand: winning tile not found in the 14-tile hand.");
      }
      concealedBeforeWin = concealedInput.filter((_, index) => index !== winIndex);
      concealedBeforeWinOriginal = concealedRawInput.filter((_, index) => index !== winIndex);
    }
  } else if (normalizedWin === undefined) {
    throw new Error(`Invalid hand: expected 14 hand-shape tiles including melds, got ${shapeWithoutWin}.`);
  } else {
    throw new Error(
      `Invalid hand: expected 13 tiles plus winning tile or 14 tiles including winning tile, got ${shapeWithoutWin} before win.`
    );
  }

  const expectedConcealed = (4 - meldSets.length) * 3 + 2;
  if (expectedConcealed < 2 || concealedAll.length !== expectedConcealed) {
    throw new Error(
      `Invalid hand: ${meldSets.length} melds require ${expectedConcealed} concealed tiles including the win, got ${concealedAll.length}.`
    );
  }

  const meldPhysicalTiles = melds.flatMap((meld) => meld.tiles);
  const physicalTiles = [...concealedAllOriginal, ...meldPhysicalTiles];
  assertModeTiles(physicalTiles.map(normalizeTile), mode);
  assertTileCountsWithinFour(physicalTiles.map(normalizeTile));

  return {
    mode,
    concealedInput,
    concealedAll: sortTiles(concealedAll),
    concealedAllOriginal: sortTiles(concealedAllOriginal),
    ...(concealedBeforeWin === undefined ? {} : { concealedBeforeWin: sortTiles(concealedBeforeWin) }),
    ...(concealedBeforeWinOriginal === undefined ? {} : { concealedBeforeWinOriginal: sortTiles(concealedBeforeWinOriginal) }),
    ...(normalizedWin === undefined ? {} : { winningTile: normalizedWin }),
    melds,
    meldSets,
    nukiDora
  };
}

function normalizeMelds(melds: Meld[], mode: GameMode): { sets: HandSet[]; nukiDora: number } {
  const sets: HandSet[] = [];
  let nukiDora = 0;
  for (const meld of melds) {
    const tiles = meld.tiles.map(normalizeTile);
    assertModeTiles(tiles, mode);

    if (meld.type === "north") {
      if (tiles.length !== 1 || tiles[0] !== "4z") {
        throw new Error("Invalid nuki-dora meld: north extraction must contain exactly one 4z.");
      }
      nukiDora += 1;
      continue;
    }

    if (meld.type === "chi") {
      if (mode === "3p") {
        throw new Error("Invalid sanma meld: chi is not allowed in three-player riichi.");
      }
      if (tiles.length !== 3) {
        throw new Error("Invalid chi meld: chi must contain three tiles.");
      }
      const sorted = sortTiles(tiles);
      const parsed = sorted.map(parseTile);
      const first = parsed[0];
      const second = parsed[1];
      const third = parsed[2];
      if (
        first === undefined ||
        second === undefined ||
        third === undefined ||
        first.suit === "z" ||
        first.suit !== second.suit ||
        first.suit !== third.suit ||
        second.rank !== first.rank + 1 ||
        third.rank !== first.rank + 2
      ) {
        throw new Error(`Invalid chi meld: ${meld.tiles.join(" ")} is not a suited sequence.`);
      }
      sets.push({ type: "sequence", tiles: sorted, open: true, concealed: false, source: "meld" });
      continue;
    }

    if (meld.type === "pon") {
      if (tiles.length !== 3 || !tiles.every((tile) => tile === tiles[0])) {
        throw new Error("Invalid pon meld: pon must contain three identical tiles.");
      }
      sets.push({ type: "triplet", tiles, open: true, concealed: false, source: "meld" });
      continue;
    }

    if (tiles.length !== 4 || !tiles.every((tile) => tile === tiles[0])) {
      throw new Error("Invalid kan meld: kan must contain four identical tiles.");
    }
    const concealed = meld.type === "kan-closed";
    sets.push({ type: "quad", tiles, open: !concealed, concealed, source: "meld" });
  }
  return { sets, nukiDora };
}

function decomposeSevenPairs(input: NormalizedInput): HandDivision | undefined {
  const counts = tileCounts(input.concealedAll);
  const pairIndexes = counts.flatMap((count, index) => (count === 2 ? [index] : []));
  if (pairIndexes.length !== 7) return undefined;

  const pairs = pairIndexes.map((index) => [tileFromIndex(index), tileFromIndex(index)]);
  return {
    pattern: "seven-pairs",
    sets: [],
    pairs,
    wait: determineSevenPairsWait(input, pairs),
    tiles: sortTiles([...input.concealedAllOriginal, ...input.melds.flatMap((meld) => meld.tiles)]),
    handTiles: sortTiles(input.concealedAllOriginal),
    concealedTiles: input.concealedAllOriginal,
    ...(input.concealedBeforeWinOriginal === undefined ? {} : { concealedBeforeWin: input.concealedBeforeWinOriginal }),
    ...(input.winningTile === undefined ? {} : { winningTile: input.winningTile }),
    melds: input.melds,
    isClosed: true,
    nukiDora: input.nukiDora
  };
}

function determineSevenPairsWait(input: NormalizedInput, pairs: TileString[][]): WaitType {
  if (input.winningTile === undefined) return "unknown";
  return pairs.some((pair) => pair[0] === input.winningTile) ? "tanki" : "unknown";
}

function decomposeThirteenOrphans(input: NormalizedInput): HandDivision | undefined {
  const counts = tileCounts(input.concealedAll);
  const orphanIndexes = new Set(ORPHANS.map(tileIndex));
  let pairCount = 0;

  for (let index = 0; index < counts.length; index += 1) {
    const count = counts[index] ?? 0;
    if (count === 0) continue;
    if (!orphanIndexes.has(index)) return undefined;
    if (count === 2) {
      pairCount += 1;
    } else if (count !== 1) {
      return undefined;
    }
  }

  if (pairCount !== 1) return undefined;

  const isThirteenSided =
    input.concealedBeforeWin !== undefined &&
    ORPHANS.every((tile) => input.concealedBeforeWin?.filter((candidate) => candidate === tile).length === 1);

  return {
    pattern: "thirteen-orphans",
    sets: [],
    wait: "tanki",
    tiles: sortTiles(input.concealedAllOriginal),
    handTiles: sortTiles(input.concealedAllOriginal),
    concealedTiles: input.concealedAllOriginal,
    ...(input.concealedBeforeWinOriginal === undefined ? {} : { concealedBeforeWin: input.concealedBeforeWinOriginal }),
    ...(input.winningTile === undefined ? {} : { winningTile: input.winningTile }),
    melds: input.melds,
    isClosed: true,
    isThirteenSided,
    nukiDora: input.nukiDora
  };
}

function decomposeStandard(input: NormalizedInput): HandDivision[] {
  const requiredHandSets = 4 - input.meldSets.length;
  const counts = tileCounts(input.concealedAll);
  const divisions: HandDivision[] = [];

  for (let pairIndex = 0; pairIndex < counts.length; pairIndex += 1) {
    if ((counts[pairIndex] ?? 0) < 2) continue;

    const countsAfterPair = [...counts];
    countsAfterPair[pairIndex] = (countsAfterPair[pairIndex] ?? 0) - 2;
    const handSetOptions = findSets(countsAfterPair, requiredHandSets);
    for (const handSets of handSetOptions) {
      const pair = [tileFromIndex(pairIndex), tileFromIndex(pairIndex)];
      const sets = [...handSets, ...input.meldSets];
      const handTiles = sortTiles([...input.concealedAllOriginal, ...input.meldSets.flatMap((set) => set.tiles)]);
      divisions.push({
        pattern: "standard",
        sets,
        pair,
        wait: determineWait(handSets, pair, input.winningTile),
        tiles: sortTiles([...handTiles, ...input.melds.filter((meld) => meld.type === "north").flatMap((meld) => meld.tiles.map(normalizeTile))]),
        handTiles,
        concealedTiles: input.concealedAllOriginal,
        ...(input.concealedBeforeWin === undefined ? {} : { concealedBeforeWin: input.concealedBeforeWin }),
        ...(input.winningTile === undefined ? {} : { winningTile: input.winningTile }),
        melds: input.melds,
        isClosed: !input.meldSets.some((set) => set.open),
        nukiDora: input.nukiDora
      });
    }
  }

  return dedupeDivisions(divisions);
}

function findSets(counts: number[], requiredSets: number): HandSet[][] {
  const firstIndex = counts.findIndex((count) => count > 0);
  if (firstIndex === -1) {
    return requiredSets === 0 ? [[]] : [];
  }
  if (requiredSets <= 0) return [];

  const results: HandSet[][] = [];
  const tile = tileFromIndex(firstIndex);

  if ((counts[firstIndex] ?? 0) >= 3) {
    const nextCounts = [...counts];
    nextCounts[firstIndex] = (nextCounts[firstIndex] ?? 0) - 3;
    for (const rest of findSets(nextCounts, requiredSets - 1)) {
      results.push([{ type: "triplet", tiles: [tile, tile, tile], open: false, concealed: true, source: "hand" }, ...rest]);
    }
  }

  const parsed = parseTile(tile);
  if (!isHonor(tile) && parsed.rank <= 7) {
    const secondIndex = firstIndex + 1;
    const thirdIndex = firstIndex + 2;
    if ((counts[secondIndex] ?? 0) > 0 && (counts[thirdIndex] ?? 0) > 0) {
      const second = tileFromIndex(secondIndex);
      const third = tileFromIndex(thirdIndex);
      if (parseTile(second).suit === parsed.suit && parseTile(third).suit === parsed.suit) {
        const nextCounts = [...counts];
        nextCounts[firstIndex] = (nextCounts[firstIndex] ?? 0) - 1;
        nextCounts[secondIndex] = (nextCounts[secondIndex] ?? 0) - 1;
        nextCounts[thirdIndex] = (nextCounts[thirdIndex] ?? 0) - 1;
        for (const rest of findSets(nextCounts, requiredSets - 1)) {
          results.push([
            { type: "sequence", tiles: [tile, second, third], open: false, concealed: true, source: "hand" },
            ...rest
          ]);
        }
      }
    }
  }

  return results;
}

function determineWait(handSets: HandSet[], pair: TileString[], winningTile: TileString | undefined): WaitType {
  if (winningTile === undefined) return "unknown";
  const win = normalizeTile(winningTile);
  if (pair[0] === win) return "tanki";

  for (const set of handSets) {
    if (!set.tiles.includes(win)) continue;
    if (set.type === "triplet") return "shanpon";
    if (set.type === "sequence") {
      const ranks = set.tiles.map((tile) => parseTile(tile).rank);
      const winRank = parseTile(win).rank;
      if (ranks[1] === winRank) return "kanchan";
      if ((ranks[0] === 1 && winRank === 3) || (ranks[2] === 9 && winRank === 7)) return "penchan";
      return "ryanmen";
    }
  }

  return "unknown";
}

function dedupeDivisions(divisions: HandDivision[]): HandDivision[] {
  const seen = new Set<string>();
  const deduped: HandDivision[] = [];
  for (const division of divisions) {
    const key = [
      division.pattern,
      division.pair?.join(""),
      division.sets
        .map((set) => `${set.type}:${set.tiles.join("")}:${set.open ? "o" : "c"}`)
        .sort()
        .join("|")
    ].join("/");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(division);
    }
  }
  return deduped;
}
