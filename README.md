# 立直麻将记分小程序

这是一个基于微信小程序与微信云开发的日本立直麻将多人记分项目。当前任务搭建了小程序骨架、`rooms` 云数据库结构、多人房间实时同步、事件记分与撤销能力；役种与算点规则引擎后续接入 `engine/`，本任务只在事件中接收各家点数分差 `deltas`。

## 目录结构

```text
.
├── miniprogram/              # 原生微信小程序 TypeScript 页面
│   ├── pages/index/          # 昵称、创建房间、加入房间
│   ├── pages/room/           # 房间主界面、实时同步、事件录入
│   └── pages/settlement/     # 终局结算占位页
├── cloudfunctions/           # 微信云函数
│   ├── common/               # 房间码、座次、事件应用、撤销等纯逻辑
│   ├── createRoom/           # 创建房间
│   ├── joinRoom/             # 加入/恢复座位
│   └── applyEvent/           # 追加事件、更新点数、撤销
├── docs/setup.md             # 从零搭建与部署指南
├── project.config.json       # 微信开发者工具项目配置
└── tsconfig.json             # TypeScript strict 配置
```

## 开发运行

1. 安装依赖：

```bash
npm install --package-lock=false
```

1. 类型检查：

```bash
npx tsc --noEmit
```

1. 运行纯逻辑单元测试：

```bash
npx vitest run
```

1. 用微信开发者工具导入本目录，按 [docs/setup.md](docs/setup.md) 替换 AppID、开通云开发并部署云函数。

## 当前数据模型

`rooms` 集合每个文档使用 6 位房间码作为 `_id` 与 `roomCode`，包含：

- `mode`: `3p` 或 `4p`
- `status`: `waiting`、`playing`、`finished`
- `players[]`: `openid`、昵称、座次、当前点数
- `round`: 场风、局数、本场、立直棒、庄家座次
- `events[]`: 事件类型、发起者、各家 `deltas`、供托/本场变化、时间戳、撤销快照

点数守恒规则为：`玩家 deltas 总和 + 立直棒变化 * 1000 === 0`。后续接入算点引擎时只需要由引擎产出事件 `deltas`。
