import { avatarFallbackText } from "../../utils/profile";

export type GameMode = "3p" | "4p";
export type Seat = "east" | "south" | "west" | "north";
export type RoomLength = "east" | "hanchan";
export type RoomUma = [number, number, number, number] | [number, number, number];

export interface PlayerState {
  openid: string;
  nickName: string;
  avatarFileId?: string;
  seat: Seat;
  score: number;
}

export interface RoomRules {
  length: RoomLength;
  startScore: number;
  returnScore: number;
  uma: RoomUma;
  tobi: boolean;
  kiriageMangan: boolean;
  tsumoLoss: boolean;
}

export interface RoomForRules {
  mode: GameMode;
  rules?: RoomRules;
}

export interface SettlementPlayerResult {
  player: number;
  rank: number;
  score: number;
  adjustedScore: number;
  uma: number;
  oka: number;
  settlement: number;
}

export interface SettlementEngineApi {
  settleGame(
    scores: number[],
    config: {
      mode: GameMode;
      startingPoints: number;
      returnPoints: number;
      uma: number[];
      riichiSticks: number;
      dealerOrder: number[];
    }
  ): {
    players: SettlementPlayerResult[];
    deltas: number[];
  };
}

export interface SettlementRow {
  openid: string;
  rank: number;
  nickName: string;
  avatarFileId?: string;
  avatarText: string;
  seatText: string;
  rawScore: number;
  adjustedScore: number;
  finalScore: number;
  finalScoreText: string;
  scoreClass: "score-positive" | "score-negative" | "score-neutral";
  rankClass: "rank-1" | "rank-2" | "rank-3" | "";
}

const SEAT_TEXT: Record<Seat, string> = {
  east: "东",
  south: "南",
  west: "西",
  north: "北"
};

const DEFAULT_RULES_BY_MODE: Record<GameMode, RoomRules> = {
  "3p": {
    length: "hanchan",
    startScore: 35000,
    returnScore: 40000,
    uma: [15, 0, -15],
    tobi: true,
    kiriageMangan: false,
    tsumoLoss: false
  },
  "4p": {
    length: "hanchan",
    startScore: 25000,
    returnScore: 30000,
    uma: [20, 10, -10, -20],
    tobi: true,
    kiriageMangan: false,
    tsumoLoss: false
  }
};

export function resolveRules(room: RoomForRules): RoomRules {
  const rules = room.rules ?? DEFAULT_RULES_BY_MODE[room.mode];
  return {
    ...rules,
    uma: [...rules.uma] as RoomUma
  };
}

export function rulesSummary(mode: GameMode, rules: RoomRules): string {
  return `${rules.length === "east" ? "东风" : "半庄"} · ${umaSummary(mode, rules.uma)}`;
}

export function settleView(input: {
  players: readonly PlayerState[];
  mode: GameMode;
  rules: RoomRules;
  riichiSticks: number;
  engine: SettlementEngineApi;
}): SettlementRow[] {
  const result = input.engine.settleGame(
    input.players.map((player) => player.score),
    {
      mode: input.mode,
      startingPoints: input.rules.startScore,
      returnPoints: input.rules.returnScore,
      uma: [...input.rules.uma],
      riichiSticks: input.riichiSticks,
      dealerOrder: input.players.map((_player, index) => index)
    }
  );

  return result.players.map((settlement) => {
    const player = input.players[settlement.player];
    if (player === undefined) {
      throw new Error("结算结果包含未知玩家");
    }
    return {
      openid: player.openid,
      rank: settlement.rank,
      nickName: player.nickName,
      ...(player.avatarFileId ? { avatarFileId: player.avatarFileId } : {}),
      avatarText: avatarFallbackText(player.nickName),
      seatText: SEAT_TEXT[player.seat],
      rawScore: settlement.score,
      adjustedScore: settlement.adjustedScore,
      finalScore: settlement.settlement,
      finalScoreText: formatSettlementScore(settlement.settlement),
      scoreClass: scoreClass(settlement.settlement),
      rankClass: rankClass(settlement.rank)
    };
  });
}

export function formatSettlementScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function umaSummary(mode: GameMode, uma: readonly number[]): string {
  if (mode === "4p") {
    if (sameNumbers(uma, [20, 10, -10, -20])) return "马10-20";
    if (sameNumbers(uma, [10, 5, -5, -10])) return "马5-10";
    if (sameNumbers(uma, [0, 0, 0, 0])) return "无马";
  } else {
    if (sameNumbers(uma, [15, 0, -15])) return "马15-0";
    if (sameNumbers(uma, [10, 0, -10])) return "马10-0";
    if (sameNumbers(uma, [0, 0, 0])) return "无马";
  }
  return "自定义马";
}

function scoreClass(score: number): "score-positive" | "score-negative" | "score-neutral" {
  if (score > 0) return "score-positive";
  if (score < 0) return "score-negative";
  return "score-neutral";
}

function rankClass(rank: number): "rank-1" | "rank-2" | "rank-3" | "" {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
