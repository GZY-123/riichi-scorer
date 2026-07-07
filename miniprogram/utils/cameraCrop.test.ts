import { describe, expect, it } from "vitest";
import { DUAL_CAPTURE_FRAMES, frameToAspectFillSourceRect, frameToPercentStyle } from "./cameraCrop";

describe("camera capture crop mapping", () => {
  it("maps portrait preview frames into a landscape photo aspectFill crop", () => {
    const rect = frameToAspectFillSourceRect(DUAL_CAPTURE_FRAMES.hand, {
      width: 4000,
      height: 3000
    }, {
      width: 375,
      height: 812
    });

    expect(rect.x).toBeCloseTo(1362.7, 1);
    expect(rect.y).toBeCloseTo(1560, 1);
    expect(rect.width).toBeCloseTo(1274.6, 1);
    expect(rect.height).toBeCloseTo(900, 1);
  });

  it("maps the dora frame above and to the right of the hand frame", () => {
    const dora = frameToAspectFillSourceRect(DUAL_CAPTURE_FRAMES.dora, {
      width: 3024,
      height: 4032
    }, {
      width: 390,
      height: 844
    });
    const hand = frameToAspectFillSourceRect(DUAL_CAPTURE_FRAMES.hand, {
      width: 3024,
      height: 4032
    }, {
      width: 390,
      height: 844
    });

    expect(dora.x).toBeGreaterThan(hand.x);
    expect(dora.y + dora.height).toBeLessThan(hand.y);
    expect(dora.width / hand.width).toBeCloseTo(0.44 / 0.92, 3);
  });

  it("generates percentage styles from the shared frame constants", () => {
    expect(frameToPercentStyle(DUAL_CAPTURE_FRAMES.dora)).toBe("left: 52%; top: 37%; width: 44%; height: 12%;");
  });
});
