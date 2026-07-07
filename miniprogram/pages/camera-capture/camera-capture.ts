import { detectTilesOnDevice } from "../../utils/localDetector";
import {
  frameToAspectFillSourceRect,
  frameToPercentStyle
} from "../../utils/cameraCrop";
import type { NormalizedFrame, PixelRect, Size } from "../../utils/cameraCrop";

type ImageOrientation = WechatMiniprogram.GetImageInfoSuccessCallbackResult["orientation"];
type Canvas2DContext = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
type CanvasImageSource = WechatMiniprogram.CanvasRenderingContext.CanvasImageSource;

interface PhotoInfo extends Size {
  orientation: ImageOrientation;
}

interface CropSource {
  path: string;
  size: Size;
}

const LANDSCAPE_CAPTURE_FRAMES: { hand: NormalizedFrame; dora: NormalizedFrame } = {
  hand: { left: 0.11, top: 0.48, width: 0.78, height: 0.42 },
  dora: { left: 0.7, top: 0.1, width: 0.26, height: 0.22 }
};

// camera-capture.json uses pageOrientation: "landscape" so only this page rotates.
// If real-device testing shows camera and cover-view out of sync, switch fallback by
// removing pageOrientation, rotating .camera-page 90deg in WXSS, and swapping the
// preview width/height in getPreviewSize so the crop math still uses landscape axes.

interface RecognizeResult {
  tiles: string[];
  melds: [];
  confidence: number;
  rawText: string;
}

interface DualCaptureResult {
  photoPath: string;
  handImagePath: string;
  doraImagePath?: string;
  handResult?: RecognizeResult;
  handLocalError?: string;
  doraTiles?: string[];
  doraError?: string;
  doraSkipped?: boolean;
}

interface CameraErrorEvent {
  detail?: {
    errMsg?: string;
  };
}

interface CanvasNodeResult {
  node?: WechatMiniprogram.Canvas;
}

interface CanvasImage {
  src: string;
  onload: (() => void) | null;
  onerror: ((error: unknown) => void) | null;
}

