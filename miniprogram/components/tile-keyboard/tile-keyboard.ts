interface KeyboardTapEvent {
  currentTarget: {
    dataset: Record<string, string | undefined>;
  };
}

const rows = [
  { id: "man", tiles: buildSuit("m", 9) },
  { id: "pin", tiles: buildSuit("p", 9) },
  { id: "sou", tiles: buildSuit("s", 9) },
  { id: "honor", tiles: buildSuit("z", 7) }
];

const redTiles = [{ code: "0m" }, { code: "0p" }, { code: "0s" }];

Component({
  options: {
    styleIsolation: "apply-shared"
  },
  data: {
    rows,
    redTiles
  },
  methods: {
    onTileTap(event: KeyboardTapEvent) {
      const tile = event.currentTarget.dataset.code;
      if (!tile) {
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

export {};
