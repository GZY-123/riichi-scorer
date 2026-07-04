import { TILE_MODEL_FILE_ID } from "../env";
import { detectionToTiles } from "./detectionToTiles";
import { decodeYoloOutput } from "./yoloDecode";
import type { LetterboxInfo } from "./yoloDecode";

interface LocalRecognizeResult {
  tiles: string[];
  melds: [];
  confidence: number;
  rawText: string;
}

export interface LocalDetectorProgress {
  phase: "download" | "load" | "preprocess" | "infer" | "postprocess";
  progress?: number;
  message: string;
}

interface PreprocessedImage {
  input: Float32Array;
  letterbox: LetterboxInfo;
}

interface OffscreenImage {
  src: string;
  onload: (() => void) | null;
  onerror: ((error: unknown) => void) | null;
}

type ProgressCallback = (progress: LocalDetectorProgress) => void;

const MODEL_CACHE_PATH = `${wx.env.USER_DATA_PATH}/tile-model.onnx`;
const INPUT_SIZE = 640;
const INPUT_TENSOR_NAME = "images";
const OUTPUT_TENSOR_NAME = "output0";
const MODEL_PLACEHOLDER_MARKERS = ["your-env-id", "path/to", "TODO"];

let sessionPromise: Promise<WechatMiniprogram.InferenceSession> | undefined;

export async function detectTilesOnDevice(
  imagePath: string,
  onProgress?: ProgressCallback
): Promise<LocalRecognizeResult> {
  onProgress?.({ phase: "preprocess", message: "本地识别中：预处理图片" });
  const preprocessed = await preprocessImage(imagePath);
  const session = await getInferenceSession(onProgress);

  onProgress?.({ phase: "infer", message: "本地识别中：模型推理" });
  const outputs = await session.run({
    [INPUT_TENSOR_NAME]: {
      type: "float32",
      data: float32ArrayToArrayBuffer(preprocessed.input),
      shape: [1, 3, INPUT_SIZE, INPUT_SIZE]
    }
  });
  const outputTensor = getOutputTensor(outputs);

  onProgress?.({ phase: "postprocess", message: "本地识别中：整理牌序" });
  const detections = decodeYoloOutput({
    output: tensorToFloat32Array(outputTensor),
    outputShape: outputTensor.shape,
    letterbox: preprocessed.letterbox
  });
  const result = detectionToTiles(detections);
  if (result.tiles.length === 0) {
    throw new Error("本地模型未检测到牌面");
  }

  return {
    tiles: result.tiles,
    melds: [],
    confidence: result.confidence,
    rawText: JSON.stringify({
      engine: "local-yolo-onnx",
      detectionCount: detections.length,
      tileCount: result.tiles.length
    })
  };
}

async function getInferenceSession(
  onProgress?: ProgressCallback
): Promise<WechatMiniprogram.InferenceSession> {
  if (sessionPromise !== undefined) {
    return sessionPromise;
  }

  sessionPromise = loadInferenceSession(onProgress).catch((error: unknown) => {
    sessionPromise = undefined;
    throw error;
  });
  return sessionPromise;
}

async function loadInferenceSession(
  onProgress?: ProgressCallback
): Promise<WechatMiniprogram.InferenceSession> {
  if (typeof wx.createInferenceSession !== "function") {
    throw new Error("当前微信基础库不支持 wx.createInferenceSession");
  }

  const modelPath = await ensureModelFile(onProgress);
  onProgress?.({ phase: "load", message: "本地识别中：加载模型" });

  let session: WechatMiniprogram.InferenceSession;
  try {
    session = wx.createInferenceSession({
      model: modelPath,
      precisionLevel: 4,
      allowNPU: false,
      allowQuantize: false,
      typicalShape: {
        [INPUT_TENSOR_NAME]: [1, 3, INPUT_SIZE, INPUT_SIZE]
      }
    });
  } catch (error) {
    throw new Error(`本地模型会话创建失败：${errorMessage(error)}`);
  }

  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      session.offLoad(handleLoad);
      session.offError(handleError);
      resolve(session);
    };
    const handleError = (error: unknown) => {
      session.offLoad(handleLoad);
      session.offError(handleError);
      reject(new Error(`本地模型加载失败：${errorMessage(error)}`));
    };
    session.onLoad(handleLoad);
    session.onError(handleError);
  });
}

