export type GameMode = "3p" | "4p";
export type RoomLength = "east" | "hanchan";
export type RoomUma = [number, number, number, number] | [number, number, number];

export interface RoomRules {
  length: RoomLength;
  startScore: number;
  returnScore: number;
  uma: RoomUma;
  tobi: boolean;
  kiriageMangan: boolean;
  tsumoLoss: boolean;
}

export interface UmaOption {
  label: string;
  summary: string;
  value: RoomUma;
}

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

const UMA_OPTIONS_BY_MODE: Record<GameMode, UmaOption[]> = {
  "3p": [
    { label: "15-0", summary: "马15-0", value: [15, 0, -15] },
    { label: "10-0", summary: "马10-0", value: [10, 0, -10] },
    { label: "无马", summary: "无马", value: [0, 0, 0] }
  ],
  "4p": [
    { label: "10-20", summary: "马10-20", value: [20, 10, -10, -20] },
    { label: "5-10", summary: "马5-10", value: [10, 5, -5, -10] },
    { label: "无马", summary: "无马", value: [0, 0, 0, 0] }
  ]
};

export function defaultRoomRules(mode: GameMode): RoomRules {
  const rules = DEFAULT_RULES_BY_MODE[mode];
  return {
    ...rules,
    uma: [...rules.uma] as RoomUma
  };
}

export function umaOptionsForMode(mode: GameMode): UmaOption[] {
  return UMA_OPTIONS_BY_MODE[mode].map((option) => ({
    ...option,
    value: [...option.value] as RoomUma
  }));
}

export function umaOptionIndex(mode: GameMode, uma: readonly number[]): number {
  const index = UMA_OPTIONS_BY_MODE[mode].findIndex((option) => sameNumbers(option.value, uma));
  return index >= 0 ? index : 0;
}

export function rulesSummary(mode: GameMode, rules: RoomRules): string {
  const parts = [
    rules.length === "east" ? "东风" : "半庄",
    `${rules.startScore}/${rules.returnScore}`,
    umaSummary(mode, rules.uma)
  ];
  if (rules.tobi) {
    parts.push("击飞");
  }
  if (rules.kiriageMangan) {
    parts.push("切上");
  }
  if (mode === "3p" && rules.tsumoLoss) {
    parts.push("自摸损");
  }
  return parts.join(" · ");
}

export function umaSummary(mode: GameMode, uma: readonly number[]): string {
  const option = UMA_OPTIONS_BY_MODE[mode].find((item) => sameNumbers(item.value, uma));
  if (option !== undefined) {
    return option.summary;
  }
  return "自定义马";
}

export function validateRoomRules(mode: GameMode, rules: RoomRules): string | null {
  if (rules.length !== "east" && rules.length !== "hanchan") {
    return "局数必须是东风或半庄";
  }
  const startError = validatePoint(rules.startScore, "起始点");
  if (startError !== null) {
    return startError;
  }
  const returnError = validatePoint(rules.returnScore, "返点");
  if (returnError !== null) {
    return returnError;
  }
  if (rules.returnScore < rules.startScore) {
    return "返点不能低于起始点";
  }
  const expectedLength = mode === "4p" ? 4 : 3;
  if (rules.uma.length !== expectedLength) {
    return `${mode === "4p" ? "四麻" : "三麻"}顺位马数量不正确`;
  }
  if (rules.uma.reduce((sum, item) => sum + item, 0) !== 0) {
    return "顺位马总和必须为 0";
  }
  return null;
}

function validatePoint(value: number, label: string): string | null {
  if (!Number.isSafeInteger(value) || value < 1000 || value > 99999 || value % 100 !== 0) {
    return `${label}必须是 1000-99999 的百点整数`;
  }
  return null;
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
