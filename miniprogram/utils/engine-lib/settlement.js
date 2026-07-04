"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleGame = settleGame;
function settleGame(stateOrScores, config = {}) {
    const scores = Array.isArray(stateOrScores) ? [...stateOrScores] : [...stateOrScores.scores];
    const mode = config.mode ?? (Array.isArray(stateOrScores) ? (scores.length === 3 ? "3p" : "4p") : stateOrScores.mode);
    const playerCount = mode === "4p" ? 4 : 3;
    if (scores.length !== playerCount) {
        throw new Error(`Invalid settlement scores: ${mode} requires ${playerCount} players.`);
    }
    const startingPoints = config.startingPoints ?? (Array.isArray(stateOrScores) ? (mode === "4p" ? 25000 : 35000) : stateOrScores.config.startingPoints);
    const returnPoints = config.returnPoints ?? (Array.isArray(stateOrScores) ? (mode === "4p" ? 30000 : 40000) : stateOrScores.config.returnPoints);
    const uma = config.uma ?? (Array.isArray(stateOrScores) ? defaultUma(mode) : stateOrScores.config.uma);
    const riichiSticks = config.riichiSticks ?? (Array.isArray(stateOrScores) ? 0 : stateOrScores.riichiSticks);
    const dealerOrder = config.dealerOrder ?? Array.from({ length: playerCount }, (_, index) => index);
    if (uma.length !== playerCount) {
        throw new Error(`Invalid uma config: ${mode} requires ${playerCount} entries.`);
    }
    const rankingBeforeSticks = rankPlayers(scores, dealerOrder);
    const topPlayer = rankingBeforeSticks[0]?.player ?? 0;
    const adjustedScores = [...scores];
    adjustedScores[topPlayer] = (adjustedScores[topPlayer] ?? 0) + riichiSticks * 1000;
    const ranking = rankPlayers(adjustedScores, dealerOrder);
    const oka = ((returnPoints - startingPoints) * playerCount) / 1000;
    const players = ranking.map((ranked, index) => {
        const rank = index + 1;
        const playerUma = uma[index] ?? 0;
        const playerOka = index === 0 ? oka : 0;
        const settlement = (adjustedScores[ranked.player] ?? 0) / 1000 - returnPoints / 1000 + playerUma + playerOka;
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
    return scores
        .map((score, player) => ({ player, score }))
        .sort((a, b) => b.score - a.score || (orderIndex.get(a.player) ?? a.player) - (orderIndex.get(b.player) ?? b.player));
}
