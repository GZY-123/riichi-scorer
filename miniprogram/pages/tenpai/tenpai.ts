import { calcWaits, normalizeTileForCount, sortTileCodes, type TenpaiWait } from "../../utils/tenpai";

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

Page({
  data: {
    mode: "4p" as GameMode,
    tiles: [] as TileView[],
    waits: [] as WaitView[],
    progressText: "已输入 0/13 张",
    resultTitle: "等待输入",
    resultHint: "满 13 张后自动计算听牌。",
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

  currentTileCodes(): string[] {
    return this.data.tiles.map((tile) => tile.code);
  },

  syncTiles(codes: string[], mode: GameMode) {
    const result = this.evaluate(codes, mode);
    this.setData({
      tiles: codes.map((code, index) => ({ key: `${index}_${code}`, code })),
      progressText: `已输入 ${codes.length}/13 张`,
      ...result
    });
  },

  evaluate(codes: string[], mode: GameMode): {
    waits: WaitView[];
    resultTitle: string;
    resultHint: string;
    resultTone: ResultTone;
  } {
    if (codes.length < 13) {
      return {
        waits: [],
        resultTitle: "等待输入",
        resultHint: "满 13 张后自动计算听牌。",
        resultTone: "guide"
      };
    }

    const result = calcWaits(codes, mode);
    if (result.error) {
      return {
        waits: [],
        resultTitle: "无法计算",
        resultHint: result.error,
        resultTone: "error"
      };
    }

    if (result.waits.length === 0) {
      return {
        waits: [],
        resultTitle: "未听牌",
        resultHint: "当前 13 张没有任何和牌进张。",
        resultTone: "empty"
      };
    }

    return {
      waits: result.waits.map((wait) => ({ ...wait, key: wait.tile })),
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

    const sameCount = this.currentTileCodes().filter((code) => {
      try {
        return normalizeTileForCount(code, this.data.mode) === normalized;
      } catch {
        return false;
      }
    }).length;
    if (sameCount >= 4) {
      wx.showToast({ title: `${normalized} 已满 4 枚`, icon: "none" });
      return false;
    }
    return true;
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
