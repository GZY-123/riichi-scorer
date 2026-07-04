# riichi-engine

Pure TypeScript riichi mahjong scoring engine for the WeChat mini program. The package is UI-agnostic, has zero runtime dependencies, and exports pure functions from `src/index.ts`.

## Install and Verify

```bash
npm install
npx tsc --noEmit
npx vitest run
```

## Tile Notation

- Suits: `1m..9m`, `1p..9p`, `1s..9s`
- Honors: `1z..7z` = east, south, west, north, white, green, red
- Red fives: `0m`, `0p`, `0s`

Red fives are normalized to ordinary fives for shape calculation and kept as original strings for aka-dora counting.

## Core APIs

```ts
import { parseHand, detectYaku, calcFu, calcScore } from "riichi-engine";

const divisions = parseHand(
  ["2m", "3m", "4m", "3p", "4p", "5p", "4s", "5s", "6s", "6m", "7m", "8m", "2z"],
  "2z"
);

const yaku = detectYaku(divisions, {
  winType: "tsumo",
  seatWind: "east",
  prevalentWind: "east",
  riichi: true
});

const fu = calcFu(divisions, { winType: "tsumo", seatWind: "east", prevalentWind: "east" });
const score = calcScore({ han: yaku.han, fu: fu.fu, winType: "tsumo", isDealer: false });
```

`parseHand` accepts either an array plus winning tile, or an object with `tiles`, `winningTile`, `melds`, and `mode`. It validates tile count, four-copy limits, sanma removed tiles, no-chi sanma, and returns all standard, seven-pairs, and thirteen-orphans divisions.

## Rule Coverage

Implemented yaku names are returned in Simplified Chinese. Coverage includes standard one-han through six-han yaku, yakuhai counted per value triplet, open-hand downgrades for 混全带幺九 / 一气通贯 / 三色同顺 / 混一色 / 纯全带幺九 / 清一色, 宝牌 / 里宝牌 / 赤宝牌 / 拔北宝牌 as non-yaku han, and yakuman including double-yakuman variants for 国士无双十三面, 四暗刻单骑, 大四喜, and 纯正九莲宝灯.

Fu calculation covers base fu, chiitoitsu fixed 25, pinfu tsumo fixed 20, menzen ron, value pair, wait fu, triplet/quad fu, ron-completed shanpon triplets, and rounding.

Score calculation covers ron/tsumo, dealer/non-dealer, honba, riichi-stick winner bonus, limit hands from mangan through yakuman, and sanma tsumo-loss on/off. Sanma defaults to no tsumo loss.

`createGame` and `applyEvent` implement riichi deposits, win and draw deltas, four-player and three-player noten penalties, dealer repeat/rotation, all-last handling, and bust termination. `settleGame` applies return points, uma, oka, leftover riichi sticks to first place, and dealer-order tie breaks.
