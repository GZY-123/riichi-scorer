export type GameMode = "4p" | "3p";
export type WinType = "ron" | "tsumo";
export type TileString = string;
export type Wind = "east" | "south" | "west" | "north";
export type RoundLength = "east" | "hanchan";

export type MeldType = "chi" | "pon" | "kan-open" | "kan-closed" | "kan-added" | "north";

export interface Meld {
  type: MeldType;
  tiles: TileString[];
  calledTile?: TileString;
}

export interface ParseHandInput {
  tiles?: TileString[];
  concealedTiles?: TileString[];
  winningTile?: TileString;
  melds?: Meld[];
  mode?: GameMode;
}

export interface ParseHandOptions {
  mode?: GameMode;
}

export type HandPattern = "standard" | "seven-pairs" | "thirteen-orphans";
export type HandSetType = "sequence" | "triplet" | "quad";
export type WaitType = "ryanmen" | "kanchan" | "penchan" | "tanki" | "shanpon" | "unknown";

export interface HandSet {
  type: HandSetType;
  tiles: TileString[];
  open: boolean;
  concealed: boolean;
  source: "hand" | "meld";
}

export interface HandDivision {
  pattern: HandPattern;
  sets: HandSet[];
  pair?: TileString[];
  pairs?: TileString[][];
  wait: WaitType;
  tiles: TileString[];
  handTiles: TileString[];
  concealedTiles: TileString[];
  concealedBeforeWin?: TileString[];
  winningTile?: TileString;
  melds: Meld[];
  isClosed: boolean;
  isThirteenSided?: boolean;
  isPureNineGates?: boolean;
  nukiDora: number;
}

export interface YakuContext {
  mode?: GameMode;
  winType?: WinType;
  tsumo?: boolean;
  ron?: boolean;
  seatWind?: Wind | TileString;
  prevalentWind?: Wind | TileString;
  isClosed?: boolean;
  riichi?: boolean;
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  rinshan?: boolean;
  chankan?: boolean;
  haitei?: boolean;
  hotei?: boolean;
  tenhou?: boolean;
  chiihou?: boolean;
  doraIndicators?: TileString[];
  uraDoraIndicators?: TileString[];
  redDora?: boolean;
  nukiDora?: number;
}

export interface Yaku {
  id: string;
  name: string;
  han?: number;
  yakuman?: number;
  isYakuman?: boolean;
  isDora?: boolean;
}

export interface YakuResult {
  yaku: Yaku[];
  han: number;
  yakuHan: number;
  doraHan: number;
  yakuman: number;
  hasYaku: boolean;
}

export interface FuContext {
  mode?: GameMode;
  winType?: WinType;
  tsumo?: boolean;
  ron?: boolean;
  seatWind?: Wind | TileString;
  prevalentWind?: Wind | TileString;
  isClosed?: boolean;
}

export interface FuDetail {
  reason: string;
  fu: number;
}

export interface FuResult {
  fu: number;
  rawFu: number;
  details: FuDetail[];
}

export type LimitName = "none" | "mangan" | "haneman" | "baiman" | "sanbaiman" | "yakuman";

export interface ScoreInput {
  han?: number;
  fu?: number;
  yakuman?: number;
  isDealer?: boolean;
  winType: WinType;
  mode?: GameMode;
  honba?: number;
  riichiSticks?: number;
  tsumoLoss?: boolean;
  kiriageMangan?: boolean;
}

export interface TsumoPayments {
  dealer?: number;
  nonDealer?: number;
  all?: number;
  total: number;
}

export interface ScoreResult {
  han: number;
  fu: number;
  yakuman: number;
  basePoints: number;
  limit: LimitName;
  isDealer: boolean;
  winType: WinType;
  mode: GameMode;
  honba: number;
  riichiBonus: number;
  ron?: number;
  tsumo?: TsumoPayments;
  total: number;
}

export interface GameConfig {
  mode?: GameMode;
  length?: RoundLength;
  startingPoints?: number;
  returnPoints?: number;
  uma?: number[];
  tsumoLoss?: boolean;
  agariYame?: boolean;
}

export interface GameState {
  mode: GameMode;
  playerCount: 3 | 4;
  length: RoundLength;
  scores: number[];
  dealerIndex: number;
  roundWind: "east" | "south";
  handNumber: number;
  honba: number;
  riichiSticks: number;
  riichiDeclared: boolean[];
  status: "playing" | "ended";
  config: Required<Pick<GameConfig, "mode" | "length" | "startingPoints" | "returnPoints" | "uma" | "tsumoLoss" | "agariYame">>;
  lastResult?: GameEventResult;
}

export type GameEvent = RiichiEvent | WinEvent | DrawEvent;

export interface RiichiEvent {
  type: "riichi";
  player: number;
}

export interface WinEvent {
  type: "win";
  winner: number;
  loser?: number;
  from?: number;
  winType?: WinType;
  han?: number;
  fu?: number;
  yakuman?: number;
  division?: HandDivision | HandDivision[];
  context?: YakuContext & FuContext;
}

export interface DrawEvent {
  type: "draw";
  tenpai: boolean[];
}

export interface GameEventResult {
  type: GameEvent["type"];
  deltas: number[];
  score?: ScoreResult;
  yaku?: YakuResult;
  fu?: FuResult;
}

export interface SettlementConfig {
  mode?: GameMode;
  startingPoints?: number;
  returnPoints?: number;
  uma?: number[];
  riichiSticks?: number;
  dealerOrder?: number[];
}

export interface PlayerSettlement {
  player: number;
  rank: number;
  score: number;
  adjustedScore: number;
  uma: number;
  oka: number;
  settlement: number;
}

export interface SettlementResult {
  players: PlayerSettlement[];
  deltas: number[];
}
