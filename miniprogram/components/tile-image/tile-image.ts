type TileSize = "small" | "medium" | "large";

const TILE_CODES = new Set([
  "front",
  "back",
  "0m",
  "0p",
  "0s",
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}m`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}p`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}s`),
  ...Array.from({ length: 7 }, (_, index) => `${index + 1}z`)
]);

Component({
  options: {
    styleIsolation: "apply-shared"
  },
  properties: {
    code: {
      type: String,
      value: "front"
    },
    size: {
      type: String,
      value: "medium"
    }
  },
  data: {
    src: "/images/tiles/front.png",
    sizeClass: "medium"
  },
  observers: {
    "code, size": function (this: WechatMiniprogram.Component.TrivialInstance, code: string, size: string) {
      const tileCode = toTileCode(code);
      const tileSize = toTileSize(size);
      this.setData({
        src: `/images/tiles/${tileCode}.png`,
        sizeClass: tileSize
      });
    }
  },
  lifetimes: {
    attached(this: WechatMiniprogram.Component.TrivialInstance) {
      const data = this.data as { code?: string; size?: string };
      const tileCode = toTileCode(data.code);
      const tileSize = toTileSize(data.size);
      this.setData({
        src: `/images/tiles/${tileCode}.png`,
        sizeClass: tileSize
      });
    }
  }
});

function toTileCode(code: string | undefined): string {
  const normalized = (code ?? "").trim();
  return TILE_CODES.has(normalized) ? normalized : "front";
}

function toTileSize(size: string | undefined): TileSize {
  return size === "small" || size === "large" ? size : "medium";
}

export {};
