import cloud = require("wx-server-sdk");
import type { GameMode } from "../common/roomLogic";
import { parseVisionRecognition } from "../common/recognition";
import { createVisionProvider } from "./providers";

declare const Buffer: {
  isBuffer(value: unknown): boolean;
  from(value: unknown): BinaryBuffer;
};

interface BinaryBuffer {
  toString(encoding: "base64"): string;
}

interface RecognizeTilesRequest {
  fileID?: string;
  mode?: GameMode;
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event: RecognizeTilesRequest) => {
  const fileID = event.fileID ?? "";
  if (!fileID.trim()) {
    throw new Error("缺少图片 fileID");
  }
  const mode = event.mode === "3p" ? "3p" : "4p";
  const provider = createVisionProvider();
  const image = await downloadImage(fileID);
  const rawText = await provider.recognize({
    imageBase64: image.content.toString("base64"),
    mimeType: image.mimeType,
    mode
  });
  const parsed = parseVisionRecognition(rawText, mode);
  if (!parsed.ok) {
    return {
      tiles: [],
      melds: [],
      confidence: 0,
      rawText: parsed.rawText,
      errorCode: parsed.errorCode,
      message: parsed.message
    };
  }
  return parsed.value;
};

async function downloadImage(fileID: string): Promise<{ content: BinaryBuffer; mimeType: string }> {
  const result = (await (cloud as unknown as {
    downloadFile(input: { fileID: string }): Promise<{ fileContent: unknown }>;
  }).downloadFile({ fileID })) as { fileContent: unknown };
  const content = Buffer.isBuffer(result.fileContent) ? (result.fileContent as BinaryBuffer) : Buffer.from(result.fileContent);
  return {
    content,
    mimeType: detectMimeType(fileID)
  };
}

function detectMimeType(fileID: string): string {
  const lower = fileID.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
