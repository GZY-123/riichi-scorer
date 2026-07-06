"use strict";
var RiichiEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // engine/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    ORPHANS: () => ORPHANS,
    allTileTypes: () => allTileTypes,
    applyEvent: () => applyEvent,
    assertModeTile: () => assertModeTile,
    assertModeTiles: () => assertModeTiles,
    assertTileCountsWithinFour: () => assertTileCountsWithinFour,
    calcFu: () => calcFu,
    calcScore: () => calcScore,
    createGame: () => createGame,
    detectYaku: () => detectYaku,
    isDragon: () => isDragon,
    isHonor: () => isHonor,
    isRedFive: () => isRedFive,
    isSimple: () => isSimple,
    isTerminal: () => isTerminal,
    isValuePair: () => isValuePair,
    isWind: () => isWind,
    isYaochu: () => isYaochu,
    nextDoraTile: () => nextDoraTile,
    normalizeTile: () => normalizeTile,
    parseHand: () => parseHand,
    parseTile: () => parseTile,
    settleGame: () => settleGame,
    sortTiles: () => sortTiles,
    tileCounts: () => tileCounts,
    tileFromIndex: () => tileFromIndex,
    tileIndex: () => tileIndex,
    windToTile: () => windToTile
  });

  // engine/src/tiles.ts
  var SUIT_OFFSETS = {
    m: 0,
    p: 9,
    s: 18,
    z: 27
  };
  var WIND_TO_TILE = {
    east: "1z",
    south: "2z",
    west: "3z",
    north: "4z"
  };
  function parseTile(tile) {
    if (!/^[0-9][mpsz]$/.test(tile)) {
      throw new Error(`Invalid tile "${tile}". Expected 1m..9m, 1p..9p, 1s..9s, 1z..7z, or red five 0m/0p/0s.`);
    }
    const rank = Number(tile[0]);
    const suit = tile[1];
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
  function normalizeTile(tile) {
    const parsed = parseTile(tile);
    return `${parsed.rank}${parsed.suit}`;
  }
  function isRedFive(tile) {
    return parseTile(tile).red;
  }
  function tileIndex(tile) {
    const parsed = parseTile(normalizeTile(tile));
    return SUIT_OFFSETS[parsed.suit] + parsed.rank - 1;
  }
  function tileFromIndex(index) {
    if (index < 0 || index >= 34) {
      throw new Error(`Invalid tile index ${index}.`);
    }
    if (index < 9) return `${index + 1}m`;
    if (index < 18) return `${index - 8}p`;
    if (index < 27) return `${index - 17}s`;
    return `${index - 26}z`;
  }
  function sortTiles(tiles) {
    return [...tiles].sort((a, b) => tileIndex(a) - tileIndex(b) || a.localeCompare(b));
  }
  function tileCounts(tiles) {
    const counts = Array(34).fill(0);
    for (const tile of tiles) {
      const index = tileIndex(tile);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    return counts;
  }
  function assertTileCountsWithinFour(tiles) {
    const counts = tileCounts(tiles);
    for (let index = 0; index < counts.length; index += 1) {
      const count = counts[index] ?? 0;
      if (count > 4) {
        throw new Error(`Invalid hand: ${tileFromIndex(index)} appears ${count} times, more than four copies.`);
      }
    }
  }
  function assertModeTile(tile, mode) {
    const parsed = parseTile(tile);
    if (mode === "3p" && parsed.suit === "m" && parsed.rank >= 2 && parsed.rank <= 8) {
      throw new Error(`Invalid sanma tile "${tile}". Three-player riichi removes 2m through 8m.`);
    }
  }
  function assertModeTiles(tiles, mode) {
    for (const tile of tiles) {
      assertModeTile(tile, mode);
    }
  }
  function isHonor(tile) {
    return parseTile(tile).suit === "z";
  }
  function isTerminal(tile) {
    const parsed = parseTile(tile);
    return parsed.suit !== "z" && (parsed.rank === 1 || parsed.rank === 9);
  }
  function isYaochu(tile) {
    return isHonor(tile) || isTerminal(tile);
  }
  function isSimple(tile) {
    const parsed = parseTile(tile);
    return parsed.suit !== "z" && parsed.rank >= 2 && parsed.rank <= 8;
  }
  function isDragon(tile) {
    const normalized = normalizeTile(tile);
    return normalized === "5z" || normalized === "6z" || normalized === "7z";
  }
  function isWind(tile) {
    const normalized = normalizeTile(tile);
    return normalized === "1z" || normalized === "2z" || normalized === "3z" || normalized === "4z";
  }
  function windToTile(wind) {
    if (wind === void 0) return void 0;
    if (wind === "east" || wind === "south" || wind === "west" || wind === "north") {
      return WIND_TO_TILE[wind];
    }
    return normalizeTile(wind);
  }
  function nextDoraTile(indicator) {
    const tile = parseTile(indicator);
    if (tile.suit !== "z") {
      return `${tile.rank === 9 ? 1 : tile.rank + 1}${tile.suit}`;
    }
    if (tile.rank >= 1 && tile.rank <= 4) {
      return `${tile.rank === 4 ? 1 : tile.rank + 1}z`;
    }
    return `${tile.rank === 7 ? 5 : tile.rank + 1}z`;
  }
  function allTileTypes(mode = "4p") {
    const tiles = [];
    for (const suit of ["m", "p", "s"]) {
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
  var ORPHANS = [
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

  // engine/src/hand.ts
  function parseHand(input, winningTile, options = {}) {
    const normalized = normalizeInput(input, winningTile, options);
    const divisions = [];
    if (normalized.meldSets.length === 0 && normalized.concealedAll.length === 14) {
      const sevenPairs = decomposeSevenPairs(normalized);
      if (sevenPairs !== void 0) divisions.push(sevenPairs);
      const thirteenOrphans = decomposeThirteenOrphans(normalized);
      if (thirteenOrphans !== void 0) divisions.push(thirteenOrphans);
    }
    divisions.push(...decomposeStandard(normalized));
    if (divisions.length === 0) {
      throw new Error("Invalid hand: tiles do not form a winning hand shape.");
    }
    return divisions;
  }
  function normalizeInput(input, winningTile, options) {
    const objectInput = Array.isArray(input) ? void 0 : input;
    const mode = objectInput?.mode ?? options.mode ?? "4p";
    const concealedRawInput = Array.isArray(input) ? input : objectInput?.tiles ?? objectInput?.concealedTiles ?? [];
    const concealedInput = concealedRawInput.map(normalizeTile);
    const win = objectInput?.winningTile ?? winningTile;
    const normalizedWin = win === void 0 ? void 0 : normalizeTile(win);
    const melds = objectInput?.melds ?? [];
    const { sets: meldSets, nukiDora } = normalizeMelds(melds, mode);
    for (const tile of concealedInput) {
      normalizeTile(tile);
    }
    if (normalizedWin !== void 0) {
      normalizeTile(normalizedWin);
    }
    const shapeFromMelds = meldSets.length * 3;
    const shapeWithoutWin = concealedInput.length + shapeFromMelds;
    let concealedAll;
    let concealedAllOriginal;
    let concealedBeforeWin;
    let concealedBeforeWinOriginal;
    if (normalizedWin !== void 0 && shapeWithoutWin === 13) {
      concealedBeforeWin = [...concealedInput];
      concealedBeforeWinOriginal = [...concealedRawInput];
      concealedAll = [...concealedInput, normalizedWin];
      concealedAllOriginal = [...concealedRawInput, win];
    } else if (shapeWithoutWin === 14) {
      concealedAll = [...concealedInput];
      concealedAllOriginal = [...concealedRawInput];
      if (normalizedWin !== void 0) {
        const winIndex = concealedInput.findIndex((tile) => tile === normalizedWin);
        if (winIndex < 0) {
          throw new Error("Invalid hand: winning tile not found in the 14-tile hand.");
        }
        concealedBeforeWin = concealedInput.filter((_, index) => index !== winIndex);
        concealedBeforeWinOriginal = concealedRawInput.filter((_, index) => index !== winIndex);
      }
    } else if (normalizedWin === void 0) {
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
      ...concealedBeforeWin === void 0 ? {} : { concealedBeforeWin: sortTiles(concealedBeforeWin) },
      ...concealedBeforeWinOriginal === void 0 ? {} : { concealedBeforeWinOriginal: sortTiles(concealedBeforeWinOriginal) },
      ...normalizedWin === void 0 ? {} : { winningTile: normalizedWin },
      melds,
      meldSets,
      nukiDora
    };
  }
  function normalizeMelds(melds, mode) {
    const sets = [];
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
        if (first === void 0 || second === void 0 || third === void 0 || first.suit === "z" || first.suit !== second.suit || first.suit !== third.suit || second.rank !== first.rank + 1 || third.rank !== first.rank + 2) {
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
  function decomposeSevenPairs(input) {
    const counts = tileCounts(input.concealedAll);
    const pairIndexes = counts.flatMap((count, index) => count === 2 ? [index] : []);
    if (pairIndexes.length !== 7) return void 0;
    const pairs = pairIndexes.map((index) => [tileFromIndex(index), tileFromIndex(index)]);
    return {
      pattern: "seven-pairs",
      sets: [],
      pairs,
      wait: determineSevenPairsWait(input, pairs),
      tiles: sortTiles([...input.concealedAllOriginal, ...input.melds.flatMap((meld) => meld.tiles)]),
      handTiles: sortTiles(input.concealedAllOriginal),
      concealedTiles: input.concealedAllOriginal,
      ...input.concealedBeforeWinOriginal === void 0 ? {} : { concealedBeforeWin: input.concealedBeforeWinOriginal },
      ...input.winningTile === void 0 ? {} : { winningTile: input.winningTile },
      melds: input.melds,
      isClosed: true,
      nukiDora: input.nukiDora
    };
  }
  function determineSevenPairsWait(input, pairs) {
    if (input.winningTile === void 0) return "unknown";
    return pairs.some((pair) => pair[0] === input.winningTile) ? "tanki" : "unknown";
  }
  function decomposeThirteenOrphans(input) {
    const counts = tileCounts(input.concealedAll);
    const orphanIndexes = new Set(ORPHANS.map(tileIndex));
    let pairCount = 0;
    for (let index = 0; index < counts.length; index += 1) {
      const count = counts[index] ?? 0;
      if (count === 0) continue;
      if (!orphanIndexes.has(index)) return void 0;
      if (count === 2) {
        pairCount += 1;
      } else if (count !== 1) {
        return void 0;
      }
    }
    if (pairCount !== 1) return void 0;
    const isThirteenSided = input.concealedBeforeWin !== void 0 && ORPHANS.every((tile) => input.concealedBeforeWin?.filter((candidate) => candidate === tile).length === 1);
    return {
      pattern: "thirteen-orphans",
      sets: [],
      wait: "tanki",
      tiles: sortTiles(input.concealedAllOriginal),
      handTiles: sortTiles(input.concealedAllOriginal),
      concealedTiles: input.concealedAllOriginal,
      ...input.concealedBeforeWinOriginal === void 0 ? {} : { concealedBeforeWin: input.concealedBeforeWinOriginal },
      ...input.winningTile === void 0 ? {} : { winningTile: input.winningTile },
      melds: input.melds,
      isClosed: true,
      isThirteenSided,
      nukiDora: input.nukiDora
    };
  }
  function decomposeStandard(input) {
    const requiredHandSets = 4 - input.meldSets.length;
    const counts = tileCounts(input.concealedAll);
    const divisions = [];
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
          ...input.concealedBeforeWin === void 0 ? {} : { concealedBeforeWin: input.concealedBeforeWin },
          ...input.winningTile === void 0 ? {} : { winningTile: input.winningTile },
          melds: input.melds,
          isClosed: !input.meldSets.some((set) => set.open),
          nukiDora: input.nukiDora
        });
      }
    }
    return dedupeDivisions(divisions);
  }
  function findSets(counts, requiredSets) {
    const firstIndex = counts.findIndex((count) => count > 0);
    if (firstIndex === -1) {
      return requiredSets === 0 ? [[]] : [];
    }
    if (requiredSets <= 0) return [];
    const results = [];
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
  function determineWait(handSets, pair, winningTile) {
    if (winningTile === void 0) return "unknown";
    const win = normalizeTile(winningTile);
    if (pair[0] === win) return "tanki";
    for (const set of handSets) {
      if (!set.tiles.includes(win)) continue;
      if (set.type === "triplet") return "shanpon";
      if (set.type === "sequence") {
        const ranks = set.tiles.map((tile) => parseTile(tile).rank);
        const winRank = parseTile(win).rank;
        if (ranks[1] === winRank) return "kanchan";
        if (ranks[0] === 1 && winRank === 3 || ranks[2] === 9 && winRank === 7) return "penchan";
        return "ryanmen";
      }
    }
    return "unknown";
  }
  function dedupeDivisions(divisions) {
    const seen = /* @__PURE__ */ new Set();
    const deduped = [];
    for (const division of divisions) {
      const key = [
        division.pattern,
        division.pair?.join(""),
        division.sets.map((set) => `${set.type}:${set.tiles.join("")}:${set.open ? "o" : "c"}`).sort().join("|")
      ].join("/");
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(division);
      }
    }
    return deduped;
  }

  // engine/src/yaku.ts
  var DRAGON_TILES = ["5z", "6z", "7z"];
  var DRAGON_YAKU_NAMES = {
    "5z": "\u5F79\u724C \u767D",
    "6z": "\u5F79\u724C \u53D1",
    "7z": "\u5F79\u724C \u4E2D"
  };
  function detectYaku(input, context = {}) {
    if (Array.isArray(input)) {
      const results = input.map((division) => detectYakuForDivision(division, context));
      return results.sort(compareYakuResults)[0] ?? emptyYakuResult();
    }
    return detectYakuForDivision(input, context);
  }
  function detectYakuForDivision(division, context) {
    const winType = resolveWinType(context);
    const closed = context.isClosed ?? division.isClosed;
    const yakuman = detectYakuman(division, context, winType, closed);
    if (yakuman.length > 0) {
      const yakumanCount = yakuman.reduce((sum, yaku2) => sum + (yaku2.yakuman ?? 0), 0);
      return {
        yaku: yakuman,
        han: 0,
        yakuHan: 0,
        doraHan: 0,
        yakuman: yakumanCount,
        hasYaku: true
      };
    }
    const yaku = [];
    const add = (id, name, han) => {
      yaku.push({ id, name, han });
    };
    if (context.doubleRiichi) add("double-riichi", "\u4E24\u7ACB\u76F4", 2);
    else if (context.riichi) add("riichi", "\u7ACB\u76F4", 1);
    if (context.ippatsu && (context.riichi || context.doubleRiichi)) add("ippatsu", "\u4E00\u53D1", 1);
    if (closed && winType === "tsumo") add("menzen-tsumo", "\u95E8\u524D\u6E05\u81EA\u6478\u548C", 1);
    if (allTiles(division).every(isSimple)) add("tanyao", "\u65AD\u5E7A\u4E5D", 1);
    if (isPinfu(division, context, closed)) add("pinfu", "\u5E73\u548C", 1);
    const ryanpeikou = closed && division.pattern === "standard" && countIdenticalSequencePairs(division) >= 2;
    if (ryanpeikou) {
      add("ryanpeikou", "\u4E8C\u676F\u53E3", 3);
    } else if (closed && division.pattern === "standard" && countIdenticalSequencePairs(division) >= 1) {
      add("iipeikou", "\u4E00\u676F\u53E3", 1);
    }
    for (const yakuhai of detectYakuhai(division, context)) {
      yaku.push(yakuhai);
    }
    if (context.rinshan) add("rinshan-kaihou", "\u5CAD\u4E0A\u5F00\u82B1", 1);
    if (context.chankan) add("chankan", "\u62A2\u6760", 1);
    if (context.haitei && winType === "tsumo") add("haitei", "\u6D77\u5E95\u6478\u6708", 1);
    if (context.hotei && winType === "ron") add("houtei", "\u6CB3\u5E95\u635E\u9C7C", 1);
    if (division.pattern === "seven-pairs") add("chiitoitsu", "\u4E03\u5BF9\u5B50", 2);
    const chanta = isChanta(division);
    const junchan = isJunchan(division);
    if (junchan) add("junchan", "\u7EAF\u5168\u5E26\u5E7A\u4E5D", closed ? 3 : 2);
    else if (chanta) add("chanta", "\u6DF7\u5168\u5E26\u5E7A\u4E5D", closed ? 2 : 1);
    if (isIttsuu(division)) add("ittsuu", "\u4E00\u6C14\u901A\u8D2F", closed ? 2 : 1);
    if (isSanshokuDoujun(division)) add("sanshoku-doujun", "\u4E09\u8272\u540C\u987A", closed ? 2 : 1);
    if (isSanshokuDoukou(division)) add("sanshoku-doukou", "\u4E09\u8272\u540C\u523B", 2);
    if (countConcealedTriplets(division, context, winType) >= 3) add("sanankou", "\u4E09\u6697\u523B", 2);
    if (countQuads(division) >= 3) add("sankantsu", "\u4E09\u6760\u5B50", 2);
    if (isToitoi(division)) add("toitoi", "\u5BF9\u5BF9\u548C", 2);
    if (isShousangen(division)) add("shousangen", "\u5C0F\u4E09\u5143", 2);
    if (isHonroutou(division)) add("honroutou", "\u6DF7\u8001\u5934", 2);
    const flush = flushType(division);
    if (flush === "chinitsu") add("chinitsu", "\u6E05\u4E00\u8272", closed ? 6 : 5);
    else if (flush === "honitsu") add("honitsu", "\u6DF7\u4E00\u8272", closed ? 3 : 2);
    const yakuHan = yaku.reduce((sum, item) => sum + (item.han ?? 0), 0);
    const dora = detectDora(division, context);
    const doraHan = dora.reduce((sum, item) => sum + (item.han ?? 0), 0);
    return {
      yaku: [...yaku, ...dora],
      han: yakuHan + doraHan,
      yakuHan,
      doraHan,
      yakuman: 0,
      hasYaku: yakuHan > 0
    };
  }
  function detectYakuman(division, context, winType, closed) {
    const yakuman = [];
    const add = (id, name, multiplier = 1) => {
      yakuman.push({ id, name, yakuman: multiplier, isYakuman: true });
    };
    if (context.tenhou) add("tenhou", "\u5929\u548C");
    if (context.chiihou) add("chiihou", "\u5730\u548C");
    if (division.pattern === "thirteen-orphans") {
      add(division.isThirteenSided ? "kokushi-13" : "kokushi", division.isThirteenSided ? "\u56FD\u58EB\u65E0\u53CC\u5341\u4E09\u9762" : "\u56FD\u58EB\u65E0\u53CC", division.isThirteenSided ? 2 : 1);
    }
    if (division.pattern === "standard") {
      const concealedTriplets = countConcealedTriplets(division, context, winType);
      if (concealedTriplets === 4) {
        add(division.wait === "tanki" ? "suuankou-tanki" : "suuankou", division.wait === "tanki" ? "\u56DB\u6697\u523B\u5355\u9A91" : "\u56DB\u6697\u523B", division.wait === "tanki" ? 2 : 1);
      }
      if (["5z", "6z", "7z"].every((tile) => hasTripletOf(division, tile))) add("daisangen", "\u5927\u4E09\u5143");
      if (allTiles(division).every(isHonor)) add("tsuuiisou", "\u5B57\u4E00\u8272");
      const windTriplets = ["1z", "2z", "3z", "4z"].filter((tile) => hasTripletOf(division, tile));
      const windPair = division.pair?.[0] !== void 0 && isWind(division.pair[0]) ? division.pair[0] : void 0;
      if (windTriplets.length === 4) add("daisuushi", "\u5927\u56DB\u559C", 2);
      else if (windTriplets.length === 3 && windPair !== void 0) add("shousuushi", "\u5C0F\u56DB\u559C");
      if (isRyuuiisou(division)) add("ryuuiisou", "\u7EFF\u4E00\u8272");
      if (allTiles(division).every(isTerminal)) add("chinroutou", "\u6E05\u8001\u5934");
      const chuuren = chuurenInfo(division, closed);
      if (chuuren.isChuuren) {
        add(chuuren.pure ? "junsei-chuuren" : "chuuren", chuuren.pure ? "\u7EAF\u6B63\u4E5D\u83B2\u5B9D\u706F" : "\u4E5D\u83B2\u5B9D\u706F", chuuren.pure ? 2 : 1);
      }
      if (countQuads(division) === 4) add("suukantsu", "\u56DB\u6760\u5B50");
    }
    return yakuman;
  }
  function detectYakuhai(division, context) {
    if (division.pattern !== "standard") return [];
    const yaku = [];
    const seatWind = windToTile(context.seatWind);
    const prevalentWind = windToTile(context.prevalentWind);
    for (const tile of DRAGON_TILES) {
      if (hasTripletOf(division, tile)) {
        yaku.push({ id: `yakuhai-${tile}`, name: DRAGON_YAKU_NAMES[tile], han: 1 });
      }
    }
    if (seatWind !== void 0 && hasTripletOf(division, seatWind)) {
      yaku.push({ id: "yakuhai-seat-wind", name: "\u81EA\u98CE\u724C", han: 1 });
    }
    if (prevalentWind !== void 0 && hasTripletOf(division, prevalentWind)) {
      yaku.push({ id: "yakuhai-prevalent-wind", name: "\u573A\u98CE\u724C", han: 1 });
    }
    if (context.mode === "3p" && hasTripletOf(division, "4z")) {
      yaku.push({ id: "yakuhai-north", name: "\u5F79\u724C \u5317", han: 1 });
    }
    return yaku;
  }
  function detectDora(division, context) {
    const yaku = [];
    const tiles = division.tiles;
    const doraHan = countDora(tiles, context.doraIndicators ?? []);
    if (doraHan > 0) yaku.push({ id: "dora", name: "\u5B9D\u724C", han: doraHan, isDora: true });
    const uraHan = countDora(tiles, context.uraDoraIndicators ?? []);
    if (uraHan > 0) yaku.push({ id: "ura-dora", name: "\u91CC\u5B9D\u724C", han: uraHan, isDora: true });
    if (context.redDora !== false) {
      const redHan = tiles.filter(isRedFive).length;
      if (redHan > 0) yaku.push({ id: "aka-dora", name: "\u8D64\u5B9D\u724C", han: redHan, isDora: true });
    }
    const nukiHan = context.nukiDora ?? division.nukiDora;
    if ((context.mode ?? "4p") === "3p" && nukiHan > 0) {
      yaku.push({ id: "nuki-dora", name: "\u62D4\u5317\u5B9D\u724C", han: nukiHan, isDora: true });
    }
    return yaku;
  }
  function countDora(tiles, indicators) {
    const doraTiles = indicators.map(nextDoraTile);
    return tiles.reduce((sum, tile) => sum + doraTiles.filter((dora) => dora === normalizeTile(tile)).length, 0);
  }
  function resolveWinType(context) {
    if (context.winType !== void 0) return context.winType;
    if (context.tsumo) return "tsumo";
    return "ron";
  }
  function isPinfu(division, context, closed) {
    if (!closed || division.pattern !== "standard" || division.wait !== "ryanmen") return false;
    if (!division.sets.every((set) => set.type === "sequence")) return false;
    const pairTile = division.pair?.[0];
    return pairTile !== void 0 && !isValuePair(pairTile, context);
  }
  function isValuePair(tile, context = {}) {
    const normalized = normalizeTile(tile);
    return isDragon(normalized) || context.mode === "3p" && normalized === "4z" || normalized === windToTile(context.seatWind) || normalized === windToTile(context.prevalentWind);
  }
  function countIdenticalSequencePairs(division) {
    if (division.pattern !== "standard") return 0;
    const counts = /* @__PURE__ */ new Map();
    for (const set of division.sets) {
      if (set.type !== "sequence") continue;
      const key = set.tiles.map(normalizeTile).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
  }
  function isChanta(division) {
    if (division.pattern !== "standard") return false;
    if (!division.sets.some((set) => set.type === "sequence")) return false;
    const pairTile = division.pair?.[0];
    return pairTile !== void 0 && isYaochu(pairTile) && division.sets.every((set) => setHasYaochu(set));
  }
  function isJunchan(division) {
    if (division.pattern !== "standard") return false;
    if (!division.sets.some((set) => set.type === "sequence")) return false;
    const pairTile = division.pair?.[0];
    return pairTile !== void 0 && isTerminal(pairTile) && division.sets.every((set) => setHasTerminal(set)) && allTiles(division).every((tile) => !isHonor(tile));
  }
  function setHasYaochu(set) {
    return set.tiles.some(isYaochu);
  }
  function setHasTerminal(set) {
    return set.tiles.some(isTerminal);
  }
  function isIttsuu(division) {
    if (division.pattern !== "standard") return false;
    for (const suit of ["m", "p", "s"]) {
      if (hasSequence(division, [`1${suit}`, `2${suit}`, `3${suit}`]) && hasSequence(division, [`4${suit}`, `5${suit}`, `6${suit}`]) && hasSequence(division, [`7${suit}`, `8${suit}`, `9${suit}`])) {
        return true;
      }
    }
    return false;
  }
  function isSanshokuDoujun(division) {
    if (division.pattern !== "standard") return false;
    for (let start = 1; start <= 7; start += 1) {
      if (hasSequence(division, [`${start}m`, `${start + 1}m`, `${start + 2}m`]) && hasSequence(division, [`${start}p`, `${start + 1}p`, `${start + 2}p`]) && hasSequence(division, [`${start}s`, `${start + 1}s`, `${start + 2}s`])) {
        return true;
      }
    }
    return false;
  }
  function isSanshokuDoukou(division) {
    if (division.pattern !== "standard") return false;
    for (let rank = 1; rank <= 9; rank += 1) {
      if (hasTripletOf(division, `${rank}m`) && hasTripletOf(division, `${rank}p`) && hasTripletOf(division, `${rank}s`)) {
        return true;
      }
    }
    return false;
  }
  function hasSequence(division, tiles) {
    const key = tiles.join("");
    return division.sets.some((set) => set.type === "sequence" && set.tiles.map(normalizeTile).join("") === key);
  }
  function hasTripletOf(division, tile) {
    const normalized = normalizeTile(tile);
    return division.sets.some((set) => (set.type === "triplet" || set.type === "quad") && normalizeTile(set.tiles[0] ?? "") === normalized);
  }
  function countConcealedTriplets(division, context, winType) {
    if (division.pattern !== "standard") return 0;
    return division.sets.filter((set) => isConcealedTripletForYaku(set, division, context, winType)).length;
  }
  function isConcealedTripletForYaku(set, division, context, winType) {
    if (set.type !== "triplet" && set.type !== "quad") return false;
    if (set.open) return false;
    const winningTile = division.winningTile;
    if (winType === "ron" && set.source === "hand" && division.wait === "shanpon" && winningTile !== void 0 && set.tiles.some((tile) => normalizeTile(tile) === normalizeTile(winningTile))) {
      return false;
    }
    void context;
    return true;
  }
  function countQuads(division) {
    return division.sets.filter((set) => set.type === "quad").length;
  }
  function isToitoi(division) {
    return division.pattern === "standard" && division.sets.every((set) => set.type === "triplet" || set.type === "quad");
  }
  function isShousangen(division) {
    const dragonTriplets = ["5z", "6z", "7z"].filter((tile) => hasTripletOf(division, tile)).length;
    const pairTile = division.pair?.[0];
    return dragonTriplets === 2 && pairTile !== void 0 && isDragon(pairTile);
  }
  function isHonroutou(division) {
    return allTiles(division).every(isYaochu);
  }
  function flushType(division) {
    const tiles = allTiles(division);
    const suits = new Set(tiles.map(parseTile).filter((tile) => tile.suit !== "z").map((tile) => tile.suit));
    const hasHonors = tiles.some(isHonor);
    if (suits.size !== 1) return "none";
    return hasHonors ? "honitsu" : "chinitsu";
  }
  function isRyuuiisou(division) {
    const green = /* @__PURE__ */ new Set(["2s", "3s", "4s", "6s", "8s", "6z"]);
    return allTiles(division).every((tile) => green.has(normalizeTile(tile)));
  }
  function chuurenInfo(division, closed) {
    if (!closed || division.melds.length > 0) return { isChuuren: false, pure: false };
    const tiles = allTiles(division);
    if (tiles.some(isHonor)) return { isChuuren: false, pure: false };
    const suit = parseTile(tiles[0] ?? "1m").suit;
    if (tiles.some((tile) => parseTile(tile).suit !== suit)) return { isChuuren: false, pure: false };
    const counts = Array(10).fill(0);
    for (const tile of tiles) {
      const rank = parseTile(tile).rank;
      counts[rank] = (counts[rank] ?? 0) + 1;
    }
    if ((counts[1] ?? 0) < 3 || (counts[9] ?? 0) < 3) return { isChuuren: false, pure: false };
    for (let rank = 2; rank <= 8; rank += 1) {
      if ((counts[rank] ?? 0) < 1) return { isChuuren: false, pure: false };
    }
    let pure = false;
    if (division.concealedBeforeWin !== void 0) {
      const before = Array(10).fill(0);
      for (const tile of division.concealedBeforeWin) {
        const rank = parseTile(tile).rank;
        before[rank] = (before[rank] ?? 0) + 1;
      }
      pure = (before[1] ?? 0) === 3 && (before[9] ?? 0) === 3 && [2, 3, 4, 5, 6, 7, 8].every((rank) => (before[rank] ?? 0) === 1);
    }
    return { isChuuren: true, pure };
  }
  function allTiles(division) {
    return division.handTiles.map(normalizeTile);
  }
  function compareYakuResults(a, b) {
    if (a.yakuman !== b.yakuman) return b.yakuman - a.yakuman;
    if (a.hasYaku !== b.hasYaku) return a.hasYaku ? -1 : 1;
    return b.han - a.han;
  }
  function emptyYakuResult() {
    return {
      yaku: [],
      han: 0,
      yakuHan: 0,
      doraHan: 0,
      yakuman: 0,
      hasYaku: false
    };
  }

  // engine/src/fu.ts
  function calcFu(input, context = {}) {
    if (Array.isArray(input)) {
      const results = input.map((division2) => calcFuForDivision(division2, context));
      const best = results.sort((a, b) => a.fu - b.fu)[0];
      if (best === void 0) {
        throw new Error("Cannot calculate fu: no hand division provided.");
      }
      return best;
    }
    const division = input;
    if (division === void 0) {
      throw new Error("Cannot calculate fu: no hand division provided.");
    }
    return calcFuForDivision(division, context);
  }
  function calcFuForDivision(division, context) {
    if (division.pattern === "thirteen-orphans") {
      return { fu: 0, rawFu: 0, details: [{ reason: "yakuman hand does not use fu", fu: 0 }] };
    }
    if (division.pattern === "seven-pairs") {
      return { fu: 25, rawFu: 25, details: [{ reason: "chiitoitsu fixed fu", fu: 25 }] };
    }
    const winType = resolveWinType2(context);
    const closed = context.isClosed ?? division.isClosed;
    const details = [{ reason: "base", fu: 20 }];
    const pinfuShape = isPinfuShape(division, context);
    if (closed && winType === "tsumo" && pinfuShape) {
      return { fu: 20, rawFu: 20, details: [{ reason: "pinfu tsumo fixed 20 fu", fu: 20 }] };
    }
    if (winType === "tsumo") {
      details.push({ reason: "tsumo", fu: 2 });
    }
    if (closed && winType === "ron") {
      details.push({ reason: "menzen ron", fu: 10 });
    }
    const pairTile = division.pair?.[0];
    if (pairTile !== void 0) {
      const pairFu = valuePairFu(pairTile, context);
      if (pairFu > 0) details.push({ reason: "value pair", fu: pairFu });
    }
    if (division.wait === "tanki" || division.wait === "kanchan" || division.wait === "penchan") {
      details.push({ reason: `${division.wait} wait`, fu: 2 });
    }
    for (const set of division.sets) {
      const fu = setFu(set, division, context, winType);
      if (fu > 0) details.push({ reason: `${set.concealed ? "concealed" : "open"} ${set.type}`, fu });
    }
    const rawFu = details.reduce((sum, detail) => sum + detail.fu, 0);
    if (winType === "ron" && rawFu === 20) {
      return {
        fu: 30,
        rawFu,
        details: [...details, { reason: "open ron minimum rounded fu", fu: 10 }]
      };
    }
    return {
      fu: Math.ceil(rawFu / 10) * 10,
      rawFu,
      details
    };
  }
  function resolveWinType2(context) {
    if (context.winType !== void 0) return context.winType;
    if (context.tsumo) return "tsumo";
    return "ron";
  }
  function isPinfuShape(division, context) {
    if (division.pattern !== "standard" || division.wait !== "ryanmen") return false;
    if (!division.sets.every((set) => set.type === "sequence")) return false;
    const pairTile = division.pair?.[0];
    return pairTile !== void 0 && !isValuePair(pairTile, context);
  }
  function valuePairFu(tile, context) {
    const normalized = normalizeTile(tile);
    let fu = 0;
    if (normalized === "5z" || normalized === "6z" || normalized === "7z") fu += 2;
    if (context.mode === "3p" && normalized === "4z") fu += 2;
    if (normalized === windToTile(context.seatWind)) fu += 2;
    if (normalized === windToTile(context.prevalentWind)) fu += 2;
    return fu;
  }
  function setFu(set, division, context, winType) {
    if (set.type === "sequence") return 0;
    const terminalOrHonor = isTerminal(set.tiles[0] ?? "1m") || isHonor(set.tiles[0] ?? "1m");
    const concealed = isConcealedForFu(set, division, winType);
    if (set.type === "quad") {
      if (concealed) return terminalOrHonor ? 32 : 16;
      return terminalOrHonor ? 16 : 8;
    }
    if (concealed) return terminalOrHonor ? 8 : 4;
    void context;
    return terminalOrHonor ? 4 : 2;
  }
  function isConcealedForFu(set, division, winType) {
    if (set.open) return false;
    const winningTile = division.winningTile;
    if (winType === "ron" && set.source === "hand" && division.wait === "shanpon" && winningTile !== void 0 && set.tiles.some((tile) => normalizeTile(tile) === normalizeTile(winningTile))) {
      return false;
    }
    return true;
  }

  // engine/src/score.ts
  function calcScore(input) {
    const mode = input.mode ?? "4p";
    const han = input.han ?? 0;
    const fu = input.fu ?? 0;
    const yakuman = input.yakuman ?? 0;
    const isDealer = input.isDealer ?? false;
    const honba = input.honba ?? 0;
    const riichiBonus = (input.riichiSticks ?? 0) * 1e3;
    const limit = resolveLimit(han, fu, yakuman, input.kiriageMangan ?? false);
    const basePoints = resolveBasePoints(han, fu, yakuman, limit);
    if (input.winType === "ron") {
      const ron = ceil100(basePoints * (isDealer ? 6 : 4)) + honba * 300;
      return {
        han,
        fu,
        yakuman,
        basePoints,
        limit,
        isDealer,
        winType: "ron",
        mode,
        honba,
        riichiBonus,
        ron,
        total: ron + riichiBonus
      };
    }
    const tsumo = calcTsumoPayments(basePoints, isDealer, honba, mode, input.tsumoLoss ?? false);
    return {
      han,
      fu,
      yakuman,
      basePoints,
      limit,
      isDealer,
      winType: "tsumo",
      mode,
      honba,
      riichiBonus,
      tsumo,
      total: tsumo.total + riichiBonus
    };
  }
  function resolveLimit(han, fu, yakuman, kiriageMangan) {
    if (yakuman > 0 || han >= 13) return "yakuman";
    if (han >= 11) return "sanbaiman";
    if (han >= 8) return "baiman";
    if (han >= 6) return "haneman";
    if (han >= 5) return "mangan";
    if (kiriageMangan && (han === 4 && fu === 30 || han === 3 && fu === 60)) return "mangan";
    if (han >= 1 && fu > 0 && fu * 2 ** (han + 2) >= 2e3) return "mangan";
    return "none";
  }
  function resolveBasePoints(han, fu, yakuman, limit) {
    if (yakuman > 0) return 8e3 * yakuman;
    if (limit === "yakuman") return 8e3;
    if (limit === "sanbaiman") return 6e3;
    if (limit === "baiman") return 4e3;
    if (limit === "haneman") return 3e3;
    if (limit === "mangan") return 2e3;
    if (han <= 0 || fu <= 0) {
      throw new Error("Invalid score input: non-yakuman hands require positive han and fu.");
    }
    return fu * 2 ** (han + 2);
  }
  function calcTsumoPayments(basePoints, isDealer, honba, mode, tsumoLoss) {
    if (mode === "4p") {
      if (isDealer) {
        const all = ceil100(basePoints * 2) + honba * 100;
        return { all, nonDealer: all, total: all * 3 };
      }
      const dealer2 = ceil100(basePoints * 2) + honba * 100;
      const nonDealer2 = ceil100(basePoints) + honba * 100;
      return { dealer: dealer2, nonDealer: nonDealer2, total: dealer2 + nonDealer2 * 2 };
    }
    if (isDealer) {
      const base = tsumoLoss ? basePoints * 2 : basePoints * 3;
      const all = ceil100(base) + honba * 100;
      return { all, nonDealer: all, total: all * 2 };
    }
    const dealer = ceil100(basePoints * 2) + honba * 100;
    const nonDealer = ceil100(basePoints * (tsumoLoss ? 1 : 2)) + honba * 100;
    return { dealer, nonDealer, total: dealer + nonDealer };
  }
  function ceil100(value) {
    return Math.ceil(value / 100) * 100;
  }

  // engine/src/state.ts
  function createGame(config = {}) {
    const mode = config.mode ?? "4p";
    const playerCount = mode === "4p" ? 4 : 3;
    const startingPoints = config.startingPoints ?? (mode === "4p" ? 25e3 : 35e3);
    const returnPoints = config.returnPoints ?? (mode === "4p" ? 3e4 : 4e4);
    const uma = config.uma ?? (mode === "4p" ? [20, 10, -10, -20] : [15, 0, -15]);
    if (uma.length !== playerCount) {
      throw new Error(`Invalid uma config: ${mode} requires ${playerCount} uma entries.`);
    }
    return {
      mode,
      playerCount,
      length: config.length ?? "hanchan",
      scores: Array(playerCount).fill(startingPoints),
      dealerIndex: 0,
      roundWind: "east",
      handNumber: 0,
      honba: 0,
      riichiSticks: 0,
      riichiDeclared: Array(playerCount).fill(false),
      status: "playing",
      config: {
        mode,
        length: config.length ?? "hanchan",
        startingPoints,
        returnPoints,
        uma,
        tsumoLoss: config.tsumoLoss ?? false,
        agariYame: config.agariYame ?? true
      }
    };
  }
  function applyEvent(state, event) {
    if (state.status === "ended") {
      throw new Error("Cannot apply event: game has ended.");
    }
    if (event.type === "riichi") return applyRiichi(state, event.player);
    if (event.type === "draw") return applyDraw(state, event);
    return applyWin(state, event);
  }
  function applyRiichi(state, player) {
    assertPlayer(state, player);
    if (state.riichiDeclared[player]) {
      throw new Error(`Player ${player} has already declared riichi.`);
    }
    if ((state.scores[player] ?? 0) < 1e3) {
      throw new Error(`Player ${player} does not have enough points to declare riichi.`);
    }
    const scores = [...state.scores];
    scores[player] = (scores[player] ?? 0) - 1e3;
    const riichiDeclared = [...state.riichiDeclared];
    riichiDeclared[player] = true;
    const deltas = Array(state.playerCount).fill(0);
    deltas[player] = -1e3;
    return {
      ...state,
      scores,
      riichiDeclared,
      riichiSticks: state.riichiSticks + 1,
      lastResult: { type: "riichi", deltas }
    };
  }
  function applyWin(state, event) {
    assertPlayer(state, event.winner);
    const winType = event.winType ?? (event.loser !== void 0 || event.from !== void 0 ? "ron" : "tsumo");
    const loser = event.loser ?? event.from;
    if (winType === "ron") {
      if (loser === void 0) throw new Error("Ron win requires loser/from player.");
      assertPlayer(state, loser);
      if (loser === event.winner) throw new Error("Winner and loser cannot be the same player.");
    }
    const { score, yaku, fu } = scoreWin(state, event, winType);
    const deltas = Array(state.playerCount).fill(0);
    if (winType === "ron") {
      const payment = score.ron;
      if (payment === void 0 || loser === void 0) throw new Error("Internal error: ron score missing payment.");
      deltas[event.winner] = (deltas[event.winner] ?? 0) + payment + state.riichiSticks * 1e3;
      deltas[loser] = (deltas[loser] ?? 0) - payment;
    } else {
      const tsumo = score.tsumo;
      if (tsumo === void 0) throw new Error("Internal error: tsumo score missing payments.");
      for (let player = 0; player < state.playerCount; player += 1) {
        if (player === event.winner) continue;
        const payment = event.winner === state.dealerIndex ? tsumo.all ?? tsumo.nonDealer ?? 0 : player === state.dealerIndex ? tsumo.dealer ?? 0 : tsumo.nonDealer ?? 0;
        deltas[event.winner] = (deltas[event.winner] ?? 0) + payment;
        deltas[player] = (deltas[player] ?? 0) - payment;
      }
      deltas[event.winner] = (deltas[event.winner] ?? 0) + state.riichiSticks * 1e3;
    }
    const scores = state.scores.map((scoreValue, index) => scoreValue + (deltas[index] ?? 0));
    const baseState = {
      ...state,
      scores,
      riichiSticks: 0,
      riichiDeclared: Array(state.playerCount).fill(false),
      lastResult: { type: "win", deltas, score, ...yaku === void 0 ? {} : { yaku }, ...fu === void 0 ? {} : { fu } }
    };
    if (scores.some((scoreValue) => scoreValue < 0)) {
      return { ...baseState, status: "ended" };
    }
    const dealerWon = event.winner === state.dealerIndex;
    if (isAllLast(state)) {
      if (!dealerWon) return { ...baseState, status: "ended" };
      if (state.config.agariYame && isTopOrTiedTop(scores, state.dealerIndex)) {
        return { ...baseState, honba: state.honba + 1, status: "ended" };
      }
    }
    if (dealerWon) {
      return { ...baseState, honba: state.honba + 1 };
    }
    return advanceRound({ ...baseState, honba: 0 });
  }
  function scoreWin(state, event, winType) {
    let yaku;
    let fu;
    let han = event.han;
    let fuValue = event.fu;
    let yakuman = event.yakuman;
    if (event.division !== void 0) {
      yaku = detectYaku(event.division, { ...event.context, winType, mode: state.mode });
      if (!yaku.hasYaku && yaku.yakuman === 0) {
        throw new Error("Invalid win: dora alone does not satisfy the one-yaku requirement.");
      }
      yakuman = yaku.yakuman;
      han = yaku.han;
      if (yakuman === 0) {
        fu = calcFu(event.division, { ...event.context, winType, mode: state.mode });
        fuValue = fu.fu;
      }
    }
    const scoreInput = {
      ...han === void 0 ? {} : { han },
      ...fuValue === void 0 ? {} : { fu: fuValue },
      ...yakuman === void 0 ? {} : { yakuman },
      isDealer: event.winner === state.dealerIndex,
      winType,
      mode: state.mode,
      honba: state.honba,
      riichiSticks: state.riichiSticks,
      tsumoLoss: state.config.tsumoLoss
    };
    return { score: calcScore(scoreInput), ...yaku === void 0 ? {} : { yaku }, ...fu === void 0 ? {} : { fu } };
  }
  function applyDraw(state, event) {
    if (event.tenpai.length !== state.playerCount) {
      throw new Error(`Invalid draw event: expected ${state.playerCount} tenpai flags.`);
    }
    const deltas = drawDeltas(state, event.tenpai);
    const scores = state.scores.map((scoreValue, index) => scoreValue + (deltas[index] ?? 0));
    const dealerTenpai = event.tenpai[state.dealerIndex] ?? false;
    const baseState = {
      ...state,
      scores,
      honba: state.honba + 1,
      riichiDeclared: Array(state.playerCount).fill(false),
      lastResult: { type: "draw", deltas }
    };
    if (scores.some((scoreValue) => scoreValue < 0)) {
      return { ...baseState, status: "ended" };
    }
    if (isAllLast(state)) {
      if (!dealerTenpai) return { ...baseState, status: "ended" };
      if (state.config.agariYame && isTopOrTiedTop(scores, state.dealerIndex)) {
        return { ...baseState, status: "ended" };
      }
    }
    if (dealerTenpai) return baseState;
    return advanceRound(baseState);
  }
  function drawDeltas(state, tenpai) {
    const deltas = Array(state.playerCount).fill(0);
    const tenpaiPlayers = tenpai.flatMap((value, index) => value ? [index] : []);
    const notenPlayers = tenpai.flatMap((value, index) => !value ? [index] : []);
    if (tenpaiPlayers.length === 0 || notenPlayers.length === 0) return deltas;
    if (state.mode === "4p") {
      const gain = 3e3 / tenpaiPlayers.length;
      const loss = 3e3 / notenPlayers.length;
      for (const player of tenpaiPlayers) deltas[player] = (deltas[player] ?? 0) + gain;
      for (const player of notenPlayers) deltas[player] = (deltas[player] ?? 0) - loss;
      return deltas;
    }
    if (tenpaiPlayers.length === 1) {
      const player = tenpaiPlayers[0] ?? 0;
      deltas[player] = (deltas[player] ?? 0) + 2e3;
      for (const notenPlayer of notenPlayers) deltas[notenPlayer] = (deltas[notenPlayer] ?? 0) - 1e3;
    } else if (tenpaiPlayers.length === 2) {
      for (const player of tenpaiPlayers) deltas[player] = (deltas[player] ?? 0) + 1e3;
      const notenPlayer = notenPlayers[0] ?? 0;
      deltas[notenPlayer] = (deltas[notenPlayer] ?? 0) - 2e3;
    }
    return deltas;
  }
  function advanceRound(state) {
    const nextDealer = (state.dealerIndex + 1) % state.playerCount;
    const nextHandNumber = state.handNumber + 1;
    if (nextHandNumber < state.playerCount) {
      return { ...state, dealerIndex: nextDealer, handNumber: nextHandNumber };
    }
    if (state.length === "east" || state.roundWind === "south") {
      return { ...state, dealerIndex: nextDealer, handNumber: 0, status: "ended" };
    }
    return {
      ...state,
      dealerIndex: nextDealer,
      roundWind: "south",
      handNumber: 0
    };
  }
  function isAllLast(state) {
    if (state.length === "east") {
      return state.roundWind === "east" && state.handNumber === state.playerCount - 1;
    }
    return state.roundWind === "south" && state.handNumber === state.playerCount - 1;
  }
  function isTopOrTiedTop(scores, player) {
    const playerScore = scores[player] ?? Number.NEGATIVE_INFINITY;
    return scores.every((score) => playerScore >= score);
  }
  function assertPlayer(state, player) {
    if (!Number.isInteger(player) || player < 0 || player >= state.playerCount) {
      throw new Error(`Invalid player index ${player}.`);
    }
  }

  // engine/src/settlement.ts
  function settleGame(stateOrScores, config = {}) {
    const scores = Array.isArray(stateOrScores) ? [...stateOrScores] : [...stateOrScores.scores];
    const mode = config.mode ?? (Array.isArray(stateOrScores) ? scores.length === 3 ? "3p" : "4p" : stateOrScores.mode);
    const playerCount = mode === "4p" ? 4 : 3;
    if (scores.length !== playerCount) {
      throw new Error(`Invalid settlement scores: ${mode} requires ${playerCount} players.`);
    }
    const startingPoints = config.startingPoints ?? (Array.isArray(stateOrScores) ? mode === "4p" ? 25e3 : 35e3 : stateOrScores.config.startingPoints);
    const returnPoints = config.returnPoints ?? (Array.isArray(stateOrScores) ? mode === "4p" ? 3e4 : 4e4 : stateOrScores.config.returnPoints);
    const uma = config.uma ?? (Array.isArray(stateOrScores) ? defaultUma(mode) : stateOrScores.config.uma);
    const riichiSticks = config.riichiSticks ?? (Array.isArray(stateOrScores) ? 0 : stateOrScores.riichiSticks);
    const dealerOrder = config.dealerOrder ?? Array.from({ length: playerCount }, (_, index) => index);
    if (uma.length !== playerCount) {
      throw new Error(`Invalid uma config: ${mode} requires ${playerCount} entries.`);
    }
    const rankingBeforeSticks = rankPlayers(scores, dealerOrder);
    const topPlayer = rankingBeforeSticks[0]?.player ?? 0;
    const adjustedScores = [...scores];
    adjustedScores[topPlayer] = (adjustedScores[topPlayer] ?? 0) + riichiSticks * 1e3;
    const ranking = rankPlayers(adjustedScores, dealerOrder);
    const oka = (returnPoints - startingPoints) * playerCount / 1e3;
    const players = ranking.map((ranked, index) => {
      const rank = index + 1;
      const playerUma = uma[index] ?? 0;
      const playerOka = index === 0 ? oka : 0;
      const settlement = (adjustedScores[ranked.player] ?? 0) / 1e3 - returnPoints / 1e3 + playerUma + playerOka;
      return {
        player: ranked.player,
        rank,
        score: scores[ranked.player] ?? 0,
        adjustedScore: adjustedScores[ranked.player] ?? 0,
        uma: playerUma,
        oka: playerOka,
        settlement
      };
    });
    const deltas = Array(playerCount).fill(0);
    for (const player of players) {
      deltas[player.player] = player.settlement;
    }
    return { players, deltas };
  }
  function defaultUma(mode) {
    return mode === "4p" ? [20, 10, -10, -20] : [15, 0, -15];
  }
  function rankPlayers(scores, dealerOrder) {
    const orderIndex = new Map(dealerOrder.map((player, index) => [player, index]));
    return scores.map((score, player) => ({ player, score })).sort((a, b) => b.score - a.score || (orderIndex.get(a.player) ?? a.player) - (orderIndex.get(b.player) ?? b.player));
  }
  return __toCommonJS(index_exports);
})();
