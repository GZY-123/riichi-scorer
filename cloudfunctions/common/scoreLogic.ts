import type { GameMode, PlayerState, RoomDocument, Seat } from "./roomLogic";
import {
  MeldInput,
  assertTileCopiesWithinFour,
  assertTileNotation,
  validateMelds,
  validateTileList
} from "./tileNotation";

export type WinType = "ron" | "tsumo";

export interface ScoreHandRequest {
  mode?: GameMode;
  winnerOpenid?: string;
  loserOpenid?: string;
  tiles?: string[];
  melds?: MeldInput[];
  winningTile?: string;
  winType?: WinType;
  seatWind?: Seat;
  prevalentWind?: Seat;
  riichi?: boolean;
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  doraIndicators?: string[];
  uraDoraIndicators?: string[];
  nukiDora?: number;
  honba?: number;
  riichiSticks?: number;
}

export interface EngineYaku {
  id: string;
  name: string;
  han?: number;
  yakuman?: number;
  isYakuman?: boolean;
  isDora?: boolean;
}

export interface EngineYakuResult {
  yaku: EngineYaku[];
  han: number;
  yakuHan: number;
  doraHan: number;
  yakuman: number;
  hasYaku: boolean;
}

export interface EngineFuResult {
  fu: number;
  rawFu: number;
  details: Array<{ reason: string; fu: number }>;
}

export interface EngineTsumoPayments {
  dealer?: number;
  nonDealer?: number;
  all?: number;
  total: number;
}

export interface EngineScoreResult {
  han: number;
  fu: number;
  yakuman: number;
  basePoints: number;
  limit: string;
  isDealer: boolean;
  winType: WinType;
  mode: GameMode;
  honba: number;
  riichiBonus: number;
  ron?: number;
  tsumo?: EngineTsumoPayments;
  total: number;
}

export interface EngineApi {
  parseHand(input: {
    mode: GameMode;
    tiles: string[];
    winningTile?: string;
    melds: MeldInput[];
  }): unknown;
  detectYaku(input: unknown, context: EngineContext): EngineYakuResult;
  calcFu(input: unknown, context: EngineContext): EngineFuResult;
  calcScore(input: {
    han: number;
    fu: number;
    yakuman: number;
    isDealer: boolean;
    winType: WinType;
    mode: GameMode;
    honba: number;
    riichiSticks: number;
  }): EngineScoreResult;
}

export interface EngineContext {
  mode: GameMode;
  winType: WinType;
  seatWind: Seat;
  prevalentWind: Seat;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  doraIndicators: string[];
  uraDoraIndicators: string[];
  redDora: boolean;
  nukiDora: number;
}

export interface WinEventAdjustments {
  riichiStickDelta: number;
  honbaDelta: number;
  advanceRound: boolean;
}

export interface WinDeltasInput {
  players: readonly PlayerState[];
  winnerOpenid: string;
  loserOpenid?: string;
  dealerSeat: Seat;
  winType: WinType;
  score: EngineScoreResult;
  riichiSticks: number;
}

export interface ScoreHandPreview {
  winnerOpenid: string;
  loserOpenid?: string;
  winType: WinType;
  tiles: string[];
  melds: MeldInput[];
  winningTile: string;
  context: EngineContext;
  yaku: EngineYaku[];
  han: number;
  fu: number;
  yakuman: number;
  score: EngineScoreResult;
  deltas: Record<string, number>;
  riichiStickDelta: number;
  honbaDelta: number;
  advanceRound: boolean;
  note: string;
  applyEvent: {
    type: "win";
    deltas: Record<string, number>;
    riichiStickDelta: number;
    honbaDelta: number;
    advanceRound: boolean;
    note: string;
  };
}

const SEAT_TEXT: Record<Seat, string> = {
  east: "东",
  south: "南",
  west: "西",
  north: "北"
};

