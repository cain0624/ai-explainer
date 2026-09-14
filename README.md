# AI 知识地图 · Agent 与 RAG 从原理到实践

两套可交互的中文图文讲解站点，纯静态（HTML + CSS + 原生 JS，无任何外部依赖与构建步骤），由 GitHub Pages 托管。

## 线上地址

| 站点 | 地址 |
| --- | --- |
| 首页入口 | https://cain0624.github.io/ai-explainer/ |
| AI Agent 智能体 | https://cain0624.github.io/ai-explainer/agent-explainer/ |
| RAG 检索增强生成 | https://cain0624.github.io/ai-explainer/rag-explainer/ |

两站进入时都会自动定位到「全链路」模块，左上角品牌标识可下拉互跳。

## 目录结构

```
ai-explainer/
├── index.html            # 首页入口（两个站点的导航卡片）
├── styles.css            # 首页样式
├── agent-explainer/      # AI Agent 讲解站
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── rag-explainer/        # RAG 讲解站
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── deploy.sh             # 从本地源目录同步内容并推送
└── .nojekyll             # 关闭 Jekyll 处理，保证下划线开头的路径可访问
```

## 内容结构

**AI Agent**：为什么 → 是什么 → 全链路（横向架构图 + 9 步逐步解锁交互） → 6 件套 → 进阶 → 实战 → 评估
核心公式：`Agent = LLM + Tools + Memory + Planning`

**RAG**：为什么 → 是什么 → 全链路（离线索引 5 步 + 在线检索生成 4 步，逐步解锁交互） → 进阶
核心链路：`数据加载 → 清洗 → 切片 → 向量化 → 入库 ⇒ Query 向量化 → 检索 → 拼 Prompt → 生成`

## 本地预览

任选一种：

```bash
# 直接双击 index.html，或起一个静态服务
python3 -m http.server 8080
# 然后访问 http://127.0.0.1:8080/
```

`app.js` 里的站点互跳逻辑按环境自动分支：`file://` 直开与线上托管走相对目录，本地开发服务器走端口切换。

## 更新发布

内容源目录在 `~/Desktop/agent-explainer/` 与 `~/Desktop/rag-explainer/`，改完后执行：

```bash
./deploy.sh "本次改动说明"
```

脚本会把两个源目录的 `index.html` / `styles.css` / `app.js` 同步过来（不含 `.bak` 备份文件），提交并推送到 `main`，Pages 会自动重新构建。
