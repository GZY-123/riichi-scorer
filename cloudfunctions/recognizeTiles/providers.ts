import type { GameMode } from "../common/roomLogic";
import { detectionToTiles } from "../common/detectionToTiles";
import type { TileDetection } from "../common/detectionToTiles";

declare const process: {
  env: Record<string, string | undefined>;
};
declare const require: (id: string) => unknown;
declare const Buffer: {
  byteLength(input: string, encoding?: string): number;
};

export interface VisionProviderInput {
  imageBase64: string;
  mimeType: string;
  mode: GameMode;
}

export interface VisionProvider {
  recognize(input: VisionProviderInput): Promise<string>;
}

export function createVisionProvider(): VisionProvider {
  const provider = (process.env.VISION_PROVIDER ?? "dashscope").toLowerCase();
  if (provider === "mock") {
    return new MockVisionProvider(process.env.MOCK_VISION_RESPONSE);
  }
  if (provider === "roboflow") {
    const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
    const model = process.env.ROBOFLOW_MODEL?.trim();
    if (!apiKey) {
      throw new Error("缺少 ROBOFLOW_API_KEY 云函数环境变量，请在 Roboflow 获取 Private API Key 后配置");
    }
    if (!model) {
      throw new Error("缺少 ROBOFLOW_MODEL 云函数环境变量，请填写 Roboflow Hosted API 的 model/version");
    }
    return new RoboflowProvider({
      apiKey,
      model,
      confidence: process.env.ROBOFLOW_CONFIDENCE?.trim() || "0.4"
    });
  }
  if (provider === "dashscope" || provider === "qwen-vl-max") {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 DASHSCOPE_API_KEY 云函数环境变量");
    }
    return new DashScopeVisionProvider({
      apiKey,
      model: process.env.DASHSCOPE_MODEL ?? "qwen-vl-max",
      endpoint:
        process.env.DASHSCOPE_ENDPOINT ??
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    });
  }
  throw new Error(`未知 VISION_PROVIDER: ${provider}`);
}

export class MockVisionProvider implements VisionProvider {
  constructor(private readonly responseText?: string) {}

  async recognize(): Promise<string> {
    return (
      this.responseText ??
      JSON.stringify({
        tiles: ["1m", "2m", "3m", "4p", "5p", "6p", "2s", "3s", "4s", "7s", "8s", "9s", "5z", "5z"],
        melds: [],
        confidence: 0.99
      })
    );
  }
}

export class DashScopeVisionProvider implements VisionProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      endpoint: string;
    }
  ) {}

  async recognize(input: VisionProviderInput): Promise<string> {
    const response = await postJson(this.options.endpoint, this.options.apiKey, {
      model: this.options.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildRecognitionPrompt(input.mode) },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.mimeType};base64,${input.imageBase64}`
              }
            }
          ]
        }
      ]
    });

    const content = extractMessageContent(response);
    if (!content.trim()) {
      throw new Error("视觉模型没有返回可解析内容");
    }
    return content;
  }
}

export class RoboflowProvider implements VisionProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      confidence: string;
    }
  ) {}

  async recognize(input: VisionProviderInput): Promise<string> {
    const response = await postFormJson(buildRoboflowEndpoint(this.options), input.imageBase64);
    const detections = normalizeRoboflowPredictions(response);
    const result = detectionToTiles(detections);
    return JSON.stringify({
      tiles: result.tiles,
      melds: [],
      confidence: result.confidence,
      notes: "检测模型不区分副露，请在界面手动标注副露"
    });
  }
}

export function buildRecognitionPrompt(mode: GameMode): string {
  const sanmaRule =
    mode === "3p"
      ? "当前是三人麻将：万子只有 1m 和 9m，绝不可能出现 2m 到 8m。"
      : "当前是四人麻将。";
  return [
    "你是日本立直麻将牌面识别专家。任务：识别照片中的手牌与副露。",
    sanmaRule,
    "",
    "第一步（转正）：照片可能是竖拍、斜拍或旋转的。先判断牌的朝向，在脑中把画面转正到牌面图案正立，再开始识别。",
    "第二步（逐张识别）：把牌从左到右（多排则先上排后下排）逐张判断，依据如下：",
    "- 万子(m)：白底 + 汉字数字 + 底部「萬」字，如 五萬=5m。",
    "- 筒子(p)：圆饼图案，圆饼的个数就是数字，务必逐个数，如 3 个圆饼=3p。",
    "- 索子(s)：绿色竹条，竹条的根数就是数字；1s 通常是一只鸟。",
    "- 字牌(z)：東=1z、南=2z、西=3z、北=4z、白(空白或蓝框)=5z、發(绿字)=6z、中(红字)=7z。字牌上没有数字图案。",
    "- 赤宝牌：红色的数字 5，记作 0m/0p/0s。",
    "第三步（自检，必须执行）：",
    "- 数出照片中实际的牌总数，tiles 加 melds 的总张数必须与之相等；绝不添加照片里不存在的牌。",
    "- 每种牌全副最多 4 张；如果某种牌数出了超过 4 张，说明认错了，回到图片重新核对易混牌（南/西、發/绿条索子、筒子个数、2s/3s）。",
    "- 和牌手牌通常总计 14 张（每组副露占其中 3-4 张），若数出的总数明显偏离请重新核对。",
    "",
    "输出：只输出一个严格 JSON 对象（json），不要 Markdown 围栏，不要 JSON 之外的文字。结构：",
    "{\"analysis\":\"逐张识别的简要依据\",\"count\":照片中的实际总张数,\"tiles\":[\"...\"],\"melds\":[{\"type\":\"chi|pon|kan-open|kan-closed|kan-added|north\",\"tiles\":[\"...\"],\"calledTile\":\"可省略\"}],\"confidence\":0到1的小数}",
    "tiles 放未副露的手牌与和牌张；melds 只放明确单独摆放的副露组；不确定的牌选最接近的并降低 confidence。"
  ].join("\n");
}

async function postJson(endpoint: string, apiKey: string, body: unknown): Promise<unknown> {
  const https = require("https") as {
    request(
      options: Record<string, unknown>,
      callback: (response: {
        statusCode?: number;
        setEncoding(encoding: string): void;
        on(event: "data", callback: (chunk: string) => void): void;
        on(event: "end", callback: () => void): void;
      }) => void
    ): {
      on(event: "error", callback: (error: Error) => void): void;
      write(data: string): void;
      end(): void;
    };
  };
  const url = new URL(endpoint);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(payload, "utf8"))
        }
      },
      (response) => {
        response.setEncoding("utf8");
        let text = "";
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`视觉服务调用失败 ${response.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error("视觉服务响应不是 JSON"));
          }
        });
      }
    );
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

