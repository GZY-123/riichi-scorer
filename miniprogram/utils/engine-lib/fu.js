"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcFu = calcFu;
const tiles_js_1 = require("./tiles.js");
const yaku_js_1 = require("./yaku.js");
function calcFu(input, context = {}) {
    if (Array.isArray(input)) {
        const results = input.map((division) => calcFuForDivision(division, context));
        const best = results.sort((a, b) => a.fu - b.fu)[0];
        if (best === undefined) {
            throw new Error("Cannot calculate fu: no hand division provided.");
        }
        return best;
    }
    const division = input;
    if (division === undefined) {
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
    const winType = resolveWinType(context);
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
    if (pairTile !== undefined) {
        const pairFu = valuePairFu(pairTile, context);
        if (pairFu > 0)
            details.push({ reason: "value pair", fu: pairFu });
    }
    if (division.wait === "tanki" || division.wait === "kanchan" || division.wait === "penchan") {
        details.push({ reason: `${division.wait} wait`, fu: 2 });
    }
    for (const set of division.sets) {
        const fu = setFu(set, division, context, winType);
        if (fu > 0)
            details.push({ reason: `${set.concealed ? "concealed" : "open"} ${set.type}`, fu });
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
function resolveWinType(context) {
    if (context.winType !== undefined)
        return context.winType;
    if (context.tsumo)
        return "tsumo";
    return "ron";
}
function isPinfuShape(division, context) {
    if (division.pattern !== "standard" || division.wait !== "ryanmen")
        return false;
    if (!division.sets.every((set) => set.type === "sequence"))
        return false;
    const pairTile = division.pair?.[0];
    return pairTile !== undefined && !(0, yaku_js_1.isValuePair)(pairTile, context);
}
function valuePairFu(tile, context) {
    const normalized = (0, tiles_js_1.normalizeTile)(tile);
    let fu = 0;
    if (normalized === "5z" || normalized === "6z" || normalized === "7z")
        fu += 2;
    if (context.mode === "3p" && normalized === "4z")
        fu += 2;
    if (normalized === (0, tiles_js_1.windToTile)(context.seatWind))
        fu += 2;
    if (normalized === (0, tiles_js_1.windToTile)(context.prevalentWind))
        fu += 2;
    return fu;
}
function setFu(set, division, context, winType) {
    if (set.type === "sequence")
        return 0;
    const terminalOrHonor = (0, tiles_js_1.isTerminal)(set.tiles[0] ?? "1m") || (0, tiles_js_1.isHonor)(set.tiles[0] ?? "1m");
    const concealed = isConcealedForFu(set, division, winType);
    if (set.type === "quad") {
        if (concealed)
            return terminalOrHonor ? 32 : 16;
        return terminalOrHonor ? 16 : 8;
    }
    if (concealed)
        return terminalOrHonor ? 8 : 4;
    void context;
    return terminalOrHonor ? 4 : 2;
}
function isConcealedForFu(set, division, winType) {
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
    return true;
}
