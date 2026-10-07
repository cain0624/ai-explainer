# AI 知识地图 · Agent 与 RAG

用可逐步展开的链路，将 AI 原理转成可操作的理解过程。

**作品形态：纯静态交互学习站**

[在线体验](https://cain0624.github.io/ai-explainer/) · [个人作品集](https://kunyu-builds.s291623933.chatgpt.site/projects/ai-explainer.html)

> 项目案例依据当前公开代码、页面、README 与提交记录整理。已实现、历史验证记录和下一步计划分别标明；模拟数据不作为真实业务结果。

## 背景

Agent 和 RAG 常以术语列表或复杂架构图介绍，初学者难以理解每一步处理什么、为什么需要，以及如何评价结果。

作品围绕两条完整链路设计中文交互讲解，让读者从原理进入流程、实践与评估。



## 问题



- 一次性展示全部组件会增加认知负担，用户记住名词却不理解输入输出。
- 离线索引、在线检索和 Agent 执行循环容易被混为一谈。
- 动画教学需要服务于步骤关系，不能让视觉变化盖过信息理解。

## 思考



- 采用为什么、是什么、全链路、进阶与实践的阅读顺序，先建立动机再展开架构。
- 用逐步解锁展示单步输入输出，并保留全链路视图，兼顾局部理解和整体定位。
- 采用零依赖静态方案，教学核心不需要模型调用，降低打开与分享门槛。

## 动作



- 建立 Agent 和 RAG 两个子站，共用首页入口与品牌互跳。
- Agent 以九步交互展开规划、工具、记忆等环节；RAG 区分离线五步和在线四步。
- 组织六件套、进阶、实战和评估内容，用原生 JavaScript 承载步骤状态与交互。

## 优化



- 已实现：进入站点自动定位全链路，支持本地与托管环境的导航路径切换。
- 当前公开历史主要为首版发布，尚无多轮学习效果优化记录。
- 下一步：增加学习前后测、错误概念反馈与可运行小案例，验证步骤解锁是否提高理解。

## 结果

已交付可直接访问的双主题交互知识站，无外部依赖与构建步骤。它展示的是知识结构化和交互教学能力。

没有公开学习效果实验，不能将九步或模块数量等同于理解提升。

- 建议衡量：全链路完成率、输入输出辨识正确率、学习前后测变化和关键概念误解率。
- 验收路径：进入 Agent 或 RAG → 逐步解锁 → 解释每步输入输出 → 对照实战与评估。

## 实现证据与关联作品

| 内容 | 文件 |
| --- | --- |
| Agent 链路交互 | [agent-explainer/app.js](https://github.com/cain0624/ai-explainer/blob/main/agent-explainer/app.js) |
| RAG 链路交互 | [rag-explainer/app.js](https://github.com/cain0624/ai-explainer/blob/main/rag-explainer/app.js) |
| 知识组织 | [agent-explainer/index.html](https://github.com/cain0624/ai-explainer/blob/main/agent-explainer/index.html) |

- [AI 产品经理 · 学习与面试教练](https://github.com/cain0624/ai-pm-app)
- [求职，我帮你 · 岗位知识库](https://github.com/cain0624/jd-insight)
- [AntInsure AI · 主动销售 Agent](https://github.com/cain0624/antinsure-ai)

---

<details>
<summary>技术使用与原有说明（展开查看；能力边界以以上案例为准）</summary>

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

</details>
