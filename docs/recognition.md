# 拍照识别与算点链路

## 架构

本链路从房间页进入 `pages/capture/capture`：

1. 小程序选择拍照或相册图片，先压缩到适合识别的尺寸。
2. capture 页优先使用端侧 ONNX 模型识别：下载并缓存模型，离屏 canvas letterbox 到 640x640，调用 `wx.createInferenceSession` 推理，再按检测框位置整理为 `tiles`。
3. 如果端侧模型未配置、下载失败、基础库不支持或推理异常，capture 页自动回退到云端识别：上传图片到云存储。
4. `recognizeTiles` 云函数下载图片，按 `VISION_PROVIDER` 选择视觉 Provider。
5. 视觉 Provider 调用 DashScope 大模型或 Roboflow 检测模型，统一返回严格 JSON。
6. `cloudfunctions/common/recognition.ts` 剥离 markdown 围栏和前后说明文字，解析并校验牌记法。
7. capture 页展示牌面网格，用户可逐张修改、增删、设和牌张，或编辑副露与场况。
8. `scoreHand` 云函数读取房间玩家和局况，调用部署目录内的 `engine-lib` 算役、番符、点数。
9. `cloudfunctions/common/scoreLogic.ts` 生成 `applyEvent` 所需的 `deltas`、供托变化、本场变化和是否推进局数。
10. 用户确认后，小程序调用既有 `applyEvent` 云函数事务落账。

识别失败不会中断流程；capture 页会显示失败原因，并允许直接手动录入牌面继续算点。

## 端侧模型

端侧识别使用自训 YOLOv8n ONNX 模型，输入为 float32 `[1,3,640,640]`，输出为 `[1,42,8400]`：前 4 行是 `cx, cy, w, h`，后 38 行是类别分数，不含 objectness。类别顺序写死在 `miniprogram/utils/yoloDecode.ts`，不要在不重新导出模型的情况下调整。

### 上传和配置

1. 在微信云开发控制台打开当前环境的云存储。
2. 拖拽上传导出的 `best-fp32.onnx`。
3. 复制上传后的 `fileID`。
4. 将 `miniprogram/env.ts` 里的 `TILE_MODEL_FILE_ID` 从占位值改成复制的 `fileID`。
5. 重新上传小程序代码。

`TILE_MODEL_FILE_ID` 只保存云存储 fileID，不保存任何密钥。模型约 12 MB，首次识别会下载到本地用户目录：

```text
${wx.env.USER_DATA_PATH}/tile-model.onnx
```

缓存存在时会直接复用，不再访问云存储。若替换了模型但文件名和缓存路径不变，需要清理小程序本地缓存或改代码中的缓存策略后重新发布。

### 回退链路

端侧路径失败时不会阻塞用户：capture 页会显示“云端识别中（本地不可用）”，随后走原来的图片上传和 `recognizeTiles` 云函数。端侧成功时不会上传图片，直接进入牌面修正界面；检测模型不区分副露，副露仍需在界面手动标注。

## 云函数环境变量

`DASHSCOPE_API_KEY` 只配置在云开发控制台的云函数环境变量中，不写入仓库。

建议同时给 `recognizeTiles` 配置：

```text
VISION_PROVIDER=dashscope
DASHSCOPE_API_KEY=你的 DashScope API Key
DASHSCOPE_MODEL=qwen-vl-max
```

### Roboflow 检测模型

如果使用 Roboflow 托管的 YOLO 目标检测模型：

1. 注册并登录 [roboflow.com](https://roboflow.com/)。
2. 在账号设置或工作区设置中获取 Private API Key。
3. 在 Universe 找到立直麻将检测模型，例如 `riichimahjongdetection/riichi-mahjong-detection`。
4. 进入模型的 Deploy / Hosted API 页面，复制 `model/version`，形如 `riichi-mahjong-detection/3`。
5. 在微信云开发控制台给 `recognizeTiles` 配置环境变量：

```text
VISION_PROVIDER=roboflow
ROBOFLOW_API_KEY=你的 Roboflow Private API Key
ROBOFLOW_MODEL=riichi-mahjong-detection/3
ROBOFLOW_CONFIDENCE=0.4
```

`ROBOFLOW_CONFIDENCE` 可省略，默认 `0.4`。Roboflow Provider 会按检测框位置排序并返回 `tiles`，但检测模型不区分副露，副露需要在界面手动标注。Roboflow 免费额度和托管 API 规则以 Roboflow 当前控制台为准；国内访问可能存在延迟、超时或不稳定，生产前需要用目标网络环境实测。

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
