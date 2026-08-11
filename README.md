# MYMEMO

个人数字空间 — 集日历事件、Deadline 追踪、时间块、灵感记录于一体的个人时间管理工具。

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **本地存储**: IndexedDB (Dexie.js)
- **日期处理**: Day.js
- **ID 生成**: UUID

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
src/
├── components/       # 通用组件
│   ├── base/         # 基础组件 (Button, Card, Input, Badge, Slider)
│   └── layout/       # 布局组件 (BackgroundLayer)
├── design-lab/       # 设计实验室（独立模块，不与业务耦合）
├── router/           # Vue Router 配置
├── stores/           # Pinia 状态管理
├── styles/           # 全局样式和 Design Tokens
├── types/            # TypeScript 类型定义
└── views/            # 页面
```

## 开发路线

- **Phase 0**: 项目初始化 + Design Lab + Design Token 体系
- **Phase 1**: 数据层 + CRUD
- **Phase 2**: 模块 UI + 日历集成 + 部署
