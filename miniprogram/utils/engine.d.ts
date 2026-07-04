export type GameMode = "4p" | "3p";
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

export interface EngineApi {
  parseHand(input: ParseHandInput | TileString[], winningTile?: TileString, options?: ParseHandOptions): HandDivision[];
}
