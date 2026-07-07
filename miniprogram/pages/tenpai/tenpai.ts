import {
  analyzeDraws,
  calcWaits,
  normalizeTileForCount,
  sortTileCodes,
  type TenpaiDrawAnalysis,
  type TenpaiWait
} from "../../utils/tenpai";

type GameMode = "3p" | "4p";
type ResultTone = "guide" | "ready" | "empty" | "error";

interface TileKeyboardEvent {
  detail: {
    tile?: string;
    value?: string;
  };
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string | number | undefined>;
  };
}

interface TileView {
  key: string;
  code: string;
}

interface WaitView extends TenpaiWait {
  key: string;
}

interface DrawAnalysisView extends Omit<TenpaiDrawAnalysis, "waits"> {
  key: string;
  waits: WaitView[];
}

interface EvaluateResult {
  waits: WaitView[];
  drawAnalyses: DrawAnalysisView[];
  resultTitle: string;
  resultHint: string;
  resultTone: ResultTone;
}

const KEYBOARD_CODES = [
  ...buildKeyboardSuit("m", 9),
  ...buildKeyboardSuit("p", 9),
  ...buildKeyboardSuit("s", 9),
  ...buildKeyboardSuit("z", 7),
  "0m",
  "0p",
  "0s"
];

Page({
  data: {
    mode: "4p" as GameMode,
    tiles: [] as TileView[],
    waits: [] as WaitView[],
    drawAnalyses: [] as DrawAnalysisView[],
    disabledCodes: [] as string[],
    progressText: "已输入 0/13 张",
    resultTitle: "等待输入",
    resultHint: "输入 12 张可看下一摸，满 13 张后自动计算听牌。",
    resultTone: "guide" as ResultTone
  },

  onModeTap(event: TapEvent) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== "3p" && mode !== "4p") {
      return;
    }
    this.setData({ mode });
    this.syncTiles(this.currentTileCodes(), mode);
  },

  onKeyboardTap(event: TileKeyboardEvent) {
    const tile = (event.detail.tile ?? event.detail.value ?? "").trim();
    if (!tile) {
      return;
    }
    if (this.data.tiles.length >= 13) {
      wx.showToast({ title: "最多输入 13 张", icon: "none" });
      return;
    }
    if (!this.canAddTile(tile)) {
      return;
    }
    this.vibrateLight();
    this.syncTiles([...this.currentTileCodes(), tile], this.data.mode);
  },

  onKeyboardDelete() {
    if (this.data.tiles.length === 0) {
      return;
    }
    this.vibrateLight();
    this.syncTiles(this.currentTileCodes().slice(0, -1), this.data.mode);
  },

  onTileTap(event: TapEvent) {
    const index = this.toIndex(event.currentTarget.dataset.index);
    if (index < 0) {
      return;
    }
    const next = this.currentTileCodes();
    if (index >= next.length) {
      return;
    }
    next.splice(index, 1);
    this.syncTiles(next, this.data.mode);
  },

  onSortTap() {
    this.syncTiles(sortTileCodes(this.currentTileCodes()), this.data.mode);
  },

  onClearTap() {
    this.syncTiles([], this.data.mode);
  },

  currentTileCodes(): string[] {
    return this.data.tiles.map((tile) => tile.code);
  },

  syncTiles(codes: string[], mode: GameMode) {
    const result = this.evaluate(codes, mode);
    this.setData({
      tiles: codes.map((code, index) => ({ key: `${index}_${code}`, code })),
      progressText: `已输入 ${codes.length}/13 张`,
      disabledCodes: this.disabledCodesFor(codes, mode),
      ...result
    });
  },

  evaluate(codes: string[], mode: GameMode): EvaluateResult {
    if (codes.length < 12) {
      return {
        waits: [],
        drawAnalyses: [],
        resultTitle: "等待输入",
        resultHint: "输入 12 张可看下一摸，满 13 张后自动计算听牌。",
        resultTone: "guide"
      };
    }

    if (codes.length === 12) {
      const analyses = analyzeDraws(codes, mode);
      if (analyses.length === 0) {
        return {
          waits: [],
          drawAnalyses: [],
          resultTitle: "未发现可听摸牌",
          resultHint: "当前 12 张暂未找到再摸一张即可听牌的进张。",
          resultTone: "empty"
        };
      }

      return {
        waits: [],
        drawAnalyses: analyses.map((analysis) => ({
          ...analysis,
          key: analysis.draw,
          waits: analysis.waits.map((wait) => ({ ...wait, key: `${analysis.draw}_${wait.tile}` }))
        })),
        resultTitle: "再摸一张可听",
        resultHint: "",
        resultTone: "ready"
      };
    }

    const result = calcWaits(codes, mode);
    if (result.error) {
      return {
        waits: [],
        drawAnalyses: [],
        resultTitle: "无法计算",
        resultHint: result.error,
        resultTone: "error"
      };
    }

    if (result.waits.length === 0) {
      return {
        waits: [],
        drawAnalyses: [],
        resultTitle: "未听牌",
        resultHint: "当前 13 张没有任何和牌进张。",
        resultTone: "empty"
      };
    }

    return {
      waits: result.waits.map((wait) => ({ ...wait, key: wait.tile })),
      drawAnalyses: [],
      resultTitle: `听 ${result.waits.length} 张`,
      resultHint: "",
      resultTone: "ready"
    };
  },

  canAddTile(tile: string): boolean {
    let normalized: string;
    try {
      normalized = normalizeTileForCount(tile, this.data.mode);
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "牌面无效", icon: "none" });
      return false;
    }

    const currentCodes = this.currentTileCodes();
    const sameCount = currentCodes.filter((code) => {
      try {
        return normalizeTileForCount(code, this.data.mode) === normalized;
      } catch {
        return false;
      }
    }).length;
    if (this.isRedFive(tile) && currentCodes.filter((code) => code === tile).length >= 1) {
      wx.showToast({ title: `${tile} 已满 1 枚`, icon: "none" });
      return false;
    }
    if (sameCount >= 4) {
      wx.showToast({ title: `${normalized} 已满 4 枚`, icon: "none" });
      return false;
    }
    return true;
  },

  disabledCodesFor(codes: string[], mode: GameMode): string[] {
    return KEYBOARD_CODES.filter((code) => !this.canAppendCode(code, codes, mode));
  },

  canAppendCode(code: string, codes: string[], mode: GameMode): boolean {
    let normalized: string;
    try {
      normalized = normalizeTileForCount(code, mode);
    } catch {
      return false;
    }

    const normalizedCount = codes.filter((current) => {
      try {
        return normalizeTileForCount(current, mode) === normalized;
      } catch {
        return false;
      }
    }).length;
    if (normalizedCount >= 4) {
      return false;
    }
    if (this.isRedFive(code) && codes.filter((current) => current === code).length >= 1) {
      return false;
    }
    return true;
  },

  isRedFive(code: string): boolean {
    return code === "0m" || code === "0p" || code === "0s";
  },

  toIndex(value: string | number | undefined): number {
    const index = Number(value);
    return Number.isInteger(index) ? index : -1;
  },

  vibrateLight() {
    if (typeof wx.vibrateShort === "function") {
      wx.vibrateShort({ type: "light" });
    }
  }
});

function buildKeyboardSuit(suit: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${index + 1}${suit}`);
}
