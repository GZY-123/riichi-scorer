# 微信小程序与云开发搭建指南

## 1. 注册小程序 AppID

1. 打开微信公众平台，注册小程序账号。个人主体即可用于本项目开发与体验版调试。
2. 在「开发管理」里复制 AppID。
3. 打开根目录 `project.config.json`，把占位符 `"touristappid"` 替换为你的真实 AppID。

## 2. 安装微信开发者工具

1. 安装微信开发者工具稳定版。
2. 选择「导入项目」，目录选择本仓库根目录 `/Users/gezhenyu/riichi-scorer`。
3. 确认项目配置：
   - `miniprogramRoot`: `miniprogram/`
   - `cloudfunctionRoot`: `cloudfunctions/`
   - `setting.useCompilerPlugins`: `["typescript"]`

## 3. 开通云开发

1. 在微信开发者工具顶部点击「云开发」。
2. 创建一个云环境，记录环境 ID。
3. 打开 `miniprogram/env.ts`，把 `replace-with-your-cloud-env-id` 替换为云环境 ID。
4. 在云数据库中新建集合 `rooms`。
5. 将 `rooms` 集合权限设置为「所有用户可读，仅云函数可写」。可使用类似规则：

```json
{
  "read": true,
  "write": false
}
```

客户端需要读取并监听房间文档；创建、加入、记分、撤销全部通过云函数执行。

## 4. 安装依赖

在仓库根目录执行：

```bash
npm install --package-lock=false
```

如果微信开发者工具提示云函数依赖缺失，分别在以下目录执行安装：

```bash
cd cloudfunctions/createRoom && npm install --package-lock=false
cd ../joinRoom && npm install --package-lock=false
cd ../applyEvent && npm install --package-lock=false
```

## 5. 部署云函数

在微信开发者工具中展开 `cloudfunctions/`，依次右键以下目录并选择「上传并部署：云端安装依赖」：

1. `createRoom`
2. `joinRoom`
3. `applyEvent`

部署完成后，在云开发控制台确认三个云函数都处于可调用状态。

## 6. 本地预览流程

1. 在微信开发者工具点击「编译」。
2. 首页输入昵称，选择三麻或四麻，点击「创建房间」。
3. 使用另一台设备或开发者工具多开模拟器，输入 6 位房间码加入。
4. 人数达到模式要求后房间自动进入对局中。
5. 房间页会通过 `rooms` 文档实时监听同步玩家、点数、局数、供托与事件履历。

## 7. 当前功能边界

- 本期不实现役种识别与算点，和牌/流局通过手动录入各家 `deltas` 完成。
- 「拍照识别」按钮仅提示「开发中」。
- 结算页当前按素点排序，最终得点先等于素点；后续接入 `engine/` 后替换精算逻辑。
- 云函数中的纯逻辑位于 `cloudfunctions/common/roomLogic.ts`，可用 `npx vitest run` 验证。
