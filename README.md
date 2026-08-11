# MYMEMO

个人数字空间。面向个人长期使用的时间管理工具。

## 产品定位

MYMEMO 是一款面向个人长期使用的时间管理工具。

它区别于传统 Todo / Calendar 的地方：

- 不强调复杂协作
- 不追求企业化管理
- 核心是个人时间管理和长期陪伴使用

用户是项目作者本人。工具会随着使用持续迭代，逐渐形成符合个人审美和习惯的数字空间。

核心功能模块：日历事件、Deadline 追踪、时间块（Duration）、灵感记录（Idea）。

## 视觉设计理念

为了提升长期使用体验，采用具有个人审美倾向的视觉设计：

- Glassmorphism（玻璃拟态）
- Soft Gradient（柔和渐变）
- Anime-inspired aesthetic（日系二次元美学倾向）
- Personal Dashboard / Floating Panel（个人面板 / 悬浮容器）

这些是当前阶段的视觉方向，不是固定不变的产品规格。作者会根据审美和使用感受持续调整。

设计原则：

- **Background Layer 与 Content Layer 分离** — 背景素材（渐变、光球、壁纸）独立于业务组件，更换背景不影响功能逻辑
- **Design Token 管理视觉参数** — 颜色、透明度、blur、圆角、阴影等统一通过 CSS Variables 管理，不在组件中硬编码
- **保证未来视觉迭代时不影响业务组件** — 基础组件封装样式，业务页面通过组件组合，视觉调整集中在 Token 层和组件层

Design Lab (`/playground`) 是长期维护的视觉实验模块，用于测试参数、调整主题、验证组件效果。它服务于开发者，不是面向终端用户的主题定制功能。

## 架构

### 分层结构

```
UI Components
    ↓
Pinia Store
    ↓
Service Layer
    ↓
Repository Layer
    ↓
IndexedDB (via Dexie)
```

**Repository 层隔离数据来源。** UI 和 Store 不直接操作存储，只通过 Repository 接口访问数据。

当前阶段数据存在浏览器 IndexedDB。未来迁移到后端 API 时，只需替换 Repository 实现，上层代码无需改动。

迁移路径：

```
当前:  UI → Store → Service → Repository → IndexedDB
未来:  UI → Store → Service → Repository → API → Database
```

### 技术栈

- Vue 3 + TypeScript + Vite
- Pinia（状态管理）
- Vue Router
- Dexie.js（IndexedDB 封装）
- Day.js（日期处理）
- UUID

### 项目结构

```
src/
├── components/
│   ├── base/         # 基础组件 (Button, Card, Input, Badge, Slider)
│   └── layout/       # 布局组件 (BackgroundLayer)
├── design-lab/       # 设计实验室（开发者工具，不与业务逻辑耦合）
├── router/           # Vue Router
├── stores/           # Pinia stores
├── services/         # 业务逻辑层
├── repositories/     # 数据访问层（隔离存储实现）
├── styles/           # 全局样式和 Design Tokens
├── types/            # TypeScript 类型定义
└── views/            # 页面
```

## 本地开发

### 环境要求

- Node.js 18+
- npm

### 启动

```bash
npm install
npm run dev
```

默认访问 http://localhost:5173/

### 可用脚本

```bash
npm run dev          # 启动开发服务器（HMR）
npm run type-check   # TypeScript 类型检查
npm run build        # 生产构建
npm run preview      # 预览构建产物
```

### 页面入口

| 路径 | 说明 |
|------|------|
| `/` | MYMEMO 主应用 |
| `/playground` | Design Lab（设计实验室） |
| `/data-test` | Phase 1 数据持久化验证页（临时） |

### Design Lab 说明

Design Lab（`/playground`）是**开发辅助工具**，不属于最终用户功能。

用途：

- 调整 Design Token（玻璃模糊、透明度、圆角、配色等）
- 实时预览背景效果和组件视觉
- 上传壁纸测试背景层效果
- 验证基础组件在不同参数下的表现
- 导出 CSS 变量供开发参考

Design Lab 中修改的参数保存在浏览器 localStorage 中，仅影响当前开发者的浏览器，不会写入代码或影响其他环境。它独立于业务逻辑，位于 `src/design-lab/`。

## 开发路线

### Phase 0: Foundation

已完成。

- Vue 3 + TypeScript + Vite 项目初始化
- Design Token CSS 变量体系
- Design Lab（视觉参数实验模块）
- 基础组件体系（Button / Card / Input / Badge / Slider）
- 背景层与内容层分离架构

### Phase 1: Local-first Core

- IndexedDB + Dexie 数据存储
- Repository 层抽象
- 四类事件的 CRUD 操作
- Pinia Store 接入
- 本地数据稳定可用

### Phase 2: Time Management Features

- Calendar 日历视图与事件管理
- Deadline 截止日期追踪
- Duration 时间块
- Idea 灵感记录
- 模块间的转化关系

### Phase 3: Personal Visual Iteration

- 视觉细节优化
- 背景素材迭代
- 动画与过渡效果
- 组件体验打磨
- Design Lab 持续扩展

### Phase 4: Cloud Evolution

- 后端服务
- API 层
- 多设备同步
- Repository 从 IndexedDB 切换到 API 实现

## 设计约束

- 不为未来架构过度设计当前阶段，但 Repository 抽象必须提前做好
- 基础组件只创建实际需要的，不提前抽象不存在的组件
- 视觉参数不硬编码，统一走 Design Token
- 业务组件不直接操作存储，必须经过 Repository
