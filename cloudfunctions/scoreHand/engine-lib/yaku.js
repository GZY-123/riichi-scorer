"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectYaku = detectYaku;
exports.isValuePair = isValuePair;
const tiles_js_1 = require("./tiles.js");
const DRAGON_TILES = ["5z", "6z", "7z"];
const DRAGON_YAKU_NAMES = {
    "5z": "役牌 白",
    "6z": "役牌 发",
    "7z": "役牌 中"
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
        const yakumanCount = yakuman.reduce((sum, yaku) => sum + (yaku.yakuman ?? 0), 0);
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
    if (context.doubleRiichi)
        add("double-riichi", "两立直", 2);
    else if (context.riichi)
        add("riichi", "立直", 1);
    if (context.ippatsu && (context.riichi || context.doubleRiichi))
        add("ippatsu", "一发", 1);
    if (closed && winType === "tsumo")
        add("menzen-tsumo", "门前清自摸和", 1);
    if (allTiles(division).every(tiles_js_1.isSimple))
        add("tanyao", "断幺九", 1);
    if (isPinfu(division, context, closed))
        add("pinfu", "平和", 1);
    const ryanpeikou = closed && division.pattern === "standard" && countIdenticalSequencePairs(division) >= 2;
    if (ryanpeikou) {
        add("ryanpeikou", "二杯口", 3);
    }
    else if (closed && division.pattern === "standard" && countIdenticalSequencePairs(division) >= 1) {
        add("iipeikou", "一杯口", 1);
    }
    for (const yakuhai of detectYakuhai(division, context)) {
        yaku.push(yakuhai);
    }
    if (context.rinshan)
        add("rinshan-kaihou", "岭上开花", 1);
    if (context.chankan)
        add("chankan", "抢杠", 1);
    if (context.haitei && winType === "tsumo")
        add("haitei", "海底摸月", 1);
    if (context.hotei && winType === "ron")
        add("houtei", "河底捞鱼", 1);
    if (division.pattern === "seven-pairs")
        add("chiitoitsu", "七对子", 2);
    const chanta = isChanta(division);
    const junchan = isJunchan(division);
    if (junchan)
        add("junchan", "纯全带幺九", closed ? 3 : 2);
    else if (chanta)
        add("chanta", "混全带幺九", closed ? 2 : 1);
    if (isIttsuu(division))
        add("ittsuu", "一气通贯", closed ? 2 : 1);
    if (isSanshokuDoujun(division))
        add("sanshoku-doujun", "三色同顺", closed ? 2 : 1);
    if (isSanshokuDoukou(division))
        add("sanshoku-doukou", "三色同刻", 2);
    if (countConcealedTriplets(division, context, winType) >= 3)
        add("sanankou", "三暗刻", 2);
    if (countQuads(division) >= 3)
        add("sankantsu", "三杠子", 2);
    if (isToitoi(division))
        add("toitoi", "对对和", 2);
    if (isShousangen(division))
        add("shousangen", "小三元", 2);
    if (isHonroutou(division))
        add("honroutou", "混老头", 2);
    const flush = flushType(division);
    if (flush === "chinitsu")
        add("chinitsu", "清一色", closed ? 6 : 5);
    else if (flush === "honitsu")
        add("honitsu", "混一色", closed ? 3 : 2);
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
    if (context.tenhou)
        add("tenhou", "天和");
    if (context.chiihou)
        add("chiihou", "地和");
    if (division.pattern === "thirteen-orphans") {
        add(division.isThirteenSided ? "kokushi-13" : "kokushi", division.isThirteenSided ? "国士无双十三面" : "国士无双", division.isThirteenSided ? 2 : 1);
    }
    if (division.pattern === "standard") {
        const concealedTriplets = countConcealedTriplets(division, context, winType);
        if (concealedTriplets === 4) {
            add(division.wait === "tanki" ? "suuankou-tanki" : "suuankou", division.wait === "tanki" ? "四暗刻单骑" : "四暗刻", division.wait === "tanki" ? 2 : 1);
        }
        if (["5z", "6z", "7z"].every((tile) => hasTripletOf(division, tile)))
            add("daisangen", "大三元");
        if (allTiles(division).every(tiles_js_1.isHonor))
            add("tsuuiisou", "字一色");
        const windTriplets = ["1z", "2z", "3z", "4z"].filter((tile) => hasTripletOf(division, tile));
        const windPair = division.pair?.[0] !== undefined && (0, tiles_js_1.isWind)(division.pair[0]) ? division.pair[0] : undefined;
        if (windTriplets.length === 4)
            add("daisuushi", "大四喜", 2);
        else if (windTriplets.length === 3 && windPair !== undefined)
            add("shousuushi", "小四喜");
        if (isRyuuiisou(division))
            add("ryuuiisou", "绿一色");
        if (allTiles(division).every(tiles_js_1.isTerminal))
            add("chinroutou", "清老头");
        const chuuren = chuurenInfo(division, closed);
        if (chuuren.isChuuren) {
            add(chuuren.pure ? "junsei-chuuren" : "chuuren", chuuren.pure ? "纯正九莲宝灯" : "九莲宝灯", chuuren.pure ? 2 : 1);
        }
        if (countQuads(division) === 4)
            add("suukantsu", "四杠子");
    }
    return yakuman;
}
function detectYakuhai(division, context) {
    if (division.pattern !== "standard")
        return [];
    const yaku = [];
    const seatWind = (0, tiles_js_1.windToTile)(context.seatWind);
    const prevalentWind = (0, tiles_js_1.windToTile)(context.prevalentWind);
    for (const tile of DRAGON_TILES) {
        if (hasTripletOf(division, tile)) {
            yaku.push({ id: `yakuhai-${tile}`, name: DRAGON_YAKU_NAMES[tile], han: 1 });
        }
    }
    if (seatWind !== undefined && hasTripletOf(division, seatWind)) {
        yaku.push({ id: "yakuhai-seat-wind", name: "自风牌", han: 1 });
    }
    if (prevalentWind !== undefined && hasTripletOf(division, prevalentWind)) {
        yaku.push({ id: "yakuhai-prevalent-wind", name: "场风牌", han: 1 });
    }
    if (context.mode === "3p" && hasTripletOf(division, "4z")) {
        yaku.push({ id: "yakuhai-north", name: "役牌 北", han: 1 });
    }
    return yaku;
}
function detectDora(division, context) {
    const yaku = [];
    const tiles = division.tiles;
    const doraHan = countDora(tiles, context.doraIndicators ?? []);
    if (doraHan > 0)
        yaku.push({ id: "dora", name: "宝牌", han: doraHan, isDora: true });
    const uraHan = countDora(tiles, context.uraDoraIndicators ?? []);
    if (uraHan > 0)
        yaku.push({ id: "ura-dora", name: "里宝牌", han: uraHan, isDora: true });
    if (context.redDora !== false) {
        const redHan = tiles.filter(tiles_js_1.isRedFive).length;
        if (redHan > 0)
            yaku.push({ id: "aka-dora", name: "赤宝牌", han: redHan, isDora: true });
    }
    const nukiHan = context.nukiDora ?? division.nukiDora;
    if ((context.mode ?? "4p") === "3p" && nukiHan > 0) {
        yaku.push({ id: "nuki-dora", name: "拔北宝牌", han: nukiHan, isDora: true });
    }
    return yaku;
}
function countDora(tiles, indicators) {
    const doraTiles = indicators.map(tiles_js_1.nextDoraTile);
    return tiles.reduce((sum, tile) => sum + doraTiles.filter((dora) => dora === (0, tiles_js_1.normalizeTile)(tile)).length, 0);
}
function resolveWinType(context) {
    if (context.winType !== undefined)
        return context.winType;
    if (context.tsumo)
        return "tsumo";
    return "ron";
}
function isPinfu(division, context, closed) {
    if (!closed || division.pattern !== "standard" || division.wait !== "ryanmen")
        return false;
    if (!division.sets.every((set) => set.type === "sequence"))
        return false;
    const pairTile = division.pair?.[0];
    return pairTile !== undefined && !isValuePair(pairTile, context);
}
function isValuePair(tile, context = {}) {
    const normalized = (0, tiles_js_1.normalizeTile)(tile);
    return ((0, tiles_js_1.isDragon)(normalized) ||
        (context.mode === "3p" && normalized === "4z") ||
        normalized === (0, tiles_js_1.windToTile)(context.seatWind) ||
        normalized === (0, tiles_js_1.windToTile)(context.prevalentWind));
}
function countIdenticalSequencePairs(division) {
    if (division.pattern !== "standard")
        return 0;
    const counts = new Map();
    for (const set of division.sets) {
        if (set.type !== "sequence")
            continue;
        const key = set.tiles.map(tiles_js_1.normalizeTile).join("");
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
}
function isChanta(division) {
    if (division.pattern !== "standard")
        return false;
    if (!division.sets.some((set) => set.type === "sequence"))
        return false;
    const pairTile = division.pair?.[0];
    return (pairTile !== undefined &&
        (0, tiles_js_1.isYaochu)(pairTile) &&
        division.sets.every((set) => setHasYaochu(set)));
}
function isJunchan(division) {
    if (division.pattern !== "standard")
        return false;
    if (!division.sets.some((set) => set.type === "sequence"))
        return false;
    const pairTile = division.pair?.[0];
    return (pairTile !== undefined &&
        (0, tiles_js_1.isTerminal)(pairTile) &&
        division.sets.every((set) => setHasTerminal(set)) &&
        allTiles(division).every((tile) => !(0, tiles_js_1.isHonor)(tile)));
}
function setHasYaochu(set) {
    return set.tiles.some(tiles_js_1.isYaochu);
}
function setHasTerminal(set) {
    return set.tiles.some(tiles_js_1.isTerminal);
}
function isIttsuu(division) {
    if (division.pattern !== "standard")
        return false;
    for (const suit of ["m", "p", "s"]) {
        if (hasSequence(division, [`1${suit}`, `2${suit}`, `3${suit}`]) &&
            hasSequence(division, [`4${suit}`, `5${suit}`, `6${suit}`]) &&
            hasSequence(division, [`7${suit}`, `8${suit}`, `9${suit}`])) {
            return true;
        }
    }
    return false;
}
function isSanshokuDoujun(division) {
    if (division.pattern !== "standard")
        return false;
    for (let start = 1; start <= 7; start += 1) {
        if (hasSequence(division, [`${start}m`, `${start + 1}m`, `${start + 2}m`]) &&
            hasSequence(division, [`${start}p`, `${start + 1}p`, `${start + 2}p`]) &&
            hasSequence(division, [`${start}s`, `${start + 1}s`, `${start + 2}s`])) {
            return true;
        }
    }
    return false;
}
function isSanshokuDoukou(division) {
    if (division.pattern !== "standard")
        return false;
    for (let rank = 1; rank <= 9; rank += 1) {
        if (hasTripletOf(division, `${rank}m`) &&
            hasTripletOf(division, `${rank}p`) &&
            hasTripletOf(division, `${rank}s`)) {
            return true;
        }
    }
    return false;
}
function hasSequence(division, tiles) {
    const key = tiles.join("");
    return division.sets.some((set) => set.type === "sequence" && set.tiles.map(tiles_js_1.normalizeTile).join("") === key);
}
function hasTripletOf(division, tile) {
    const normalized = (0, tiles_js_1.normalizeTile)(tile);
    return division.sets.some((set) => (set.type === "triplet" || set.type === "quad") && (0, tiles_js_1.normalizeTile)(set.tiles[0] ?? "") === normalized);
}
function countConcealedTriplets(division, context, winType) {
    if (division.pattern !== "standard")
        return 0;
    return division.sets.filter((set) => isConcealedTripletForYaku(set, division, context, winType)).length;
}
function isConcealedTripletForYaku(set, division, context, winType) {
    if (set.type !== "triplet" && set.type !== "quad")
        return false;
    if (set.open)
        return false;
    const winningTile = division.winningTile;
    if (winType === "ron" &&
        set.source === "hand" &&
        division.wait === "shanpon" &&
        winningTile !== undefined &&
        set.tiles.some((tile) => (0, tiles_js_1.normalizeTile)(tile) === (0, tiles_js_1.normalizeTile)(winningTile))) {
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
    return dragonTriplets === 2 && pairTile !== undefined && (0, tiles_js_1.isDragon)(pairTile);
}
function isHonroutou(division) {
    return allTiles(division).every(tiles_js_1.isYaochu);
}
function flushType(division) {
    const tiles = allTiles(division);
    const suits = new Set(tiles.map(tiles_js_1.parseTile).filter((tile) => tile.suit !== "z").map((tile) => tile.suit));
    const hasHonors = tiles.some(tiles_js_1.isHonor);
    if (suits.size !== 1)
        return "none";
    return hasHonors ? "honitsu" : "chinitsu";
}
function isRyuuiisou(division) {
    const green = new Set(["2s", "3s", "4s", "6s", "8s", "6z"]);
    return allTiles(division).every((tile) => green.has((0, tiles_js_1.normalizeTile)(tile)));
}
function chuurenInfo(division, closed) {
    if (!closed || division.melds.length > 0)
        return { isChuuren: false, pure: false };
    const tiles = allTiles(division);
    if (tiles.some(tiles_js_1.isHonor))
        return { isChuuren: false, pure: false };
    const suit = (0, tiles_js_1.parseTile)(tiles[0] ?? "1m").suit;
    if (tiles.some((tile) => (0, tiles_js_1.parseTile)(tile).suit !== suit))
        return { isChuuren: false, pure: false };
    const counts = Array(10).fill(0);
    for (const tile of tiles) {
        const rank = (0, tiles_js_1.parseTile)(tile).rank;
        counts[rank] = (counts[rank] ?? 0) + 1;
    }
    if ((counts[1] ?? 0) < 3 || (counts[9] ?? 0) < 3)
        return { isChuuren: false, pure: false };
    for (let rank = 2; rank <= 8; rank += 1) {
        if ((counts[rank] ?? 0) < 1)
            return { isChuuren: false, pure: false };
    }
    let pure = false;
    if (division.concealedBeforeWin !== undefined) {
        const before = Array(10).fill(0);
        for (const tile of division.concealedBeforeWin) {
            const rank = (0, tiles_js_1.parseTile)(tile).rank;
            before[rank] = (before[rank] ?? 0) + 1;
        }
        pure =
            (before[1] ?? 0) === 3 &&
                (before[9] ?? 0) === 3 &&
                [2, 3, 4, 5, 6, 7, 8].every((rank) => (before[rank] ?? 0) === 1);
    }
    return { isChuuren: true, pure };
}
function allTiles(division) {
    return division.handTiles.map(tiles_js_1.normalizeTile);
}
function compareYakuResults(a, b) {
    if (a.yakuman !== b.yakuman)
        return b.yakuman - a.yakuman;
    if (a.hasYaku !== b.hasYaku)
        return a.hasYaku ? -1 : 1;
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