export function buildScoreHandPreview(
  request: ScoreHandRequest,
  room: RoomDocument,
  engine: EngineApi
): ScoreHandPreview {
  const mode = request.mode ?? room.mode;
  if (mode !== room.mode) {
    throw new Error("请求玩法与房间玩法不一致");
  }

  const winner = findPlayer(room.players, request.winnerOpenid, "和牌者");
  const winType = request.winType ?? "ron";
  const loser = winType === "ron" ? findPlayer(room.players, request.loserOpenid, "放铳者") : undefined;
  if (loser !== undefined && loser.openid === winner.openid) {
    throw new Error("放铳者不能是和牌者");
  }

  const tiles = validateTileList(request.tiles, mode, "手牌");
  const melds = validateMelds(request.melds, mode);
  assertTileCopiesWithinFour([...tiles, ...melds.flatMap((meld) => meld.tiles)], mode);

  const winningTile = request.winningTile ?? tiles[tiles.length - 1];
  assertTileNotation(winningTile, mode, "和牌张");
  const doraIndicators = validateTileList(request.doraIndicators ?? [], mode, "宝牌指示牌", {
    allowEmpty: true
  });
  const uraDoraIndicators = validateTileList(request.uraDoraIndicators ?? [], mode, "里宝牌指示牌", {
    allowEmpty: true
  });
  const honba = normalizeNonNegativeInteger(request.honba ?? room.round.honba, "本场");
  const riichiSticks = normalizeNonNegativeInteger(request.riichiSticks ?? room.round.riichiSticks, "供托");
  const nukiDora = normalizeNonNegativeInteger(request.nukiDora ?? countNorthMelds(melds), "拔北数");

  const context: EngineContext = {
    mode,
    winType,
    seatWind: request.seatWind ?? winner.seat,
    prevalentWind: request.prevalentWind ?? room.round.prevalentWind,
    riichi: request.riichi === true,
    doubleRiichi: request.doubleRiichi === true,
    ippatsu: request.ippatsu === true,
    doraIndicators,
    uraDoraIndicators,
    redDora: true,
    nukiDora
  };

  const divisions = engine.parseHand({ mode, tiles, winningTile, melds });
  const yaku = engine.detectYaku(divisions, context);
  if (!yaku.hasYaku && yaku.yakuman <= 0) {
    throw new Error("没有役，不能和牌");
  }
  const fu = engine.calcFu(divisions, context);
  const score = engine.calcScore({
    han: yaku.han,
    fu: fu.fu,
    yakuman: yaku.yakuman,
    isDealer: winner.seat === room.round.dealerSeat,
    winType,
    mode,
    honba,
    riichiSticks
  });
  const deltas = buildWinDeltas({
    players: room.players,
    winnerOpenid: winner.openid,
    loserOpenid: loser?.openid,
    dealerSeat: room.round.dealerSeat,
    winType,
    score,
    riichiSticks
  });
  const adjustments = buildWinEventAdjustments({
    winnerIsDealer: winner.seat === room.round.dealerSeat,
    honba,
    riichiSticks
  });
  const note = buildScoreNote(winner, loser, winType, yaku, fu, score);

  return {
    winnerOpenid: winner.openid,
    ...(loser === undefined ? {} : { loserOpenid: loser.openid }),
    winType,
    tiles,
    melds,
    winningTile,
    context,
    yaku: yaku.yaku,
    han: yaku.han,
    fu: fu.fu,
    yakuman: yaku.yakuman,
    score,
    deltas,
    riichiStickDelta: adjustments.riichiStickDelta,
    honbaDelta: adjustments.honbaDelta,
    advanceRound: adjustments.advanceRound,
    note,
    applyEvent: {
      type: "win",
      deltas,
      riichiStickDelta: adjustments.riichiStickDelta,
      honbaDelta: adjustments.honbaDelta,
      advanceRound: adjustments.advanceRound,
      note
    }
  };
}

