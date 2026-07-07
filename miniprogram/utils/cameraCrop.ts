export interface NormalizedFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DUAL_CAPTURE_FRAMES: { hand: NormalizedFrame; dora: NormalizedFrame } = {
  hand: { left: 0.04, top: 0.52, width: 0.92, height: 0.3 },
  dora: { left: 0.52, top: 0.37, width: 0.44, height: 0.12 }
};

export function frameToPercentStyle(frame: NormalizedFrame): string {
  return [
    `left: ${toPercent(frame.left)}%;`,
    `top: ${toPercent(frame.top)}%;`,
    `width: ${toPercent(frame.width)}%;`,
    `height: ${toPercent(frame.height)}%;`
  ].join(" ");
}

export function frameToAspectFillSourceRect(
  frame: NormalizedFrame,
  photoSize: Size,
  previewSize: Size
): PixelRect {
  assertPositiveSize(photoSize, "照片");
  assertPositiveSize(previewSize, "预览");

  // camera 组件默认按 aspectFill 展示：照片先等比放大到覆盖整个预览，
  // 即 scale = max(preview/photo)，对齐可见区域的短边；多出的长边在两侧或上下被裁掉。
  // 反向求源图时，先用 preview/scale 得到照片中实际可见的矩形，再把屏幕上的框比例映射回该矩形。
  const scale = Math.max(previewSize.width / photoSize.width, previewSize.height / photoSize.height);
  const visiblePhotoWidth = previewSize.width / scale;
  const visiblePhotoHeight = previewSize.height / scale;
  const visiblePhotoX = (photoSize.width - visiblePhotoWidth) / 2;
  const visiblePhotoY = (photoSize.height - visiblePhotoHeight) / 2;

  return clampRect(
    {
      x: visiblePhotoX + frame.left * visiblePhotoWidth,
      y: visiblePhotoY + frame.top * visiblePhotoHeight,
      width: frame.width * visiblePhotoWidth,
      height: frame.height * visiblePhotoHeight
    },
    photoSize
  );
}

function assertPositiveSize(size: Size, label: string) {
  if (size.width <= 0 || size.height <= 0) {
    throw new Error(`${label}尺寸无效`);
  }
}

function clampRect(rect: PixelRect, bounds: Size): PixelRect {
  const x = clamp(rect.x, 0, bounds.width - 1);
  const y = clamp(rect.y, 0, bounds.height - 1);
  return {
    x,
    y,
    width: clamp(rect.width, 1, bounds.width - x),
    height: clamp(rect.height, 1, bounds.height - y)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number): string {
  return (value * 100).toFixed(3).replace(/\.?0+$/, "");
}
