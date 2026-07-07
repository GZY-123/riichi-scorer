import { detectTilesOnDevice } from "../../utils/localDetector";
import {
  DUAL_CAPTURE_FRAMES,
  frameToAspectFillSourceRect,
  frameToPercentStyle
} from "../../utils/cameraCrop";
import type { PixelRect, Size } from "../../utils/cameraCrop";

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
    handFrameStyle: frameToPercentStyle(DUAL_CAPTURE_FRAMES.hand),
    doraFrameStyle: frameToPercentStyle(DUAL_CAPTURE_FRAMES.dora),
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
    const [photoSize, canvas] = await Promise.all([this.getImageSize(photoPath), this.getCanvas()]);
    const previewSize = this.getPreviewSize();
    const handRect = frameToAspectFillSourceRect(DUAL_CAPTURE_FRAMES.hand, photoSize, previewSize);
    const doraRect = frameToAspectFillSourceRect(DUAL_CAPTURE_FRAMES.dora, photoSize, previewSize);

    const handImagePath = await this.cropRectToTempFile(canvas, photoPath, handRect);
    const doraImagePath = await this.cropRectToTempFile(canvas, photoPath, doraRect);
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
          image as unknown as WechatMiniprogram.CanvasRenderingContext.CanvasImageSource,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          width,
          height
        );
        return new Promise<string>((resolve, reject) => {
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
              quality: 0.92,
              success: (output) => resolve(output.tempFilePath),
              fail: (error) => reject(new Error(`裁剪图片导出失败：${this.errorMessage(error)}`))
            },
            this
          );
        });
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

  getImageSize(filePath: string): Promise<Size> {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: (result) => resolve({ width: result.width, height: result.height }),
        fail: (error) => reject(new Error(`读取照片尺寸失败：${this.errorMessage(error)}`))
      });
    });
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
