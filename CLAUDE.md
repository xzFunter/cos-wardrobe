# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

COS-wardrobe（COS服管理系统）- 一个 RPG/像素风格的双人 COS 服装仓库管理系统。两个用户（两位 coser）共享全局模板（模特蓝图、组件字典），各自拥有独立的 COS 服套装数据。

## 技术栈

- **后端**: Express.js v5 + SQLite (`sqlite3` 包) + Multer 文件上传
- **前端**: Vue 3 (SFC `<script setup>`) + Vite + Vue Router + Vue Flow (画布节点编辑)
- **样式**: NES.css 像素风 UI 框架 + Zpix 中文像素字体
- **部署**: Docker Compose，目标环境群晖 NAS

## 项目结构

```
cos-wardrobe/
├── backend/
│   ├── server.js              # 单一入口，所有 API 路由写在一个文件中
│   ├── system_config.json     # 全局配置：资源目录映射、枚举定义、种子数据
│   ├── assets/                # 上传文件的静态资源目录 (运行时自动创建子目录)
│   └── database.sqlite        # SQLite 数据库文件
├── cos-wardrobe-frontend/
│   ├── src/
│   │   ├── main.js            # Vue 应用入口，注册 router
│   │   ├── router.js          # 两级路由：/ (登录), /app/* (主布局子路由)
│   │   ├── App.vue            # 根组件，仅 <router-view />
│   │   ├── style.css          # 全局样式：Zpix 字体引入、NES.css、pixelated 渲染
│   │   ├── layout/
│   │   │   └── MainLayout.vue # 侧边栏导航布局 + 游戏 Toast 浮窗
│   │   ├── views/
│   │   │   ├── Login.vue      # 用户选择页 (酒馆大门)
│   │   │   ├── Inventory.vue  # 套装仓库网格 (装备大厅)
│   │   │   ├── Forge.vue      # 套装创建/编辑 (锻造工坊)
│   │   │   ├── Display.vue    # 套装展示 + 节点画布 (模特展台)
│   │   │   ├── Chest.vue      # 通用组件库 (百宝箱)
│   │   │   ├── Office.vue     # 设置：模特模板 & 组件字典管理
│   │   │   └── ModelSetup.vue # 蓝图编辑器：在模特图上放置节点+连线
│   │   └── utils/
│   │       ├── api.js         # API_BASE / ASSET_BASE (基于局域网 IP 动态获取)
│   │       └── toast.js       # 简易 Toast 通知工具
│   └── vite.config.js         # Vite 配置：host: true (局域网可访问), port 5173
├── docker-compose.yml         # 后端暴露 3001, 前端 Nginx 暴露 8080
├── Plaintext.md               # 原始需求文档/文件结构说明
└── SQL.md                     # 数据库 schema 设计初稿
```

## 开发命令

所有命令在各自子目录下运行：

```bash
# 前端开发 (cos-wardrobe-frontend/)
npm run dev          # 启动 Vite 开发服务器，默认 http://localhost:5173
npm run build        # 生产构建
npm run preview      # 预览生产构建

# 后端 (backend/)
node server.js       # 启动后端，监听 3000 端口
```

**注意**: 前端通过 `window.location.hostname` 动态拼接后端 API 地址，期望后端在 3000 端口运行。前端 dev server 和后端必须同时启动。

## 核心架构概念

### 数据模型层级

1. **全局共享模板**（`is_system = 1` 由 `system_config.json` 种子数据植入，`is_system = 0` 为用户自定义）:
   - `model_templates` - 模特底图（可附带 `layout_data` 存储 Vue Flow 画布节点/连线数据）
   - `component_templates` - 组件字典（名称、类型枚举、图标）
   - `common_components` - 通用组件库（百宝箱），可跨套装共享使用

2. **用户专属数据**:
   - `user_costumes` - 每套 COS 服的元数据（封面、作品来源 origin、绑定模特 model_id、组件配置 JSON `components_data`）
   - `origins` - 作品来源列表（全局共享，带 UNIQUE 约束）

3. **ID 分配约定**: 后端启动时通过插入/删除 dummy id=10000 行来抬高 SQLite 自增序列。系统内置数据 ID < 10000，用户自定义数据 ID ≥ 10000。

### 排序与插入

所有实体（套装、模特、组件字典、通用组件）支持 `sort_order` 字段。前端网格视图在每个卡片间隙提供"缝隙插入"交互：
- 点击卡片间缝隙 → 跳转到创建页面并携带 `insertAfter` / `insertBefore` query 参数
- 后端 `/api/costumes`、`/api/models`、`/api/components`、`/api/common-components` 的 POST 请求均接受 `insert_after_id` / `insert_before_id`，自动调整 `sort_order`
- 批量排序通过 `/api/save-order` 接口保存，传入 `{ table, idList }`

### 蓝图编辑器 (ModelSetup.vue)

最复杂的视图。使用 Vue Flow 画布：
- 左侧：组件工具箱（从 `/api/components` 加载）
- 右侧：画布。模特节点上点击空白处可创建自定义 Handle（挂载点），双击 Handle 循环切换方向（Top → Bottom → Left → Right → 删除）
- 组件节点拖放到画布后，手动连线（从组件的 source Handle 连到模特节点的 target custom Handle）
- 保存时调用 `PUT /api/models/:id/layout` 将整个 Vue Flow 图数据（nodes + edges）JSON 序列化存入 `layout_data`

### 通用组件关联 (百宝箱)

在 Forge.vue 中，每个激活的组件槽位可以关联一个 `common_components` 中的通用组件：
- 关联后自动标记为"已拥有"
- 关联后图源图标自动同步为通用组件的图标
- 解除关联（清空搜索框）后恢复蓝图默认状态

### API 路由速查

所有路由前缀 `/api`:
- `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id/last-visited`
- `GET/POST/PUT /api/costumes`, `GET /api/costumes/:id`
- `GET/POST/PUT /api/models`, `GET /api/models/:id`, `PUT /api/models/:id/layout`
- `GET/POST/PUT /api/components`, `GET/POST/PUT /api/common-components`
- `GET/POST /api/origins`
- `POST /api/upload?target=<dir_key>` (文件上传)
- `POST /api/save-order` (批量排序)
- `DELETE /api/:type/:id` (通用删除，type 映射: models→model_templates, components→component_templates, common-components→common_components)
- `GET /api/system-config` (返回 enums)

### 前端全局约定

- 用户身份通过 `localStorage` 保存：`currentUserId`, `currentUserName`
- 图片压缩：前端上传前统一压缩至 ≤1MB、分辨率 ≤1024px
- 像素渲染：所有 `<img>` 应用 `image-rendering: pixelated` 类 `.pixel-render`
- 剪贴板支持：所有上传区域支持从剪贴板读取图片或 emoji 文本
- URL 判断：`isUrl()` 检测是否后端静态资源路径（`.startsWith('/assets')`），通过 `ASSET_BASE` 拼接完整 URL

### 数据库表列注意事项

后端 `server.js` 在启动时通过 `ALTER TABLE ADD COLUMN` 补丁式扩展列（允许报错忽略），因此实际 schema 比 `SQL.md` 中设计的更多：
- `user_costumes` 额外列: `origin`, `model_id`, `components_data`, `sort_order`
- `model_templates` 额外列: `layout_data`, `sort_order`, `description`
- `component_templates` / `common_components` 额外列: `sort_order`, `description`
- `users` 额外列: `avatar`, `last_visited_costume_id`