export function buildWinDeltas(input: WinDeltasInput): Record<string, number> {
  const deltas = Object.fromEntries(input.players.map((player) => [player.openid, 0])) as Record<string, number>;
  const winner = findPlayer(input.players, input.winnerOpenid, "和牌者");
  const riichiBonus = input.riichiSticks * 1000;

  if (input.winType === "ron") {
    const loser = findPlayer(input.players, input.loserOpenid, "放铳者");
    if (loser.openid === winner.openid) {
      throw new Error("放铳者不能是和牌者");
    }
    const payment = input.score.ron;
    if (payment === undefined) {
      throw new Error("荣和点数缺失");
    }
    deltas[winner.openid] += payment + riichiBonus;
    deltas[loser.openid] -= payment;
    return deltas;
  }

  const tsumo = input.score.tsumo;
  if (tsumo === undefined) {
    throw new Error("自摸点数缺失");
  }

  let winnerGain = riichiBonus;
  for (const player of input.players) {
    if (player.openid === winner.openid) {
      continue;
    }
    const payment = resolveTsumoPayment(player.seat, input.dealerSeat, winner.seat, tsumo);
    deltas[player.openid] -= payment;
    winnerGain += payment;
  }
  deltas[winner.openid] += winnerGain;
  return deltas;
}

export function buildWinEventAdjustments(input: {
  winnerIsDealer: boolean;
  honba: number;
  riichiSticks: number;
}): WinEventAdjustments {
  return {
    riichiStickDelta: input.riichiSticks === 0 ? 0 : -input.riichiSticks,
    honbaDelta: input.winnerIsDealer ? 1 : -input.honba,
    advanceRound: !input.winnerIsDealer
  };
}

function resolveTsumoPayment(
  payerSeat: Seat,
  dealerSeat: Seat,
  winnerSeat: Seat,
  tsumo: EngineTsumoPayments
): number {
  if (tsumo.all !== undefined) {
    return tsumo.all;
  }
  if (payerSeat === dealerSeat) {
    return tsumo.dealer ?? 0;
  }
  if (winnerSeat === dealerSeat) {
    return tsumo.nonDealer ?? tsumo.all ?? 0;
  }
  return tsumo.nonDealer ?? 0;
}

function buildScoreNote(
  winner: PlayerState,
  loser: PlayerState | undefined,
  winType: WinType,
  yaku: EngineYakuResult,
  fu: EngineFuResult,
  score: EngineScoreResult
): string {
  const yakuText = yaku.yaku.map((item) => item.name).join(" / ") || "无役";
  const scoreText =
    winType === "ron"
      ? `荣和 ${score.ron ?? 0}`
      : score.tsumo?.all !== undefined
        ? `自摸 ${score.tsumo.all} all`
        : `自摸 庄${score.tsumo?.dealer ?? 0}/闲${score.tsumo?.nonDealer ?? 0}`;
  const loserText = loser === undefined ? "" : `，放铳 ${SEAT_TEXT[loser.seat]} ${loser.nickName}`;
  const valueText = yaku.yakuman > 0 ? `${yaku.yakuman}倍役满` : `${yaku.han}番${fu.fu}符`;
  return `拍照算点：${SEAT_TEXT[winner.seat]} ${winner.nickName}${loserText}，${valueText}，${scoreText}，${yakuText}`;
}

function findPlayer(players: readonly PlayerState[], openid: string | undefined, label: string): PlayerState {
  if (openid === undefined || !openid.trim()) {
    throw new Error(`${label}不能为空`);
  }
  const player = players.find((item) => item.openid === openid);
  if (player === undefined) {
    throw new Error(`${label}不在房间内`);
  }
  return player;
}

function normalizeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}必须是非负整数`);
  }
  return value;
}

function countNorthMelds(melds: readonly MeldInput[]): number {
  return melds.filter((meld) => meld.type === "north").length;
}