async function ensureModelFile(onProgress?: ProgressCallback): Promise<string> {
  if (fileExists(MODEL_CACHE_PATH)) {
    return MODEL_CACHE_PATH;
  }

  const fileID = getConfiguredModelFileID();
  onProgress?.({ phase: "download", progress: 0, message: "本地识别中：下载模型 0%" });
  const tempFilePath = await downloadCloudFile(fileID, onProgress);
  const fs = wx.getFileSystemManager();
  try {
    // saveFile 一族有 10MB 配额，12MB 模型必须走 copyFile 写入用户数据目录（200MB 配额）
    fs.copyFileSync(tempFilePath, MODEL_CACHE_PATH);
  } catch (error) {
    throw new Error(`本地模型缓存失败：${errorMessage(error)}`);
  }
  return MODEL_CACHE_PATH;
}

function downloadCloudFile(fileID: string, onProgress?: ProgressCallback): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = wx.cloud.downloadFile({
      fileID,
      success: (result) => {
        if (!result.tempFilePath) {
          reject(new Error("云存储模型下载未返回临时文件"));
          return;
        }
        resolve(result.tempFilePath);
      },
      fail: (error) => {
        reject(new Error(`云存储模型下载失败：${errorMessage(error)}`));
      }
    });
    task.onProgressUpdate((result) => {
      onProgress?.({
        phase: "download",
        progress: result.progress,
        message: `本地识别中：下载模型 ${result.progress}%`
      });
    });
  });
}

async function preprocessImage(filePath: string): Promise<PreprocessedImage> {
  if (typeof wx.createOffscreenCanvas !== "function") {
    throw new Error("当前微信基础库不支持 2D 离屏画布");
  }

  const imageInfo = await getImageInfo(filePath);
  const canvas = wx.createOffscreenCanvas({
    type: "2d",
    width: INPUT_SIZE,
    height: INPUT_SIZE
  });
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (context === null) {
    throw new Error("2D 离屏画布初始化失败");
  }

  const scale = Math.min(INPUT_SIZE / imageInfo.width, INPUT_SIZE / imageInfo.height);
  const drawWidth = imageInfo.width * scale;
  const drawHeight = imageInfo.height * scale;
  const padX = (INPUT_SIZE - drawWidth) / 2;
  const padY = (INPUT_SIZE - drawHeight) / 2;
  const image = await loadCanvasImage(canvas, filePath);

  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  context.drawImage(image as CanvasImageSource, padX, padY, drawWidth, drawHeight);

  const imageData = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  return {
    input: imageDataToNchwFloat32(imageData.data, INPUT_SIZE, INPUT_SIZE),
    letterbox: {
      inputWidth: INPUT_SIZE,
      inputHeight: INPUT_SIZE,
      originalWidth: imageInfo.width,
      originalHeight: imageInfo.height,
      scale,
      padX,
      padY
    }
  };
}

function getImageInfo(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: (result) => resolve({ width: result.width, height: result.height }),
      fail: (error) => reject(new Error(`读取图片信息失败：${errorMessage(error)}`))
    });
  });
}

function loadCanvasImage(
  canvas: WechatMiniprogram.OffscreenCanvas,
  filePath: string
): Promise<OffscreenImage> {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage() as unknown as OffscreenImage;
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(new Error(`图片加载到离屏画布失败：${errorMessage(error)}`));
    image.src = filePath;
  });
}

function imageDataToNchwFloat32(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const planeSize = width * height;
  const input = new Float32Array(planeSize * 3);

  for (let pixelIndex = 0; pixelIndex < planeSize; pixelIndex += 1) {
    const rgbaIndex = pixelIndex * 4;
    input[pixelIndex] = pixels[rgbaIndex] / 255;
    input[planeSize + pixelIndex] = pixels[rgbaIndex + 1] / 255;
    input[planeSize * 2 + pixelIndex] = pixels[rgbaIndex + 2] / 255;
  }

  return input;
}

function getOutputTensor(outputs: WechatMiniprogram.Tensors): WechatMiniprogram.Tensor {
  const tensor = outputs[OUTPUT_TENSOR_NAME] ?? outputs[Object.keys(outputs)[0]];
  if (tensor === undefined) {
    throw new Error("本地模型没有输出张量");
  }
  return tensor;
}

function tensorToFloat32Array(tensor: WechatMiniprogram.Tensor): Float32Array {
  if (tensor.type !== "float32") {
    throw new Error(`本地模型输出类型应为 float32，实际为 ${tensor.type}`);
  }
  return new Float32Array(tensor.data);
}

function float32ArrayToArrayBuffer(values: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(values.byteLength);
  new Float32Array(buffer).set(values);
  return buffer;
}

function getConfiguredModelFileID(): string {
  const fileID = TILE_MODEL_FILE_ID.trim();
  if (!fileID || MODEL_PLACEHOLDER_MARKERS.some((marker) => fileID.includes(marker))) {
    throw new Error("端侧麻将牌模型未配置，请先填写 TILE_MODEL_FILE_ID");
  }
  return fileID;
}

function fileExists(path: string): boolean {
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
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
