# AGENTS.md — MYMEMO Repository Guidelines

> 面向接手本仓库的 Agent。读完此文档即可安全上手；具体实现细节请直接读源码。
> 一切以**当前代码**为准。若本文档与代码不一致，以代码为准，并请同步更新本文档。

---

## 1. 项目定位与技术栈

- **MYMEMO**：作者本人的个人时间管理工具（个人数字空间），**纯本地浏览器 SPA，无后端**，数据存浏览器 IndexedDB。
- 四类核心功能：日历事件（Calendar）、截止日期（Deadline）、时间块（Duration）、灵感记录（Idea）。
- 技术栈：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Dexie(IndexedDB) + Day.js + UUID；日历用 **Vue Cal 4.10.2（精确锁定版本）**。
- 包管理：**pnpm 11**（`packageManager` 字段声明）；新增依赖一律用 pnpm。

## 2. 目录结构（重点）

- `src/`：主程序（components / composables / db / repositories / router / services / stores / styles / types / views）
- `Calendar/`：日历子模块（`@calendar` 别名，**根目录，不是 `src/modules/`**）
- `design-lab/`：设计实验室（`@design-lab` 别名，根目录，开发工具）
- 路径别名：`@`→`src/`、`@calendar`→`Calendar/`、`@design-lab`→`design-lab/`
- 入口：`/`（Dashboard 主界面，`pnpm dev` 默认打开）；`/design-lab`、`/calendar`、`/data-test` 均为开发页

## 3. 核心架构（不可破坏）

```
UI Components → Pinia Store → Service → Repository → IndexedDB (Dexie)
```

- **Repository 层隔离数据来源**：UI / Store / Service 都不直接操作存储，只能通过 Repository 接口访问。
- **禁止**在 `db/` 之外直接 `import { db }` 操作 IndexedDB。
- 未来切后端只需替换 Repository 实现，上层代码不动。

## 4. 数据持久化大原则

- 业务数据 → IndexedDB（Dexie）；UI 状态 → localStorage；两者分离。
- 图片 / 背景一律用 **base64 DataURL** 持久化，**禁止 Object URL**（无法跨刷新存活）。
- localStorage 键统一集中在 `src/services/storageKeys.ts`（唯一白名单），**不要在业务代码里手写字面量键名**。
- 数据库 schema 变更：**声明新的 Dexie version**，不要原地改已有版本。

## 5. 事件系统（四类，语义不同）

- 数据模型：TypeScript **可辨识联合（Discriminated Union）**，见 `src/types/event.ts`。
- 四种类型：
  - `calendar`：定点日期 + 时间；
  - `deadline`：截止日期 + 优先级；
  - `duration`：跨日期区间，`end_date = null` 表示「已开始、终点未知」的开放区间，`color` 仅影响日历展示；
  - `idea`：灵感记录（无任务状态，仅 `archived` 归档管理）。
- Status（仅任务型事件 calendar/deadline/duration 拥有）：`pending / in_progress / completed / cancelled / stateless`。`stateless` = 纯事件记录，不参与任务进度。
- **Idea 特殊规则（最容易踩坑）**：
  - 无 `status` 字段，不参与任务状态；
  - **不进入日历**、不进入事件全览 / 待办 / 今日完成统计；
  - Dashboard「灵感」统计**只计 `archived === false`**。
- 显示状态由「事件数据 + 当前日期」推导（`deriveEventDisplayStatus`），**不写回数据库原始 status**；`stateless / completed / cancelled` 永不被日期覆盖；deadline 不自动更新状态。

## 6. 日历（Vue Cal 4.10.2，兼容性硬约束）

- **保持 `vue-cal@4.10.2`**，升级 / 换组件前先确认兼容。
- 月视图根 prop 是 `activeView: 'month'`（**不是 `view`**）；Vue Cal 默认的导航 / 建事件行为（双击导航、单击导航、按住建事件、拖动建事件）已被显式禁用，**不要重新启用**。
- 月份切换统一走内部 `setViewMonth`，**不使用 `@update:view-date`**；视图月归一化为「月首 00:00」。
- **Idea 事件不进入日历**（在数据映射层过滤，而非 CSS 隐藏）。
- 时间块（Duration）显示**默认关闭**（回退为小圆点）；开关在日历头部右上角，状态持久化；`color` 仅影响展示。

## 7. Dashboard 布局

- **4×4 网格**；固定组件尺寸固定（calendar 2×2、today-events 2×1、pinned-event 2×1），仅可拖动位置；图片组件固定 1×1。
- 布局与固定事件（Pin）持久化到 localStorage。
- 删除图片组件时，需**同时**从布局与图片数据 Store 中移除。

## 8. Design Lab / DSL 与正式业务

- Design Lab 是**开发调试工具**（作者专用），**不是默认首页**（入口在 Sidebar 底部）。
- **temp vs fixed 双轨**：DSL 里改的滑块 / 壁纸都是 temp，只影响预览区；只有「固定当前背景」才写入正式背景（Store + IndexedDB）。
- 不要在新业务组件里依赖 DSL 的 temp 状态；正式数据走 Store / Repository。

## 9. Design Token / UI 原则

- **背景层与内容层分离**：背景素材独立于业务组件，更换背景不影响功能逻辑。
- 视觉参数统一走 Design Token（`src/styles/tokens.css` 的 CSS Variables），**组件中禁止硬编码颜色 / 透明度 / blur / 圆角**；`tokens.css` 基准值不得修改。
- 默认视觉：暖调、低饱和米白纸基底、玻璃拟态、柔和渐变；避免高饱和紫蓝「科技风」。
- 弹窗 / 遮罩（EventForm、ImageCropModal、ConfirmDialog 等）**必须 Teleport 到 body**，否则与 Dashboard 小部件 stacking context 产生 z-index 层级问题。
- 不要用 setTimeout / force reload / key 重建去掩盖渲染问题。

## 10. 开发 / 检查 / 构建命令

使用 **pnpm**（无 lint / format / 测试脚本；验证靠 type-check + dev 手动验证）：

```bash
pnpm dev            # 开发服务器（HMR），默认打开 /
pnpm type-check     # TS 类型检查（vue-tsc --noEmit），改动后必须通过
pnpm build          # 类型检查 + 生产构建
pnpm preview        # 预览构建产物
```

## 11. Git / Agent 行为规范

- 默认分支 `main`。
- **不要自动 commit / push**——提交由作者手动发起，每次改动后交给作者审阅。
- commit 风格无强制规范（仓库历史为中文短词 + 少量 Conventional Commits 混合）。
- `bg.jpg` / `icon_orgin.jpg` 为个人素材，已解除 Git 跟踪，**绝不 `git add`**。
- 修改代码的基本行为规范：
  - 不修改 / 不重构无关代码，不顺手修 bug；
  - 不新增依赖，不引入新 UI 框架（尤其日历相关）；
  - 不改动数据模型与整体架构；
  - 不创建多余文档。
