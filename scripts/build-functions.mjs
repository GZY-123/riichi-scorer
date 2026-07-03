#!/usr/bin/env node
// 把 TS 云函数编译为可部署的 CommonJS 包：
// 微信云函数只上传各函数自己的目录且只能运行 JS，因此共享的 common
// 编译产物必须复制进每个函数目录内，入口为 dist/<函数名>/index.js。
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfRoot = join(root, "cloudfunctions");
const buildDir = join(cfRoot, ".build");
const FUNCTIONS = ["createRoom", "joinRoom", "applyEvent", "recognizeTiles", "scoreHand"];

rmSync(buildDir, { recursive: true, force: true });
execSync("npx tsc -p cloudfunctions/tsconfig.build.json", { cwd: root, stdio: "inherit" });

for (const name of FUNCTIONS) {
  const fnDir = join(cfRoot, name);
  const distDir = join(fnDir, "dist");
  rmSync(distDir, { recursive: true, force: true });
  cpSync(join(buildDir, name), join(distDir, name), { recursive: true });
  cpSync(join(buildDir, "common"), join(distDir, "common"), { recursive: true });
  if (name === "scoreHand") {
    const engineLib = join(fnDir, "engine-lib");
    if (!existsSync(engineLib)) {
      throw new Error("缺少 cloudfunctions/scoreHand/engine-lib，请先运行 npm run build:engine:cloud");
    }
    cpSync(engineLib, join(distDir, name, "engine-lib"), { recursive: true });
  }
  console.log(`built cloudfunctions/${name}/dist`);
}

rmSync(buildDir, { recursive: true, force: true });
