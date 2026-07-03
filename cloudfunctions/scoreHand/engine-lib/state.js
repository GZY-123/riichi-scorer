"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGame = createGame;
exports.applyEvent = applyEvent;
const fu_js_1 = require("./fu.js");
const score_js_1 = require("./score.js");
const yaku_js_1 = require("./yaku.js");
function createGame(config = {}) {
    const mode = config.mode ?? "4p";
    const playerCount = mode === "4p" ? 4 : 3;
    const startingPoints = config.startingPoints ?? (mode === "4p" ? 25000 : 35000);
    const returnPoints = config.returnPoints ?? (mode === "4p" ? 30000 : 40000);
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
    if (event.type === "riichi")
        return applyRiichi(state, event.player);
    if (event.type === "draw")
        return applyDraw(state, event);
    return applyWin(state, event);
}
function applyRiichi(state, player) {
    assertPlayer(state, player);
    if (state.riichiDeclared[player]) {
        throw new Error(`Player ${player} has already declared riichi.`);
    }
    if ((state.scores[player] ?? 0) < 1000) {
        throw new Error(`Player ${player} does not have enough points to declare riichi.`);
    }
    const scores = [...state.scores];
    scores[player] = (scores[player] ?? 0) - 1000;
    const riichiDeclared = [...state.riichiDeclared];
    riichiDeclared[player] = true;
    const deltas = Array(state.playerCount).fill(0);
    deltas[player] = -1000;
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
    const winType = event.winType ?? (event.loser !== undefined || event.from !== undefined ? "ron" : "tsumo");
    const loser = event.loser ?? event.from;
    if (winType === "ron") {
        if (loser === undefined)
            throw new Error("Ron win requires loser/from player.");
        assertPlayer(state, loser);
        if (loser === event.winner)
            throw new Error("Winner and loser cannot be the same player.");
    }
    const { score, yaku, fu } = scoreWin(state, event, winType);
    const deltas = Array(state.playerCount).fill(0);
    if (winType === "ron") {
        const payment = score.ron;
        if (payment === undefined || loser === undefined)
            throw new Error("Internal error: ron score missing payment.");
        deltas[event.winner] = (deltas[event.winner] ?? 0) + payment + state.riichiSticks * 1000;
        deltas[loser] = (deltas[loser] ?? 0) - payment;
    }
    else {
        const tsumo = score.tsumo;
        if (tsumo === undefined)
            throw new Error("Internal error: tsumo score missing payments.");
        for (let player = 0; player < state.playerCount; player += 1) {
            if (player === event.winner)
                continue;
            const payment = event.winner === state.dealerIndex ? tsumo.all ?? tsumo.nonDealer ?? 0 : player === state.dealerIndex ? tsumo.dealer ?? 0 : tsumo.nonDealer ?? 0;
            deltas[event.winner] = (deltas[event.winner] ?? 0) + payment;
            deltas[player] = (deltas[player] ?? 0) - payment;
        }
        deltas[event.winner] = (deltas[event.winner] ?? 0) + state.riichiSticks * 1000;
    }
    const scores = state.scores.map((scoreValue, index) => scoreValue + (deltas[index] ?? 0));
    const baseState = {
        ...state,
        scores,
        riichiSticks: 0,
        riichiDeclared: Array(state.playerCount).fill(false),
        lastResult: { type: "win", deltas, score, ...(yaku === undefined ? {} : { yaku }), ...(fu === undefined ? {} : { fu }) }
    };
    if (scores.some((scoreValue) => scoreValue < 0)) {
        return { ...baseState, status: "ended" };
    }
    const dealerWon = event.winner === state.dealerIndex;
    if (isAllLast(state)) {
        if (!dealerWon)
            return { ...baseState, status: "ended" };
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
    if (event.division !== undefined) {
        yaku = (0, yaku_js_1.detectYaku)(event.division, { ...event.context, winType, mode: state.mode });
        if (!yaku.hasYaku && yaku.yakuman === 0) {
            throw new Error("Invalid win: dora alone does not satisfy the one-yaku requirement.");
        }
        yakuman = yaku.yakuman;
        han = yaku.han;
        if (yakuman === 0) {
            fu = (0, fu_js_1.calcFu)(event.division, { ...event.context, winType, mode: state.mode });
            fuValue = fu.fu;
        }
    }
    const scoreInput = {
        ...(han === undefined ? {} : { han }),
        ...(fuValue === undefined ? {} : { fu: fuValue }),
        ...(yakuman === undefined ? {} : { yakuman }),
        isDealer: event.winner === state.dealerIndex,
        winType,
        mode: state.mode,
        honba: state.honba,
        riichiSticks: state.riichiSticks,
        tsumoLoss: state.config.tsumoLoss
    };
    return { score: (0, score_js_1.calcScore)(scoreInput), ...(yaku === undefined ? {} : { yaku }), ...(fu === undefined ? {} : { fu }) };
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
        lastResult: { type: "draw", deltas }
    };
    if (scores.some((scoreValue) => scoreValue < 0)) {
        return { ...baseState, status: "ended" };
    }
    if (isAllLast(state)) {
        if (!dealerTenpai)
            return { ...baseState, status: "ended" };
        if (state.config.agariYame && isTopOrTiedTop(scores, state.dealerIndex)) {
            return { ...baseState, status: "ended" };
        }
    }
    if (dealerTenpai)
        return baseState;
    return advanceRound(baseState);
}
function drawDeltas(state, tenpai) {
    const deltas = Array(state.playerCount).fill(0);
    const tenpaiPlayers = tenpai.flatMap((value, index) => (value ? [index] : []));
    const notenPlayers = tenpai.flatMap((value, index) => (!value ? [index] : []));
    if (tenpaiPlayers.length === 0 || notenPlayers.length === 0)
        return deltas;
    if (state.mode === "4p") {
        const gain = 3000 / tenpaiPlayers.length;
        const loss = 3000 / notenPlayers.length;
        for (const player of tenpaiPlayers)
            deltas[player] = (deltas[player] ?? 0) + gain;
        for (const player of notenPlayers)
            deltas[player] = (deltas[player] ?? 0) - loss;
        return deltas;
    }
    if (tenpaiPlayers.length === 1) {
        const player = tenpaiPlayers[0] ?? 0;
        deltas[player] = (deltas[player] ?? 0) + 2000;
        for (const notenPlayer of notenPlayers)
            deltas[notenPlayer] = (deltas[notenPlayer] ?? 0) - 1000;
    }
    else if (tenpaiPlayers.length === 2) {
        for (const player of tenpaiPlayers)
            deltas[player] = (deltas[player] ?? 0) + 1000;
        const notenPlayer = notenPlayers[0] ?? 0;
        deltas[notenPlayer] = (deltas[notenPlayer] ?? 0) - 2000;
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
