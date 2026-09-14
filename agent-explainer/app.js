/* ================================================================
   AI Agent 教学网站 · 状态机 + 交互逻辑
   - 9 步逐步解锁（4 构建期 + 5 运行期）
   - 构建期完成后运行期才解锁
   - 每个步骤都有真实的用户操作（选择器/开关/滑块）
   ================================================================ */

(function () {
  'use strict';

  /* ---------- 1. 状态机 ---------- */
  const state = {
    steps: {
      1: 'active', 2: 'locked', 3: 'locked', 4: 'locked',
      5: 'locked', 6: 'locked', 7: 'locked', 8: 'locked', 9: 'locked'
    },
    config: {
      // 构建期
      persona: 'devops',
      goal: '在 10 分钟内定位线上服务 5xx 错误的根因，给出修复建议并生成故障报告',
      tone: 'concise',
      tools: new Set(['search', 'sql', 'code', 'file']),
      schemaDetail: 'full',
      memories: new Set(['buffer', 'vector', 'scratch']),
      memoryBudget: 8,
      planning: 'react',
      maxSteps: 15,
      hitl: 'risky',
      // 运行期
      task: '线上订单服务从今天 14:00 开始大量报 502，帮我定位原因并给出修复方案',
      thinking: 'deep',
      flags: new Set(['todo', 'critique']),
      execMode: 'auto',
      toolRetry: 'retry',
      obs: 'compress',
      errorPolicy: 'reflect',
      terminate: 'goal',
      outputFormat: 'both'
    }
  };

  const PERSONA = {
    sales: { name: '保险销售顾问', role: '资深保险规划师', style: '专业、克制、不夸大收益' },
    devops: { name: '运维排障助手', role: 'SRE 运维专家', style: '先定位事实再给结论' },
    analyst: { name: '数据分析师', role: '高级数据分析师', style: '用数据说话，标注口径' },
    cs: { name: '客服处理专员', role: '客户服务专员', style: '耐心、共情、给明确下一步' }
  };
  const TOOL_NAME = {
    search: { cn: '联网搜索', fn: 'web_search', arg: '"query": "订单服务 502 错误"' },
    sql: { cn: 'SQL 查询', fn: 'query_database', arg: '"sql": "SELECT ... FROM error_log"' },
    code: { cn: '代码执行', fn: 'run_code', arg: '"language": "python", "code": "..."' },
    http: { cn: 'HTTP 请求', fn: 'http_request', arg: '"method": "GET", "url": "..."' },
    file: { cn: '文件读写', fn: 'read_write_file', arg: '"path": "/var/log/order.log"' },
    notify: { cn: '消息通知', fn: 'send_notification', arg: '"channel": "dingtalk"' },
    ticket: { cn: '工单操作', fn: 'manage_ticket', arg: '"action": "create"' },
    write: { cn: '写操作（危险）', fn: 'execute_write', arg: '"target": "prod-db"' }
  };
  const TOOL_DESC = {
    search: '在互联网上检索实时信息。当需要最新资讯、外部数据时使用。',
    sql: '对只读数据仓库执行 SQL 查询。只允许 SELECT 语句，单次最多返回 1000 行。',
    code: '在隔离沙箱中执行代码。适合数据计算、日志解析、格式转换等任务。',
    http: '向指定 URL 发起 HTTP 请求。需要调用外部 API 时使用。',
    file: '读写服务器上的文件。读取日志、生成报告文件时使用。',
    notify: '发送消息通知到指定渠道。channel 可选：dingtalk / email / sms。',
    ticket: '创建、更新、关闭工单。需要跟进问题时使用。',
    write: '【高危】执行写操作，会修改线上数据。调用前必须获得显式授权。'
  };
  const MEMORY_NAME = {
    buffer: '短期对话缓冲', vector: '长期向量记忆', scratch: '工作记忆（草稿板）',
    entity: '实体记忆（用户画像）', summary: '摘要记忆', episodic: '情景记忆（案例库）'
  };
  const MEMORY_DETAIL = {
    buffer: '最近 10 轮对话原文，保证指代清晰',
    vector: '历史任务与结论向量化，按语义召回 Top3',
    scratch: '中间结果暂存区，不进入最终上下文',
    entity: '记住用户身份、偏好、历史交互摘要',
    summary: '超过 20 轮后自动摘要压缩，控制 token',
    episodic: '沉淀成功/失败案例，供相似任务参考'
  };
  const PLANNING_NAME = {
    react: 'ReAct（推理与行动交替）',
    'plan-exec': 'Plan-and-Execute（先规划后执行）',
    reflexion: 'Reflexion（带自我反思）',
    multi: 'Multi-Agent（多智能体协作）'
  };
  const HITL_NAME = { never: '全自动，不介入', risky: '高风险动作需确认', always: '每步都需确认' };
  const EXEC_NAME = { auto: '自动执行', parallel: '并行调用', confirm: '调用前确认' };
  const RETRY_NAME = { retry: '失败自动重试', fallback: '切换备用工具', stop: '立即中断' };
  const OBS_NAME = { compress: '压缩摘要后回填', raw: '原样回填', filter: '只回填关键字段' };
  const ERR_NAME = { reflect: '反思原因再重试', replan: '重新规划路径', escalate: '升级给人工' };
  const TERM_NAME = { goal: '目标达成即停', confidence: '置信度阈值触发', budget: '预算耗尽即停' };
  const THINK_NAME = { fast: '快思考（无思维链）', deep: '深思考（显式思维链）', tree: '思维树（多方案择优）' };

  /* ---------- 2. DOM 工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const card = (step) => $(`.step-card[data-step="${step}"]`);

  /* ---------- 3. 初始化步骤卡片状态 ---------- */
  function initState() {
    Object.keys(state.steps).forEach(n => {
      const c = card(n);
      if (!c) return;
      c.dataset.status = state.steps[n];
      c.classList.remove('active', 'done', 'locked');
      if (state.steps[n] === 'active') c.classList.add('active');
      if (state.steps[n] === 'done') c.classList.add('done');
      if (state.steps[n] === 'locked') c.classList.add('locked');

      const output = $('.step-output', c);
      if (output) output.hidden = true;

      const badge = $('.step-state-badge', c);
      if (badge) {
        if (state.steps[n] === 'active') {
          badge.className = 'step-state-badge state-active';
          badge.textContent = '⏳ 待操作';
        } else if (state.steps[n] === 'done') {
          badge.className = 'step-state-badge state-done';
          badge.textContent = '✅ 已完成';
        } else {
          badge.className = 'step-state-badge state-locked';
          badge.textContent = '🔒 上锁';
        }
      }
    });
    syncSidebar();
    updateProgress();
  }

  /* ---------- 3b. 同步左侧导航状态 ---------- */
  function syncSidebar() {
    $$('.sidebar-item').forEach(item => {
      const n = parseInt(item.dataset.step);
      item.dataset.status = state.steps[n];
    });
    const done = Object.values(state.steps).filter(s => s === 'done').length;
    const cnt = $('#sidebar-done-count');
    if (cnt) cnt.textContent = done;

    const onlineGroup = $('#sidebar-online-group');
    if (onlineGroup) {
      const setupDone = [1, 2, 3, 4].every(n => state.steps[n] === 'done');
      onlineGroup.classList.toggle('locked', !setupDone);
    }
  }

  /* ---------- 4. 更新全局进度 ---------- */
  function updateProgress() {
    const done = Object.values(state.steps).filter(s => s === 'done').length;
    const pct = (done / 9) * 100;
    const fill = $('#global-progress-fill');
    const counter = $('#global-cur-step');
    const text = $('#global-progress-text');
    if (fill) fill.style.width = pct + '%';
    if (counter) counter.textContent = done;
    if (text) {
      if (done === 0) text.textContent = '📦 准备就绪 · 从构建期 ① 开始装配你的第一个 Agent';
      else if (done < 4) text.textContent = `🛠️ 构建期装配中 · 已完成 ${done}/4 步`;
      else if (done === 4) text.textContent = '🎉 构建期完成！正在解锁运行期...';
      else if (done < 9) text.textContent = `🔁 Agent 运行中 · 已完成 ${done - 4}/5 步`;
      else text.textContent = '🏆 全部 9 步完成 · Agent 已交付并生成 Trace！';
    }
    const setupDone = [1, 2, 3, 4].filter(n => state.steps[n] === 'done').length;
    const runDone = [5, 6, 7, 8, 9].filter(n => state.steps[n] === 'done').length;
    const oP = $('#offline-progress'); if (oP) oP.textContent = setupDone;
    const nP = $('#online-progress'); if (nP) nP.textContent = runDone;
  }

  /* ---------- 5. 完成步骤 ---------- */
  function completeStep(stepNum) {
    if (state.steps[stepNum] !== 'active') return;

    renderOutput(stepNum);

    state.steps[stepNum] = 'done';
    const c = card(stepNum);
    c.classList.remove('active');
    c.classList.add('done');
    c.dataset.status = 'done';
    const badge = $('.step-state-badge', c);
    if (badge) {
      badge.className = 'step-state-badge state-done';
      badge.textContent = '✅ 已完成';
    }

    if (stepNum < 4) {
      unlockStep(stepNum + 1);
    } else if (stepNum === 4) {
      unlockOnlineStage();
    } else if (stepNum < 9) {
      unlockStep(stepNum + 1);
    }
    syncSidebar();
    updateProgress();

    setTimeout(() => {
      const target = stepNum < 9 ? card(stepNum + 1) : c;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  function unlockStep(stepNum) {
    if (state.steps[stepNum] !== 'locked') return;
    state.steps[stepNum] = 'active';
    const c = card(stepNum);
    c.classList.remove('locked');
    c.classList.add('active');
    c.dataset.status = 'active';
    const badge = $('.step-state-badge', c);
    if (badge) {
      badge.className = 'step-state-badge state-active';
      badge.textContent = '⏳ 待操作';
    }
  }

  function unlockOnlineStage() {
    const stage = $('#online-stage');
    if (stage) {
      stage.classList.remove('locked');
      stage.classList.add('unlocked');
    }
    const hint = $('#online-locked-hint');
    if (hint) hint.textContent = '✅ 运行期已解锁';
    unlockStep(5);
  }

  /* ---------- 6. 输出渲染 ---------- */
  function renderOutput(stepNum) {
    const c = card(stepNum);
    const output = $('.step-output', c);
    if (!output) return;

    switch (stepNum) {
      case 1: renderOutput1(output); break;
      case 2: renderOutput2(output); break;
      case 3: renderOutput3(output); break;
      case 4: renderOutput4(output); break;
      case 5: renderOutput5(output); break;
      case 6: renderOutput6(output); break;
      case 7: renderOutput7(output); break;
      case 8: renderOutput8(output); break;
      case 9: renderOutput9(output); break;
    }
    output.hidden = false;
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ① 角色与目标
  function renderOutput1(output) {
    const p = PERSONA[state.config.persona];
    const toneText = { concise: '简洁直接', stepwise: '分步说明', expert: '专家口吻' }[state.config.tone];
    const sysPrompt = `# 角色
你是「${p.name}」，一名${p.role}。

# 目标
${state.config.goal}

# 能力
你可以调用工具获取实时数据。需要事实时先查证，不要凭记忆编造。

# 工作方式
- 收到任务先拆解成可执行的步骤，再动手
- 每完成一步，判断是否已达成目标
- 交互风格：${toneText}

# 边界
- 不承诺无法验证的结论
- 涉及写操作必须先获得确认`;

    output.innerHTML = `
      <div class="output-title">📤 生成的 System Prompt</div>
      <pre><code>${esc(sysPrompt)}</code></pre>
      <pre class="output-summary"><code>📊 角色：${p.name} · 风格：${p.style}
   目标字数：${state.config.goal.length} 字
   提示词版本：v1（建议 A/B 测试后固化）</code></pre>`;
  }

  // ② 注册工具
  function renderOutput2(output) {
    const tools = Array.from(state.config.tools);
    const detail = state.config.schemaDetail === 'full';
    const schemas = tools.map(t => {
      const info = TOOL_NAME[t];
      const desc = detail ? TOOL_DESC[t] : info.cn;
      return `{
  "type": "function",
  "function": {
    "name": "${info.fn}",
    "description": "${desc}",
    "parameters": {
      "type": "object",
      "properties": { ${detail ? info.arg + ', ' : ''}"..." : {...} },
      "required": [...]
    }
  }
}`;
    }).join('\n,\n');

    output.innerHTML = `
      <div class="output-title">📤 工具注册表（${tools.length} 个工具）</div>
      <pre><code>[${schemas}]</code></pre>
      <pre class="output-summary"><code>📊 已注册：${tools.map(t => TOOL_NAME[t].cn).join(' / ')}
   描述详尽度：${detail ? '详尽（带示例 + 约束）' : '最简（仅类型）'}
   ⚠️ 含危险工具：${state.config.tools.has('write') ? '是（写操作需人工确认）' : '否'}</code></pre>`;
  }

  // ③ 挂载记忆
  function renderOutput3(output) {
    const mems = Array.from(state.config.memories);
    output.innerHTML = `
      <div class="output-title">📤 记忆结构</div>
      <div class="chunk-list">
        ${mems.map(m => `
          <div class="chunk-item">
            <span class="chunk-meta">${MEMORY_NAME[m]}</span>
            ${MEMORY_DETAIL[m]}
          </div>
        `).join('')}
      </div>
      <pre class="output-summary"><code>📊 已挂载 ${mems.length} 类记忆 · 注入预算 ${state.config.memoryBudget}K tokens
   短期缓冲：最近 10 轮对话（约 3K）
   长期召回：Top3 历史片段（约 2K）
   工作记忆：仅当前任务可见，不计入最终上下文
   💡 超出预算时按「时间新旧 + 相关度」双维度淘汰</code></pre>`;
  }

  // ④ 规划与护栏
  function renderOutput4(output) {
    output.innerHTML = `
      <div class="output-title">🎉 Agent 装配完成</div>
      <pre><code># Agent 配置摘要
role:        ${PERSONA[state.config.persona].name}
goal:        ${state.config.goal.slice(0, 30)}...
tools:       ${Array.from(state.config.tools).length} 个已注册
memory:      ${Array.from(state.config.memories).length} 类记忆
planning:    ${PLANNING_NAME[state.config.planning]}
max_steps:   ${state.config.maxSteps}          # 刹车：超过即强制停止
hitl:        ${HITL_NAME[state.config.hitl]}
trace:       enabled                  # 全链路记录已开启</code></pre>
      <div class="offline-success">🎉 构建期完成！运行期 ⑤-⑨ 已解锁，Agent 可以开始接活了</div>`;
  }

  // ⑤ 接收任务
  function renderOutput5(output) {
    const task = state.config.task;
    output.innerHTML = `
      <div class="output-title">📤 任务解析结果</div>
      <pre><code>原始输入：
「${task}」

──────────────────────────────
🎯 意图识别：${/故障|报错|502|线上|排障/.test(task) ? '故障诊断与修复' : /数据|销售|报表|转化/.test(task) ? '数据分析与归因' : /周报|工单|进展/.test(task) ? '信息汇总与汇报' : '信息查询与整理'}

📌 抽取实体：
   - 对象：订单服务 / 线上环境
   - 时间：今天 14:00 起
   - 现象：大量 502
   - 期望产出：根因 + 修复方案

⚠️ 约束条件：
   - 不能影响线上在跑的流量
   - 所有结论必须基于日志/监控事实
   - 涉及重启等写操作需人工确认

✅ 目标转译：
   在 max_steps=${state.config.maxSteps} 内定位根因，输出可执行的修复方案</code></pre>`;
  }

  // ⑥ 思考规划
  function renderOutput6(output) {
    const todoOn = state.config.flags.has('todo');
    const critiqueOn = state.config.flags.has('critique');
    output.innerHTML = `
      <div class="output-title">📤 第一轮思考（Thought）</div>
      <pre><code>🤔 Thought：
用户说的是「14:00 开始大量 502」。502 是网关侧错误，说明上游服务不健康。
需要先确认三件事：
  1. 是所有接口都 502，还是特定接口？→ 缩小范围
  2. 14:00 前后有什么变更？→ 找触发点
  3. 服务实例是否存活、资源是否打满？→ 看现场

${todoOn ? `📝 输出 TODO 列表（${state.config.planning === 'react' ? 'ReAct：边做边修正' : 'Plan-and-Execute：先定后做'}）：
   [ ] 1. 拉取订单服务最近 30 分钟错误日志，统计错误分布
   [ ] 2. 查最近 2 小时变更记录（发布 / 配置 / 扩缩容）
   [ ] 3. 检查实例健康度与资源水位（CPU / 内存 / 连接数）
   [ ] 4. 交叉验证：确认根因假设
   [ ] 5. 生成故障报告并给出修复建议` : '📝 未输出 TODO（隐式规划）'}

${critiqueOn ? `🤔 自我质疑：
- 「变更记录」可能查不到权限，需要备用方案
- 如果日志量太大（10 万行），必须先聚合再分析，不能原样读
→ 调整：第 1 步改为「先聚合统计，再抽样看细节」` : ''}

🎬 决策：执行第 1 步 —— 调用日志读取工具</code></pre>`;
  }

  // ⑦ 调用工具
  function renderOutput7(output) {
    const tools = Array.from(state.config.tools);
    const primary = tools.find(t => ['file', 'sql', 'search', 'http'].includes(t)) || tools[0] || 'file';
    const info = TOOL_NAME[primary];
    const execText = state.config.execMode === 'parallel' ? '（本轮并行发起 2 个调用）' : '';

    output.innerHTML = `
      <div class="output-title">📤 工具调用（Action）</div>
      <pre><code>🔧 Action: ${info.fn} ${execText}
{
  "tool": "${info.fn}",
  "arguments": {
    ${info.arg}
  },
  "idempotency_key": "incident-20260914-step1",   // 幂等键，重试不会重复执行
  "timeout_ms": 5000
}

──────────────────────────────
执行器处理链路：
  1. 参数 Schema 校验 ✓
  2. 权限校验（${info.cn} 已授权 ✓）
  3. 实际调用（模拟耗时 180ms）
  4. 结果裁剪（超 2K 自动摘要）

执行模式：${EXEC_NAME[state.config.execMode]}
容错策略：${RETRY_NAME[state.config.toolRetry]}${state.config.toolRetry === 'retry' ? '（最多 2 次，指数退避）' : ''}</code></pre>`;
  }

  // ⑧ 观察结果
  function renderOutput8(output) {
    output.innerHTML = `
      <div class="output-title">📤 观察结果（Observation）</div>
      <pre><code>👁 Observation（工具返回，已按策略处理）：
──────────────────────────────
订单服务 order-service 最近 30 分钟日志统计：
  总请求       182,430
  502 错误     12,847   （错误率 7.0%）
  最早出现     14:02:11
  涉及实例     3 个中的 2 个（pod-7f8c / pod-9d2a 正常，pod-3e1b 无响应）

错误堆栈聚类（Top3）：
  [68%] java.lang.OutOfMemoryError: Java heap space
  [21%] upstream connect timeout (5000ms)
  [11%] connection reset by peer

──────────────────────────────
🔄 异常分支演示（如果工具报错）：
  工具返回：403 Forbidden - 无变更记录查询权限
  → 处理策略：${ERR_NAME[state.config.errorPolicy]}
  → Agent 反应：不中断任务，改用备用路径（从 CI/CD 平台日志反推变更）

📉 处理策略：${OBS_NAME[state.config.obs]}
   原始 12,847 行日志 → 压缩为 6 行结构化摘要，token 从 48K 降到 0.3K</code></pre>`;
  }

  // ⑨ 收敛交付
  function renderOutput9(output) {
    const task = state.config.task;
    const toolsUsed = Array.from(state.config.tools).slice(0, 3).map(t => TOOL_NAME[t].fn);
    while (toolsUsed.length < 3) toolsUsed.push('web_search');

    const showTrace = state.config.outputFormat === 'both';
    const showSummary = state.config.outputFormat !== 'raw';

    const answer = buildAnswer(task);

    const traceHtml = showTrace ? `
      <div class="output-title" style="margin-top:20px">🧾 完整执行轨迹（Trace）· 3 轮循环</div>
      <div class="trace-list">
        <div class="trace-item">
          <div class="trace-round">Loop 1</div>
          <div class="trace-line"><span class="trace-tag thought">Thought</span> 14:00 起大量 502，先看错误分布确定范围</div>
          <div class="trace-line"><span class="trace-tag action">Action</span> ${toolsUsed[0]}(order-service, 30min)</div>
          <div class="trace-line"><span class="trace-tag obs">Observation</span> 12,847 次 502，68% 是 OOM，集中在 pod-3e1b</div>
        </div>
        <div class="trace-item">
          <div class="trace-round">Loop 2</div>
          <div class="trace-line"><span class="trace-tag thought">Thought</span> OOM 说明内存不够。是流量涨了，还是内存泄漏？查变更与流量</div>
          <div class="trace-line"><span class="trace-tag action">Action</span> ${toolsUsed[1]}(SELECT * FROM deploy_history WHERE ts > ...)</div>
          <div class="trace-line"><span class="trace-tag obs">Observation</span> 13:50 有一次发布 v2.31.0，改动包含「订单缓存全量加载」</div>
        </div>
        <div class="trace-item">
          <div class="trace-round">Loop 3</div>
          <div class="trace-line"><span class="trace-tag thought">Thought</span> 高度怀疑是缓存全量加载导致堆内存暴涨。验证内存曲线后给结论</div>
          <div class="trace-line"><span class="trace-tag action">Action</span> ${toolsUsed[2]}(pod-3e1b heap_usage)</div>
          <div class="trace-line"><span class="trace-tag obs">Observation</span> 堆内存 13:52 起从 1.2G 线性涨到 3.8G 后崩溃，与发布时间吻合</div>
          <div class="trace-line"><span class="trace-tag answer">Answer</span> 根因确认，输出报告</div>
        </div>
      </div>` : '';

    const summaryHtml = showSummary ? `
      <div class="completion-banner">
        🎊 <strong>Agent 执行完成</strong><br>
        循环轮数：<strong>3</strong> · 工具调用：<strong>3</strong> 次 · 总耗时：<strong>8.4s</strong> · 成本：<strong>¥0.42</strong><br>
        规划范式：${PLANNING_NAME[state.config.planning]} · 推理深度：${THINK_NAME[state.config.thinking]}<br>
        终止原因：${TERM_NAME[state.config.terminate]}${state.config.hitl === 'risky' ? '<br>⚠️ 修复动作「重启服务」已暂停，等待人工确认' : ''}
      </div>` : '';

    output.innerHTML = `
      <div class="output-title">🎉 最终交付</div>
      <div class="final-answer">
        <div class="answer-q">❓ 任务：<span class="user-q-final">${esc(task)}</span></div>
        <div class="answer-a">${answer}</div>
        <div class="answer-citations">
          <span class="citation-chip">🧾 Trace #incident-20260914</span>
          <span class="citation-chip">📄 故障报告-20260914.md</span>
          <span class="citation-chip">🔁 3 轮循环 · 3 次工具调用</span>
        </div>
      </div>
      ${traceHtml}
      ${summaryHtml}`;
  }

  /* ---------- 6b. 按任务生成最终答案 ---------- */
  function buildAnswer(task) {
    if (/502|故障|报错|线上|服务|排障/.test(task)) {
      return `<strong>🔍 根因定位</strong><br>
14:02 起订单服务大量 502，直接原因是 <strong>pod-3e1b 实例堆内存溢出（OOM）</strong>，占全部错误的 68%。<br><br>
<strong>📌 触发链路</strong><br>
13:50 发布 <code>v2.31.0</code> → 新增「订单缓存全量加载」逻辑 → 堆内存从 1.2G 线性上涨至 3.8G → 14:02 触发 OOM 崩溃 → 网关侧返回 502。<br><br>
<strong>🛠️ 修复方案</strong><br>
1. <strong>立即止血</strong>：将订单服务回滚至 <code>v2.30.4</code>，或临时扩容堆内存至 6G <span style="color:var(--text-3)">（需人工确认，已暂停）</span><br>
2. <strong>根因修复</strong>：把缓存加载改为分页懒加载 + 设置 LRU 上限，避免全量驻留堆内存<br>
3. <strong>防复发</strong>：给订单服务加堆内存 80% 水位告警；发布流程增加「大对象加载」检查项<br><br>
<strong>📎 影响面</strong><br>
影响时段 14:02–14:41，订单失败量约 12,847 单，建议对失败订单发起补偿任务。`;
    }
    if (/数据|销售|报表|转化|渠道/.test(task)) {
      return `<strong>📊 核心结论</strong><br>
上月整体转化率 <strong>2.31%</strong>，环比下滑 <strong>-0.42pct</strong>。下滑集中在三个渠道：<br><br>
<strong>🔻 下滑最严重的三个渠道</strong><br>
1. <strong>信息流 A 渠道</strong>：转化率 1.82%（环比 -0.91pct）—— 流量质量下降，落地页跳出率升至 76%<br>
2. <strong>应用商店 B 渠道</strong>：转化率 2.05%（环比 -0.63pct）—— 上架版本与活动页不一致，存在转化断点<br>
3. <strong>私域 C 渠道</strong>：转化率 3.10%（环比 -0.38pct）—— 触达频次过高，用户疲劳<br><br>
<strong>🛠️ 建议动作</strong><br>
· A 渠道：暂停低质定向包，预算向高转化人群倾斜<br>
· B 渠道：修复活动页版本不一致问题（预估可回收 0.4pct）<br>
· C 渠道：触达频次从 3 次/周降到 1 次/周，改推高价值内容`;
    }
    if (/工单|周报|进展|汇总/.test(task)) {
      return `<strong>📋 本周工单进展汇总</strong><br>
共 <strong>23</strong> 个工单，其中 P0 级 <strong>4</strong> 个：<br><br>
<strong>✅ 已解决（3）</strong><br>
· #4821 支付回调超时 —— 已修复网关超时配置<br>
· #4833 用户登录态丢失 —— 已回滚鉴权改动<br>
· #4847 报表导出乱码 —— 已统一编码为 UTF-8<br><br>
<strong>🔄 进行中（1）</strong><br>
· #4852 订单服务 502 频发 —— 已定位根因（缓存全量加载导致 OOM），待发布修复版本<br><br>
<strong>⚠️ 风险提示</strong><br>
#4852 若本周内未修复，预计每日影响约 3,000 单，建议优先级提到最高。`;
    }
    return `<strong>📌 结论概述</strong><br>
已完成任务拆解与信息收集，共执行 3 轮循环、3 次工具调用。<br><br>
<strong>关键发现</strong><br>
· 收集到有效信息 N 条，交叉验证后保留高置信结论<br>
· 过程中遇到 1 次工具报错，已通过换用备用路径解决<br><br>
<strong>建议下一步</strong><br>
补充业务侧确认后即可产出最终交付物。`;
  }

  /* ---------- 7. 交互绑定 ---------- */
  function bindSingleChoice(action, key, cast) {
    const btns = $$(`.opt-btn[data-action="${action}"]`);
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.config[key] = cast ? cast(btn.dataset.value) : btn.dataset.value;
      });
    });
  }

  function bindAll() {
    // 完成按钮
    $$('.step-complete-btn').forEach(btn => {
      btn.addEventListener('click', () => completeStep(parseInt(btn.dataset.step)));
    });

    // ① 角色
    $$('input[name="persona"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.persona = radio.value;
      });
    });
    // ① 目标
    const goalTA = $('#agent-goal');
    if (goalTA) goalTA.addEventListener('input', () => { state.config.goal = goalTA.value.trim(); });
    // ① 语气
    bindSingleChoice('tone', 'tone');

    // ② 工具
    $$('.toggle-item input[data-tool]').forEach(cb => {
      cb.addEventListener('change', () => {
        const v = cb.dataset.tool;
        if (cb.checked) state.config.tools.add(v); else state.config.tools.delete(v);
      });
    });
    bindSingleChoice('schema', 'schemaDetail');

    // ③ 记忆
    $$('.toggle-item input[data-memory]').forEach(cb => {
      cb.addEventListener('change', () => {
        const v = cb.dataset.memory;
        if (cb.checked) state.config.memories.add(v); else state.config.memories.delete(v);
      });
    });
    const memSlider = $('#memory-slider');
    const memVal = $('#memory-val');
    if (memSlider) {
      memSlider.addEventListener('input', () => {
        memVal.textContent = memSlider.value;
        state.config.memoryBudget = parseInt(memSlider.value);
      });
    }

    // ④ 规划 / 步数 / 护栏
    bindSingleChoice('planning', 'planning');
    const msSlider = $('#maxstep-slider');
    const msVal = $('#maxstep-val');
    if (msSlider) {
      msSlider.addEventListener('input', () => {
        msVal.textContent = msSlider.value;
        state.config.maxSteps = parseInt(msSlider.value);
      });
    }
    bindSingleChoice('hitl', 'hitl');

    // ⑤ 任务输入
    const taskTA = $('#agent-task');
    if (taskTA) taskTA.addEventListener('input', () => { state.config.task = taskTA.value.trim(); });
    $$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.task;
        if (taskTA) taskTA.value = t;
        state.config.task = t;
      });
    });

    // ⑥ 推理深度 / 开关
    bindSingleChoice('thinking', 'thinking');
    $$('.toggle-item input[data-flag]').forEach(cb => {
      cb.addEventListener('change', () => {
        const v = cb.dataset.flag;
        if (cb.checked) state.config.flags.add(v); else state.config.flags.delete(v);
      });
    });

    // ⑦ 执行模式 / 容错
    bindSingleChoice('exec-mode', 'execMode');
    bindSingleChoice('tool-retry', 'toolRetry');

    // ⑧ 观察 / 错误策略
    bindSingleChoice('obs', 'obs');
    bindSingleChoice('error-policy', 'errorPolicy');

    // ⑨ 终止 / 输出格式
    bindSingleChoice('terminate', 'terminate');
    bindSingleChoice('output-format', 'outputFormat');

    // 全部重置
    const resetBtn = $('#reset-all-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(n => state.steps[n] = 'locked');
        state.steps[1] = 'active';
        const stage = $('#online-stage');
        if (stage) { stage.classList.add('locked'); stage.classList.remove('unlocked'); }
        const hint = $('#online-locked-hint');
        if (hint) hint.textContent = '🔒 需先完成构建期 4 步';
        initState();
        card(1).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // 一键自动配置
    const autoBtn = $('#auto-fill-btn');
    if (autoBtn) autoBtn.addEventListener('click', () => autoFillAll());
  }

  /* ---------- 7b. 左侧导航交互 ---------- */
  function bindSidebar() {
    $$('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const stepNum = parseInt(item.dataset.step);
        if (state.steps[stepNum] === 'locked') return;
        const target = card(stepNum);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateViewingHighlight(); ticking = false; });
    }, { passive: true });

    setTimeout(updateViewingHighlight, 200);
  }

  function updateViewingHighlight() {
    const cards = $$('.step-card');
    if (!cards.length) return;
    const viewportCenter = window.innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    cards.forEach(c => {
      const rect = c.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < bestDist) { bestDist = dist; best = c; }
    });
    if (!best) return;
    const n = parseInt(best.dataset.step);
    $$('.sidebar-item').forEach(item => {
      item.classList.toggle('viewing', parseInt(item.dataset.step) === n);
    });
  }

  /* ---------- 8. 一键自动配置 ---------- */
  function autoFillAll() {
    let delay = 0;
    for (let step = 1; step <= 9; step++) {
      setTimeout(() => {
        if (state.steps[step] === 'locked') {
          if (step === 5) unlockOnlineStage();
          else unlockStep(step);
        }
        completeStep(step);
      }, delay);
      delay += 800;
    }
  }

  /* ---------- 9. 启动 ---------- */
  function init() {
    initState();
    bindAll();
    bindSidebar();
    updateProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
   站点切换下拉 + 进入页面默认定位到「全链路」模块
   （agent-explainer ⇄ rag-explainer 双向互通，两边共用同一份实现）
   ========================================================================== */
(function () {
  'use strict';

  var FLOW_ID = 'flow';
  var NAV_OFFSET = 84; // 吸顶导航高度补偿

  /* ---------- 1. 进入页面时默认落在「全链路」 ---------- */
  (function defaultToFlow() {
    var hash = location.hash;
    var isFlow = hash === '#' + FLOW_ID;
    // 无锚点 → 默认跳到全链路；已带 #flow（从另一站跳来）→ 加载后校正位置
    if (hash !== '' && !isFlow) return;

    var flow = document.getElementById(FLOW_ID);
    if (!flow) return;

    function align() {
      var root = document.documentElement;
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto'; // 禁用平滑滚动，避免加载时从上往下滚一遍

      if (hash === '') {
        try {
          history.replaceState(null, '', location.pathname + location.search + '#' + FLOW_ID);
        } catch (err) { /* file:// 下可能被拒绝，忽略 */ }
      }

      var top = flow.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;
      window.scrollTo(0, top > 0 ? top : 0);
      root.style.scrollBehavior = prev;
    }

    if (document.readyState === 'complete') align();
    else window.addEventListener('load', align);
  })();

  /* ---------- 2. 左上角站点切换 ---------- */
  var SITES = {
    rag:   { port: 8765, dir: '../rag-explainer/' },
    agent: { port: 8766, dir: '../agent-explainer/' }
  };

  function goSite(key) {
    var site = SITES[key];
    if (!site) return;

    // 只有「本地开发服务器」（localhost / 127.0.0.1 且带显式端口）才换端口跳转。
    // file:// 直开、以及线上托管（GitHub Pages / 自定义域名）统一走相对目录 ——
    // 否则线上会被拼成 host:8765 这种不存在的地址。
    var isLocalDevServer = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname) && !!location.port;
    if (location.protocol === 'file:' || !isLocalDevServer) {
      location.href = site.dir + 'index.html#' + FLOW_ID;
      return;
    }
    location.href = location.protocol + '//' + location.hostname + ':' + site.port + '/index.html#' + FLOW_ID;
  }

  var sw = document.getElementById('site-switch');
  if (!sw) return;

  function closeMenu() {
    sw.classList.remove('open');
    sw.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    var open = !sw.classList.contains('open');
    sw.classList.toggle('open', open);
    sw.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  sw.addEventListener('click', function (e) {
    e.stopPropagation(); // 避免立刻被 document 的关闭逻辑收掉
    toggleMenu();
  });

  sw.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggleMenu();
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  });

  Array.prototype.forEach.call(sw.querySelectorAll('[data-goto]'), function (item) {
    function activate(e) {
      e.preventDefault();
      e.stopPropagation();
      if (item.classList.contains('is-current')) { closeMenu(); return; }
      goSite(item.getAttribute('data-goto'));
    }
    item.addEventListener('click', activate);
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') activate(e);
    });
  });

  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
})();