Page({
  data: {
    handFrameStyle: frameToPercentStyle(LANDSCAPE_CAPTURE_FRAMES.hand),
    doraFrameStyle: frameToPercentStyle(LANDSCAPE_CAPTURE_FRAMES.dora),
    cameraReady: false,
    cameraDenied: false,
    capturing: false,
    recognizeState: "",
    captureError: ""
  },

  onCameraReady() {
    this.setData({
      cameraReady: true,
      cameraDenied: false,
      captureError: ""
    });
  },

  onCameraError(event: CameraErrorEvent) {
    const message = event.detail?.errMsg ?? "相机不可用";
    this.setData({
      cameraReady: false,
      cameraDenied: isPermissionError(message),
      captureError: this.shortCameraError(message)
    });
  },

  onOpenSetting() {
    this.setData({
      cameraDenied: false,
      captureError: "",
      recognizeState: ""
    });
  },

  onCloseTap() {
    wx.navigateBack();
  },

  async onShutterTap() {
    if (this.data.capturing) {
      return;
    }

    this.vibrateLight();
    this.setData({
      capturing: true,
      recognizeState: "拍摄中",
      captureError: ""
    });

    try {
      const photoPath = await this.takePhoto();
      this.setData({ recognizeState: "裁剪手牌与宝牌指示牌" });
      const crops = await this.cropPhoto(photoPath);
      const result = await this.recognizeCrops(photoPath, crops.handImagePath, crops.doraImagePath);
      this.emitResult(result);
      wx.navigateBack();
    } catch (error) {
      const message = this.errorMessage(error);
      this.setData({
        captureError: message || "拍摄失败",
        recognizeState: "可重新拍摄"
      });
      wx.showToast({ title: message || "拍摄失败", icon: "none" });
    } finally {
      this.setData({ capturing: false });
    }
  },

  takePhoto(): Promise<string> {
    return new Promise((resolve, reject) => {
      const camera = wx.createCameraContext();
      camera.takePhoto({
        quality: "high",
        success: (result) => {
          if (result.tempImagePath) {
            resolve(result.tempImagePath);
          } else {
            reject(new Error("相机未返回照片"));
          }
        },
        fail: (error) => reject(new Error(this.errorMessage(error) || "拍照失败"))
      });
    });
  },

  async cropPhoto(photoPath: string): Promise<{ handImagePath: string; doraImagePath: string }> {
    const [photoInfo, canvas] = await Promise.all([this.getPhotoInfo(photoPath), this.getCanvas()]);
    const previewSize = this.getPreviewSize();
    const source = await this.normalizePhotoForLandscape(canvas, photoPath, photoInfo, previewSize);

    // 横屏页面中框坐标以预览窗口为归一化坐标：手牌框 78% x 42%，宝牌框 26% x 22%。
    // camera 预览按 aspectFill 显示，等比放大照片直到覆盖横屏窗口，长边溢出的像素在
    // 预览两侧或上下不可见；frameToAspectFillSourceRect 先求出这块可见源图，再把框
    // 的 left/top/width/height 映射回源图，保证裁出的图和用户在横屏取景框中看到的一致。
    const handRect = frameToAspectFillSourceRect(LANDSCAPE_CAPTURE_FRAMES.hand, source.size, previewSize);
    const doraRect = frameToAspectFillSourceRect(LANDSCAPE_CAPTURE_FRAMES.dora, source.size, previewSize);

    const handImagePath = await this.cropRectToTempFile(canvas, source.path, handRect);
    const doraImagePath = await this.cropRectToTempFile(canvas, source.path, doraRect);
    return { handImagePath, doraImagePath };
  },

  async recognizeCrops(
    photoPath: string,
    handImagePath: string,
    doraImagePath: string
  ): Promise<DualCaptureResult> {
    const result: DualCaptureResult = {
      photoPath,
      handImagePath,
      doraImagePath,
      doraTiles: []
    };

    try {
      this.setData({ recognizeState: "手牌识别中" });
      result.handResult = await detectTilesOnDevice(handImagePath, (progress) => {
        this.setData({ recognizeState: progress.message });
      });
    } catch (error) {
      result.handLocalError = this.errorMessage(error);
      if (isLocalDetectorUnavailable(result.handLocalError)) {
        result.doraSkipped = true;
        result.doraError = "本地识别不可用，已跳过宝牌区";
        return result;
      }
    }

    try {
      this.setData({ recognizeState: "宝牌指示牌识别中" });
      const doraResult = await detectTilesOnDevice(doraImagePath);
      result.doraTiles = doraResult.tiles.slice(0, 5);
    } catch (error) {
      result.doraError = this.errorMessage(error);
    }

    return result;
  },

  cropRectToTempFile(
    canvas: WechatMiniprogram.Canvas,
    photoPath: string,
    rect: PixelRect
  ): Promise<string> {
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);

    return this.loadCanvasImage(canvas, photoPath)
      .then((image) => {
        context.drawImage(
          image as unknown as CanvasImageSource,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          width,
          height
        );
        return this.exportCanvasToTempFile(canvas, width, height, 0.92);
      });
  },

  exportCanvasToTempFile(
    canvas: WechatMiniprogram.Canvas,
    width: number,
    height: number,
    quality: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvas,
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: "jpg",
          quality,
          success: (output) => resolve(output.tempFilePath),
          fail: (error) => reject(new Error(`裁剪图片导出失败：${this.errorMessage(error)}`))
        },
        this
      );
    });
  },

  getCanvas(): Promise<WechatMiniprogram.Canvas> {
    return new Promise((resolve, reject) => {
      this.createSelectorQuery()
        .select("#cropCanvas")
        .fields({ node: true }, (result: CanvasNodeResult) => {
          if (result.node) {
            resolve(result.node);
          } else {
            reject(new Error("裁剪画布初始化失败"));
          }
        })
        .exec();
    });
  },

  getPhotoInfo(filePath: string): Promise<PhotoInfo> {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: (result) => resolve({
          width: result.width,
          height: result.height,
          orientation: result.orientation || "up"
        }),
        fail: (error) => reject(new Error(`读取照片尺寸失败：${this.errorMessage(error)}`))
      });
    });
  },

  async normalizePhotoForLandscape(
    canvas: WechatMiniprogram.Canvas,
    photoPath: string,
    photoInfo: PhotoInfo,
    previewSize: Size
  ): Promise<CropSource> {
    const orientation = selectOutputOrientation(photoInfo, previewSize);
    const outputSize = getOrientedSize(photoInfo, orientation);

    if (orientation === "up") {
      return { path: photoPath, size: photoInfo };
    }

    const outputWidth = outputSize.width;
    const outputHeight = outputSize.height;
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, outputWidth, outputHeight);

    const image = await this.loadCanvasImage(canvas, photoPath);
    drawImageWithOrientation(
      context,
      image as unknown as CanvasImageSource,
      photoInfo,
      orientation
    );

    const path = await this.exportCanvasToTempFile(canvas, outputWidth, outputHeight, 0.94);
    return { path, size: { width: outputWidth, height: outputHeight } };
  },

  getPreviewSize(): Size {
    const info =
      typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    return {
      width: info.windowWidth,
      height: info.windowHeight
    };
  },

  loadCanvasImage(canvas: WechatMiniprogram.Canvas, filePath: string): Promise<CanvasImage> {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage() as unknown as CanvasImage;
      image.onload = () => resolve(image);
      image.onerror = (error) => reject(new Error(`照片加载到裁剪画布失败：${this.errorMessage(error)}`));
      image.src = filePath;
    });
  },

  emitResult(result: DualCaptureResult) {
    const eventChannel = this.getOpenerEventChannel();
    if (typeof eventChannel.emit === "function") {
      eventChannel.emit("dualCaptureComplete", result);
    }
  },

  shortCameraError(message: string): string {
    if (isPermissionError(message)) {
      return "请允许相机权限";
    }
    return "相机不可用，真机上可重试";
  },

  vibrateLight() {
    try {
      wx.vibrateShort({ type: "light" });
    } catch (_error) {
      // 开发者工具或低版本基础库可能不支持触感反馈。
    }
  },

  errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "object" && error !== null && "errMsg" in error) {
      const errMsg = (error as { errMsg?: unknown }).errMsg;
      if (typeof errMsg === "string" && errMsg.trim()) {
        return errMsg;
      }
    }
    return String(error);
  }
});

