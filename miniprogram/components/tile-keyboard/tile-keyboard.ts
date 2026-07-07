interface KeyboardTapEvent {
  currentTarget: {
    dataset: Record<string, string | undefined>;
  };
}

interface KeyboardTile {
  code: string;
  disabled: boolean;
}

interface KeyboardRow {
  id: string;
  tiles: KeyboardTile[];
}

const baseRows = [
  { id: "man", tiles: buildSuit("m", 9) },
  { id: "pin", tiles: buildSuit("p", 9) },
  { id: "sou", tiles: buildSuit("s", 9) },
  { id: "honor", tiles: buildSuit("z", 7) }
];

const baseRedTiles = [{ code: "0m" }, { code: "0p" }, { code: "0s" }];

Component({
  options: {
    styleIsolation: "apply-shared"
  },
  properties: {
    disabledCodes: {
      type: Array,
      value: []
    }
  },
  data: {
    rows: decorateRows([]),
    redTiles: decorateTiles(baseRedTiles, [])
  },
  observers: {
    disabledCodes(this: WechatMiniprogram.Component.TrivialInstance, disabledCodes: string[]) {
      const disabledSet = toDisabledSet(disabledCodes);
      this.setData({
        rows: decorateRows(disabledSet),
        redTiles: decorateTiles(baseRedTiles, disabledSet)
      });
    }
  },
  lifetimes: {
    attached(this: WechatMiniprogram.Component.TrivialInstance) {
      const data = this.data as { disabledCodes?: string[] };
      const disabledSet = toDisabledSet(data.disabledCodes);
      this.setData({
        rows: decorateRows(disabledSet),
        redTiles: decorateTiles(baseRedTiles, disabledSet)
      });
    }
  },
  methods: {
    onTileTap(event: KeyboardTapEvent) {
      const tile = event.currentTarget.dataset.code;
      if (!tile) {
        return;
      }
      const data = this.data as { disabledCodes?: string[] };
      if (toDisabledSet(data.disabledCodes).has(tile)) {
        return;
      }
      this.triggerEvent("tap", { tile, value: tile });
    },

    onDeleteTap() {
      this.triggerEvent("delete");
    }
  }
});

function buildSuit(suit: string, count: number): Array<{ code: string }> {
  return Array.from({ length: count }, (_, index) => ({ code: `${index + 1}${suit}` }));
}

function decorateRows(disabledCodes: Iterable<string>): KeyboardRow[] {
  const disabledSet = toDisabledSet(disabledCodes);
  return baseRows.map((row) => ({
    ...row,
    tiles: decorateTiles(row.tiles, disabledSet)
  }));
}

function decorateTiles(tiles: Array<{ code: string }>, disabledCodes: Iterable<string>): KeyboardTile[] {
  const disabledSet = toDisabledSet(disabledCodes);
  return tiles.map((tile) => ({
    ...tile,
    disabled: disabledSet.has(tile.code)
  }));
}

function toDisabledSet(disabledCodes: Iterable<string> | undefined): Set<string> {
  return new Set(Array.from(disabledCodes ?? []).filter((code): code is string => typeof code === "string"));
}

export {};
