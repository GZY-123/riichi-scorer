export type GameMode = "4p" | "3p";
export type WinType = "ron" | "tsumo";
export type TileString = string;

export interface Meld {
  type: "chi" | "pon" | "kan-open" | "kan-closed" | "kan-added" | "north";
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

export interface HandDivision {
  pattern: "standard" | "seven-pairs" | "thirteen-orphans";
}

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
  limit: "none" | "mangan" | "haneman" | "baiman" | "sanbaiman" | "yakuman";
  isDealer: boolean;
  winType: WinType;
  mode: GameMode;
  honba: number;
  riichiBonus: number;
  ron?: number;
  tsumo?: TsumoPayments;
  total: number;
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

export interface EngineApi {
  parseHand(input: ParseHandInput | TileString[], winningTile?: TileString, options?: ParseHandOptions): HandDivision[];
  calcScore(input: ScoreInput): ScoreResult;
  settleGame(scores: number[], config?: SettlementConfig): SettlementResult;
}
