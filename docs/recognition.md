# 拍照识别与算点链路

## 架构

本链路从房间页进入 `pages/capture/capture`：

1. 小程序选择拍照或相册图片，上传到云存储。
2. `recognizeTiles` 云函数下载图片，按 `VISION_PROVIDER` 选择视觉 Provider。
3. DashScope Provider 调用 `qwen-vl-max`，要求模型只返回严格 JSON。
4. `cloudfunctions/common/recognition.ts` 剥离 markdown 围栏和前后说明文字，解析并校验牌记法。
5. capture 页展示牌面网格，用户可逐张修改、增删、设和牌张，或编辑副露与场况。
6. `scoreHand` 云函数读取房间玩家和局况，调用部署目录内的 `engine-lib` 算役、番符、点数。
7. `cloudfunctions/common/scoreLogic.ts` 生成 `applyEvent` 所需的 `deltas`、供托变化、本场变化和是否推进局数。
8. 用户确认后，小程序调用既有 `applyEvent` 云函数事务落账。

识别失败不会中断流程；capture 页会显示失败原因，并允许直接手动录入牌面继续算点。

## 云函数环境变量

`DASHSCOPE_API_KEY` 只配置在云开发控制台的云函数环境变量中，不写入仓库。

建议同时给 `recognizeTiles` 配置：

```text
VISION_PROVIDER=dashscope
DASHSCOPE_API_KEY=你的 DashScope API Key
DASHSCOPE_MODEL=qwen-vl-max
```

无 Key 联调时可改用 Mock：

```text
VISION_PROVIDER=mock
MOCK_VISION_RESPONSE={"tiles":["1m","2m","3m","4p","5p","6p","2s","3s","4s","7s","8s","9s","5z","5z"],"melds":[],"confidence":0.99}
```

Mock 只用于开发测试，不会访问外部模型。

## 构建与部署

`scoreHand` 云函数必须自包含引擎 JS，部署前在仓库根目录执行：

```bash
npm run build
```

该脚本会用 `tsc` 编译 `engine/src`，输出到：

```text
cloudfunctions/scoreHand/engine-lib/
```

部署云函数时，在微信开发者工具中上传并部署：

1. `recognizeTiles`
2. `scoreHand`
3. 已有 `applyEvent`

如果修改了 `engine/src`，需要重新执行 `npm run build` 后再部署 `scoreHand`。

## 费用量级

一次识别约等于一次多模态模型请求，费用主要由图片 token 和输出 token 决定。实际单价以 DashScope 控制台当前计费为准。

降低费用的做法：

- 小程序使用压缩图上传。
- prompt 要求只输出 JSON，减少输出 token。
- 识别结果支持人工修正，失败时不重复盲目调用。
- 开发和演示环境使用 `VISION_PROVIDER=mock`。
