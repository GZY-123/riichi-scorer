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

`users` 集合用于保存头像昵称资料，文档 `_id` 为用户 `OPENID`。该集合会在首次调用 `userProfile` 云函数保存资料时自动创建；权限保持默认「仅创建者可读写」即可，小程序端不直接读写 `users`，读取和保存都走云函数。

## 4. 安装依赖

在仓库根目录执行：

```bash
npm install --package-lock=false
```

如果微信开发者工具提示云函数依赖缺失，分别在以下目录执行安装：

```bash
cd cloudfunctions/createRoom && npm install --package-lock=false
cd ../joinRoom && npm install --package-lock=false
cd ../userProfile && npm install --package-lock=false
cd ../applyEvent && npm install --package-lock=false
cd ../listMyRooms && npm install --package-lock=false
```

## 5. 部署云函数

云函数以 TypeScript 编写，部署前必须先在仓库根目录编译出 `dist/`（每个函数的入口是 `dist/<函数名>/index.js`，共享的 `common` 与 `engine-lib` 会一并复制进函数目录）：

```bash
npm install
npm run build   # = build:engine:cloud + build:functions
```

然后在微信开发者工具中展开 `cloudfunctions/`，依次右键以下目录并选择「上传并部署：云端安装依赖」：

1. `createRoom`
2. `joinRoom`
3. `userProfile`
4. `applyEvent`
5. `listMyRooms`
6. `scoreHand`
7. `recognizeTiles`（部署后在云开发控制台为其配置环境变量 `DASHSCOPE_API_KEY`，见 `docs/recognition.md`）

部署完成后，在云开发控制台确认云函数都处于可调用状态。修改任何云函数 TS 源码后需重新 `npm run build:functions` 再上传。

本版本新增对局记录与历史牌谱：

- `listMyRooms` 必须上传部署，否则首页「对局记录」无法读取历史房间。
- `applyEvent` 增加和牌牌谱 `detail` 透传，升级后也需要重新上传部署。
- `createRoom` 增加房间规则写入，`scoreHand` 会读取房间规则中的切上满贯与三麻自摸损；升级后这两个云函数也需要重新上传部署。
- 历史列表会按 `rooms.updatedAt` 倒序读取最近 30 场；数据量增大后，可在云数据库为 `rooms.updatedAt` 建降序索引作为可选优化。
- 旧房间文档没有 `rules` 字段时会自动按模式回退默认规则：四麻半庄 25000/30000、10-20 马；三麻半庄 35000/40000、15-0 马。

## 6. 本地预览流程

1. 在微信开发者工具点击「编译」。
2. 首页选择头像、填写昵称并保存资料，选择三麻或四麻，点击「创建房间」。
3. 使用另一台设备或开发者工具多开模拟器，输入 6 位房间码加入。
4. 人数达到模式要求后房间自动进入对局中。
5. 房间页会通过 `rooms` 文档实时监听同步玩家、点数、局数、供托与事件履历。

## 7. 当前功能边界

- 房间支持创建时设置局数、起始点、返点、顺位马、击飞、切上满贯与三麻自摸损。
- 拍照算点会调用 `scoreHand` 并落账为房间事件，无法识别时仍保留手动录入。
- 结算页使用端侧 `engine/` 结算能力计算返点、顺位马、供托归一位与最终精算得点。
- 云函数中的纯逻辑位于 `cloudfunctions/common/roomLogic.ts` 和 `cloudfunctions/common/scoreLogic.ts`，可用 `npx vitest run` 验证。
