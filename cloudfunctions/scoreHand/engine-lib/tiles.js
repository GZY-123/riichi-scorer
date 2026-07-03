"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORPHANS = void 0;
exports.parseTile = parseTile;
exports.normalizeTile = normalizeTile;
exports.isRedFive = isRedFive;
exports.tileIndex = tileIndex;
exports.tileFromIndex = tileFromIndex;
exports.sortTiles = sortTiles;
exports.tileCounts = tileCounts;
exports.assertTileCountsWithinFour = assertTileCountsWithinFour;
exports.assertModeTile = assertModeTile;
exports.assertModeTiles = assertModeTiles;
exports.isHonor = isHonor;
exports.isTerminal = isTerminal;
exports.isYaochu = isYaochu;
exports.isSimple = isSimple;
exports.isDragon = isDragon;
exports.isWind = isWind;
exports.windToTile = windToTile;
exports.nextDoraTile = nextDoraTile;
exports.allTileTypes = allTileTypes;
const SUIT_OFFSETS = {
    m: 0,
    p: 9,
    s: 18,
    z: 27
};
const WIND_TO_TILE = {
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
    if (index < 9)
        return `${index + 1}m`;
    if (index < 18)
        return `${index - 8}p`;
    if (index < 27)
        return `${index - 17}s`;
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
    if (wind === undefined)
        return undefined;
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
exports.ORPHANS = [
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
