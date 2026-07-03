import type { GameMode } from "../common/roomLogic";

declare const process: {
  env: Record<string, string | undefined>;
};
declare const require: (id: string) => unknown;

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

export function buildRecognitionPrompt(mode: GameMode): string {
  const sanmaRule =
    mode === "3p" ? "当前是三麻，万子只允许 1m、9m，不能输出 2m 到 8m。" : "当前是四麻。";
  return [
    "你是日本立直麻将牌面识别助手。请识别图片中的和牌手牌和已公开副露。",
    sanmaRule,
    "牌记法必须使用：1m..9m、1p..9p、1s..9s、1z..7z，赤五使用 0m/0p/0s。",
    "字牌约定：1z东、2z南、3z西、4z北、5z白、6z发、7z中。",
    "只输出严格 JSON，不要 Markdown，不要解释文字。",
    "JSON 结构必须是：{\"tiles\":[\"...\"] , \"melds\":[{\"type\":\"chi|pon|kan-open|kan-closed|kan-added|north\",\"tiles\":[\"...\"],\"calledTile\":\"可省略\"}], \"confidence\":0到1的小数, \"notes\":\"可省略\"}。",
    "tiles 放暗手牌和和牌张；melds 放副露。无法确定时仍输出最可能结果，并降低 confidence。"
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
          "Content-Length": String(payload.length)
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
