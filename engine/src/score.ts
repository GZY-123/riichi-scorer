import type { GameMode, LimitName, ScoreInput, ScoreResult, TsumoPayments } from "./types.js";

export function calcScore(input: ScoreInput): ScoreResult {
  const mode = input.mode ?? "4p";
  const han = input.han ?? 0;
  const fu = input.fu ?? 0;
  const yakuman = input.yakuman ?? 0;
  const isDealer = input.isDealer ?? false;
  const honba = input.honba ?? 0;
  const riichiBonus = (input.riichiSticks ?? 0) * 1000;
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

function resolveLimit(han: number, fu: number, yakuman: number, kiriageMangan: boolean): LimitName {
  if (yakuman > 0 || han >= 13) return "yakuman";
  if (han >= 11) return "sanbaiman";
  if (han >= 8) return "baiman";
  if (han >= 6) return "haneman";
  if (han >= 5) return "mangan";
  if (kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) return "mangan";
  if (han >= 1 && fu > 0 && fu * 2 ** (han + 2) >= 2000) return "mangan";
  return "none";
}

function resolveBasePoints(han: number, fu: number, yakuman: number, limit: LimitName): number {
  if (yakuman > 0) return 8000 * yakuman;
  if (limit === "yakuman") return 8000;
  if (limit === "sanbaiman") return 6000;
  if (limit === "baiman") return 4000;
  if (limit === "haneman") return 3000;
  if (limit === "mangan") return 2000;
  if (han <= 0 || fu <= 0) {
    throw new Error("Invalid score input: non-yakuman hands require positive han and fu.");
  }
  return fu * 2 ** (han + 2);
}

function calcTsumoPayments(
  basePoints: number,
  isDealer: boolean,
  honba: number,
  mode: GameMode,
  tsumoLoss: boolean
): TsumoPayments {
  if (mode === "4p") {
    if (isDealer) {
      const all = ceil100(basePoints * 2) + honba * 100;
      return { all, nonDealer: all, total: all * 3 };
    }
    const dealer = ceil100(basePoints * 2) + honba * 100;
    const nonDealer = ceil100(basePoints) + honba * 100;
    return { dealer, nonDealer, total: dealer + nonDealer * 2 };
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

function ceil100(value: number): number {
  return Math.ceil(value / 100) * 100;
}