async function postFormJson(endpoint: string, body: string): Promise<unknown> {
  const https = require("https") as {
    request(
      options: Record<string, unknown>,
      callback: (response: {
        statusCode?: number;
        setEncoding(encoding: string): void;
        on(event: "data", callback: (chunk: string) => void): void;
        on(event: "end", callback: () => void): void;
      }) => void
    ): {
      on(event: "error", callback: (error: Error) => void): void;
      write(data: string): void;
      end(): void;
    };
  };
  const url = new URL(endpoint);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": String(Buffer.byteLength(body, "utf8"))
        }
      },
      (response) => {
        response.setEncoding("utf8");
        let text = "";
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Roboflow 调用失败 ${response.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error("Roboflow 响应不是 JSON"));
          }
        });
      }
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function buildRoboflowEndpoint(options: {
  apiKey: string;
  model: string;
  confidence: string;
}): string {
  const modelPath = options.model
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://detect.roboflow.com/${modelPath}?api_key=${encodeURIComponent(
    options.apiKey
  )}&confidence=${encodeURIComponent(options.confidence)}`;
}

function normalizeRoboflowPredictions(response: unknown): TileDetection[] {
  if (!isRecord(response)) {
    throw new Error("Roboflow 响应顶层必须是对象");
  }
  if (!Array.isArray(response.predictions)) {
    throw new Error("Roboflow 响应缺少 predictions 数组");
  }

  return response.predictions.map((prediction, index) => {
    if (!isRecord(prediction)) {
      throw new Error(`Roboflow 第 ${index + 1} 个检测框不是对象`);
    }
    const className = prediction.class;
    if (typeof className !== "string" || !className.trim()) {
      throw new Error(`Roboflow 第 ${index + 1} 个检测框缺少 class`);
    }
    return {
      x: readFiniteNumber(prediction.x, `Roboflow 第 ${index + 1} 个检测框 x 无效`),
      y: readFiniteNumber(prediction.y, `Roboflow 第 ${index + 1} 个检测框 y 无效`),
      width: readFiniteNumber(prediction.width, `Roboflow 第 ${index + 1} 个检测框 width 无效`),
      height: readFiniteNumber(prediction.height, `Roboflow 第 ${index + 1} 个检测框 height 无效`),
      class: className,
      confidence: readFiniteNumber(
        prediction.confidence,
        `Roboflow 第 ${index + 1} 个检测框 confidence 无效`
      )
    };
  });
}

function readFiniteNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(message);
  }
  return value;
}

function extractMessageContent(response: unknown): string {
  if (!isRecord(response)) {
    return "";
  }
  const choices = response.choices;
  if (!Array.isArray(choices)) {
    return "";
  }
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    return "";
  }
  const content = first.message.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .join("");
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