function isPermissionError(message: string): boolean {
  return /auth|authorize|permission|deny|denied|scope\.camera|auth deny/i.test(message);
}

function isLocalDetectorUnavailable(message: string): boolean {
  return /不支持|未配置|下载失败|缓存失败|会话创建失败|加载失败|不可用|初始化失败|云存储模型/.test(message);
}

function selectOutputOrientation(photoInfo: PhotoInfo, previewSize: Size): ImageOrientation {
  const preferredSize = getOrientedSize(photoInfo, photoInfo.orientation);
  const previewIsLandscape = previewSize.width >= previewSize.height;
  const preferredMatchesPreview = (preferredSize.width >= preferredSize.height) === previewIsLandscape;

  if (preferredMatchesPreview) {
    return photoInfo.orientation;
  }
  if (!previewIsLandscape) {
    return photoInfo.orientation;
  }
  if (photoInfo.width >= photoInfo.height) {
    return isMirroredOrientation(photoInfo.orientation) ? "up-mirrored" : "up";
  }
  return isMirroredOrientation(photoInfo.orientation) ? "right-mirrored" : "right";
}

function getOrientedSize(photoInfo: PhotoInfo, orientation: ImageOrientation): Size {
  if (swapsAxes(orientation)) {
    return { width: photoInfo.height, height: photoInfo.width };
  }
  return { width: photoInfo.width, height: photoInfo.height };
}

function swapsAxes(orientation: ImageOrientation): boolean {
  return orientation === "left" ||
    orientation === "left-mirrored" ||
    orientation === "right" ||
    orientation === "right-mirrored";
}

function isMirroredOrientation(orientation: ImageOrientation): boolean {
  return orientation.endsWith("-mirrored");
}

function drawImageWithOrientation(
  context: Canvas2DContext,
  image: CanvasImageSource,
  photoInfo: PhotoInfo,
  orientation: ImageOrientation
) {
  const sourceWidth = photoInfo.width;
  const sourceHeight = photoInfo.height;

  context.save();
  switch (orientation) {
    case "up-mirrored":
      context.setTransform(-1, 0, 0, 1, sourceWidth, 0);
      break;
    case "down":
      context.setTransform(-1, 0, 0, -1, sourceWidth, sourceHeight);
      break;
    case "down-mirrored":
      context.setTransform(1, 0, 0, -1, 0, sourceHeight);
      break;
    case "left-mirrored":
      context.setTransform(0, 1, 1, 0, 0, 0);
      break;
    case "right":
      context.setTransform(0, 1, -1, 0, sourceHeight, 0);
      break;
    case "right-mirrored":
      context.setTransform(0, -1, -1, 0, sourceHeight, sourceWidth);
      break;
    case "left":
      context.setTransform(0, -1, 1, 0, 0, sourceWidth);
      break;
    case "up":
    default:
      context.setTransform(1, 0, 0, 1, 0, 0);
      break;
  }
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  context.restore();
}
