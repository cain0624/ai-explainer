/* ================================================================
   RAG 教学网站 · 状态机 + 交互逻辑
   - 9 步逐步解锁（5 离线 + 4 在线）
   - 离线完成后在线阶段才解锁
   - 每个步骤有真实的用户操作（开关/滑块/选择器）
   ================================================================ */

(function () {
  'use strict';

  /* ---------- 1. 状态机 ---------- */
  const state = {
    steps: {
      1: 'active', 2: 'locked', 3: 'locked', 4: 'locked', 5: 'locked',
      6: 'locked', 7: 'locked', 8: 'locked', 9: 'locked'
    },
    config: {
      // 离线
      fileTypes: new Set(['pdf', 'docx']),
      files: new Set(['产品手册 v3.2.pdf', '内部 SOP 2024Q4.docx', '政策汇编 2026.pdf', '工单 FAQ 库.md']),
      cleaningRules: new Set(['html', 'url', 'whitespace', 'special']),
      chunkStrategy: 'recursive',
      chunkSize: 500,
      chunkOverlap: 50,
      embeddingModel: 'm3e',
      vectorDb: 'milvus',
      metaFields: new Set(['filename', 'page', 'category']),
      // 在线
      userQuery: '公司年假是怎么规定的？',
      rewriteMode: 'none',
      topK: 5,
      threshold: 0.7,
      retrievalStrategy: 'vector',
      promptTemplate: 'basic',
      llmModel: 'gpt-4',
      temperature: 0.3
    }
  };

  const EMBEDDING_DIM = { bge: 1024, m3e: 768, openai: 1536, cohere: 1024 };
  const EMBEDDING_NAME = {
    bge: 'BGE-large-zh-v1.5', m3e: 'M3E-base',
    openai: 'OpenAI text-embedding-3', cohere: 'Cohere embed-multilingual'
  };
  const DB_NAME = { milvus: 'Milvus', chroma: 'Chroma', qdrant: 'Qdrant', pgvector: 'PGVector' };
  const LLM_NAME = { 'gpt-4': 'GPT-4o', claude: 'Claude 3.5', qwen: '通义千问', deepseek: 'DeepSeek-V3' };
  const RETRIEVE_NAME = { vector: '向量检索', bm25: '关键词检索', hybrid: '混合检索' };

  /* ---------- 2. DOM 工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const card = (step) => $(`.step-card[data-step="${step}"]`);

  /* ---------- 3. 初始化步骤卡片状态 ---------- */
  function initState() {
    // 重置所有 step 到默认状态
    Object.keys(state.steps).forEach(n => {
      const c = card(n);
      if (!c) return;
      c.dataset.status = state.steps[n];
      c.classList.remove('active', 'done', 'locked');
      if (state.steps[n] === 'active') c.classList.add('active');
      if (state.steps[n] === 'done') c.classList.add('done');
      if (state.steps[n] === 'locked') c.classList.add('locked');
      // 输出区默认收起
      const output = $('.step-output', c);
      if (output) output.hidden = true;
      // 状态徽章
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
    // 更新每个导航项状态
    $$('.sidebar-item').forEach(item => {
      const n = parseInt(item.dataset.step);
      const status = state.steps[n];
      item.dataset.status = status;
    });
    // 已完成计数
    const done = Object.values(state.steps).filter(s => s === 'done').length;
    const cnt = $('#sidebar-done-count');
    if (cnt) cnt.textContent = done;
    // 在线分组锁状态
    const onlineGroup = $('#sidebar-online-group');
    if (onlineGroup) {
      const offlineDone = [1, 2, 3, 4, 5].every(n => state.steps[n] === 'done');
      onlineGroup.classList.toggle('locked', !offlineDone);
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
      if (done === 0) text.textContent = '📦 准备就绪 · 从离线 ① 开始你的第一次 RAG 构建';
      else if (done < 5) text.textContent = `🛠️ 离线构建中 · 已完成 ${done}/5 步`;
      else if (done === 5) text.textContent = '🎉 离线构建完成！正在解锁在线问答阶段...';
      else if (done < 9) text.textContent = `💬 在线问答中 · 已完成 ${done - 5}/4 步`;
      else text.textContent = '🏆 全部 9 步完成 · RAG 系统已就绪！';
    }
    // 阶段进度
    const offlineDone = [1, 2, 3, 4, 5].filter(n => state.steps[n] === 'done').length;
    const onlineDone = [6, 7, 8, 9].filter(n => state.steps[n] === 'done').length;
    const oP = $('#offline-progress'); if (oP) oP.textContent = offlineDone;
    const nP = $('#online-progress'); if (nP) nP.textContent = onlineDone;
  }

  /* ---------- 5. 完成步骤 ---------- */
  function completeStep(stepNum) {
    if (state.steps[stepNum] !== 'active') return;

    // 渲染输出
    renderOutput(stepNum);

    // 更新状态
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

    // 解锁下一步
    if (stepNum < 5) {
      unlockStep(stepNum + 1);
    } else if (stepNum === 5) {
      unlockOnlineStage();
    } else if (stepNum < 9) {
      unlockStep(stepNum + 1);
    } else {
      $('#global-progress-text').textContent = '🏆 全部 9 步完成 · RAG 系统已就绪！';
    }
    syncSidebar();
    updateProgress();

    // 滚动到下一步
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
    stage.classList.remove('locked');
    stage.classList.add('unlocked');
    $('#online-locked-hint').textContent = '✅ 在线阶段已解锁';
    unlockStep(6);
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

  // ① 数据加载
  function renderOutput1(output) {
    const fileCount = state.config.files.size;
    output.innerHTML = `
      <div class="output-title">📤 加载结果</div>
      <pre><code>✅ 已加载 ${fileCount} 个文件
   总字符数：${(fileCount * 20585).toLocaleString()} 字
   总大小：${(fileCount * 1.27).toFixed(1)}MB

📊 文件类型分布：
${Array.from(state.config.fileTypes).map(t => '   ' + ({pdf: 'PDF', docx: 'Word', md: 'MD', txt: 'TXT', html: 'HTML'}[t]) + ' 类型已启用').join('\n')}

📁 已加载文件：
${Array.from(state.config.files).map(f => '   • ' + f).join('\n')}</code></pre>`;
  }

  // ② 清洗
  function renderOutput2(output) {
    output.innerHTML = `
      <div class="output-title">📤 清洗前后对比</div>
      <div class="clean-diff">
        <div class="clean-before">
          <div class="diff-label">❌ 清洗前</div>
          <pre><code>产品手册 v3.2

&lt;div&gt;第一章  &lt;/div&gt;
&lt;p&gt;介绍&lt;/p&gt;

详见 https://example.com/doc/123
有问题联系：cain@company.com

    多余的    空格   和   换行</code></pre>
        </div>
        <div class="clean-arrow">→</div>
        <div class="clean-after">
          <div class="diff-label">✅ 清洗后</div>
          <pre><code>产品手册 v3.2

第一章

介绍

详见[链接]
有问题联系：[EMAIL]

多余的空格和换行</code></pre>
        </div>
      </div>
      <pre class="output-summary"><code>📊 已启用 ${state.config.cleaningRules.size} 条规则 · 原始 82,341 字 → 清洗后 71,205 字（去噪 13.5%）</code></pre>`;
  }

  // ③ 切片
  function renderOutput3(output) {
    const chunkTotal = Math.floor(71205 / (state.config.chunkSize - state.config.chunkOverlap));
    const sampleChunks = [
      { idx: 1, src: '产品手册 v3.2.pdf', page: 'p.12', text: '年假规定：员工每年享有 10 个工作日的带薪年假，工作满 5 年增加至 15 天。' },
      { idx: 2, src: '内部 SOP 2024Q4.docx', page: 'p.3', text: '年假申请流程：登录 OA 系统 → 提交申请 → 直属 leader 审批 → HR 备案。' },
      { idx: 3, src: '政策汇编 2026.pdf', page: 'p.45', text: '法定年假依据《职工带薪年休假条例》，工龄 1-10 年 5 天，10-20 年 10 天。' },
      { idx: 4, src: '工单 FAQ 库.md', page: 'p.8', text: '常见问题：年假可以跨年累计吗？答：不可以，最多延期 1 个月。' },
      { idx: 5, src: '产品手册 v3.2.pdf', page: 'p.13', text: '年假与病假/事假冲抵规则：先休年假，再休其他假期。' }
    ];
    $('#chunk-total-2') && ($('#chunk-total-2').textContent = chunkTotal);
    const chunkPreviewList = $('#chunk-preview-list');
    output.innerHTML = `
      <div class="output-title">📤 切片预览（前 5 片）</div>
      <div class="chunk-list">
        ${sampleChunks.map(c => `
          <div class="chunk-item">
            <span class="chunk-meta">#${c.idx} · ${c.src} · ${c.page}</span>
            ${c.text}
          </div>
        `).join('')}
      </div>
      <pre class="output-summary"><code>📊 切片统计：71,205 字 → ${chunkTotal} 片
   策略：${state.config.chunkStrategy === 'recursive' ? '递归切片' : state.config.chunkStrategy}
   每片大小：${state.config.chunkSize} 字 · 重叠：${state.config.chunkOverlap} 字</code></pre>`;
  }

  // ④ 向量化
  function renderOutput4(output) {
    const model = state.config.embeddingModel;
    const dim = EMBEDDING_DIM[model];
    const name = EMBEDDING_NAME[model];
    output.innerHTML = `
      <div class="output-title">📤 向量化结果</div>
      <pre><code>✅ 已对所有 chunk 完成向量化
   使用模型：${name}
   向量维度：${dim}

🔢 向量示例（chunk #1）：
   [0.023, -0.145, 0.872, 0.031, ..., -0.456]
    ↑ 这 ${dim} 个数字表达了「年假规定」这段文字的语义

💡 关键：必须用相同模型给 Query 也做向量化，才能在统一空间比较</code></pre>`;
  }

  // ⑤ 入库
  function renderOutput5(output) {
    const vecTotal = Math.floor(71205 / (state.config.chunkSize - state.config.chunkOverlap));
    const db = state.config.vectorDb;
    output.innerHTML = `
      <div class="output-title">🎉 离线构建完成</div>
      <pre><code>✅ 知识库已就绪
   数据库：${DB_NAME[db]}
   向量数：${vecTotal}
   索引维度：${EMBEDDING_DIM[state.config.embeddingModel]}
   元数据：${state.config.metaFields.size} 个字段已索引
   构建耗时：模拟 12 秒

🚀 现在可以进入在线问答了！</code></pre>
      <div class="offline-success">🎉 离线构建完成！下一步将解锁在线 ⑥-⑨</div>`;
  }

  // ⑥ Query 向量化
  function renderOutput6(output) {
    const rewriteText = { none: '不改写', expand: '扩展（同义词）', hyde: 'HyDE（假设文档）' }[state.config.rewriteMode];
    output.innerHTML = `
      <div class="output-title">📤 Query 向量化结果</div>
      <pre><code>原始 Query：${state.config.userQuery}
改写模式：${rewriteText}
使用模型：${EMBEDDING_NAME[state.config.embeddingModel]}（与离线 ④ 一致 ✓）

🔢 Query 向量（768 维）：
   [0.142, -0.067, 0.523, 0.891, ..., -0.234]

💡 关键：用相同的 Embedding 模型，Query 与 Chunk 才能在统一空间比较相似度</code></pre>`;
    $$('.user-q-display').forEach(el => el.textContent = state.config.userQuery);
  }

  // ⑦ 检索
  function renderOutput7(output) {
    const retrieves = [
      { rank: 1, src: '产品手册 v3.2.pdf p.12', text: '员工每年享有 10 个工作日的带薪年假', sim: 0.94 },
      { rank: 2, src: '内部 SOP 2024Q4.docx p.3', text: '年假申请流程：OA 提交 → 审批 → 备案', sim: 0.88 },
      { rank: 3, src: '政策汇编 2026.pdf p.45', text: '法定年假：工龄 1-10 年 5 天，10-20 年 10 天', sim: 0.85 },
      { rank: 4, src: '工单 FAQ 库.md p.8', text: '常见问题：年假可以跨年累计吗？最多延期 1 个月', sim: 0.79 },
      { rank: 5, src: '产品手册 v3.2.pdf p.13', text: '年假与病假/事假冲抵规则', sim: 0.72 }
    ];
    output.innerHTML = `
      <div class="output-title">📤 检索结果（Top-${state.config.topK}）</div>
      <div class="retrieve-list">
        ${retrieves.slice(0, state.config.topK).map(r => `
          <div class="retrieve-item">
            <span class="retrieve-rank">${r.rank}</span>
            <span class="retrieve-text"><strong>${r.src}</strong><br>${r.text}</span>
            <span class="retrieve-sim">${r.sim.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <pre class="output-summary"><code>📊 检索耗时：模拟 234ms
   召回：${state.config.topK} 个 chunk
   最高相似度：${retrieves[0].sim.toFixed(2)}
   策略：${RETRIEVE_NAME[state.config.retrievalStrategy]}
   阈值过滤：≥ ${state.config.threshold.toFixed(1)}</code></pre>`;
  }

  // ⑧ 拼 Prompt
  function renderOutput8(output) {
    const templates = {
      basic: `你是助手。基于以下资料回答问题。

资料：
[1] 员工每年享有 10 个工作日的带薪年假
[2] 年假申请流程：OA 提交 → 审批 → 备案
[3] 法定年假：工龄 1-10 年 5 天，10-20 年 10 天

问题：${state.config.userQuery}

回答：`,
      strict: `严格基于以下资料回答，不要编造。若资料不足请说"我不知道"。

资料：
[1] 员工每年享有 10 个工作日的带薪年假
[2] 年假申请流程：OA 提交 → 审批 → 备案
[3] 法定年假：工龄 1-10 年 5 天，10-20 年 10 天

问题：${state.config.userQuery}

回答（请标注引用 [1][2]...）：`,
      friendly: `你是 HR 小助手小爱，用亲切专业的口吻回答员工问题。

资料：
[1] 员工每年享有 10 个工作日的带薪年假
[2] 年假申请流程：OA 提交 → 审批 → 备案
[3] 法定年假：工龄 1-10 年 5 天，10-20 年 10 天

问题：${state.config.userQuery}

回答：`
    };
    const promptPreview = $('#prompt-final');
    if (promptPreview) promptPreview.textContent = templates[state.config.promptTemplate];
    output.innerHTML = `
      <div class="output-title">📤 最终 Prompt 预览</div>
      <pre><code>${templates[state.config.promptTemplate]}</code></pre>`;
  }

  // ⑨ 生成
  function renderOutput9(output) {
    const answerText = `根据公司《员工手册》规定，年假相关规则如下：

**1. 年假天数**
- 基础年假：工作满 1 年的员工，每年享有 <strong>10 个工作日</strong> 的带薪年假 [1]
- 阶梯年假：工作满 5 年增加至 <strong>15 天</strong>，满 10 年增加至 <strong>20 天</strong> [3]

**2. 申请流程**
- 登录 OA 系统 → 提交申请单 → 直属 leader 审批 → HR 备案 [2]

**3. 特别说明**
- 年假<strong>不可跨年累计</strong>，最多延期 1 个月 [4]
- 与病假/事假冲抵时，先休年假 [5]

如有疑问，可联系 HR 部门（分机 8888）或查阅完整《员工手册 v3.2》。`;

    output.innerHTML = `
      <div class="output-title">🎉 最终答案</div>
      <div class="final-answer">
        <div class="answer-q">❓ 问题：<span class="user-q-final">${state.config.userQuery}</span></div>
        <div class="answer-a">${answerText}</div>
        <div class="answer-citations">
          <span class="citation-chip">📄 [1] 产品手册 v3.2.pdf</span>
          <span class="citation-chip">📋 [2] 内部 SOP 2024Q4.docx</span>
          <span class="citation-chip">📊 [3] 政策汇编 2026.pdf</span>
          <span class="citation-chip">🎫 [4] 工单 FAQ 库.md</span>
        </div>
      </div>
      <div class="completion-banner">
        🎊 <strong>完整 RAG 流程演示结束！</strong><br>
        你已经手动走完了 <strong>9 步</strong>：5 步离线构建 + 4 步在线问答。<br>
        模型：${LLM_NAME[state.config.llmModel]} · Temperature：${state.config.temperature} · 引用：[1][2][3][4]
      </div>`;
    $$('.user-q-final').forEach(el => el.textContent = state.config.userQuery);
  }

  /* ---------- 7. 交互绑定 ---------- */
  function bindAll() {
    // 完成按钮
    $$('.step-complete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step);
        completeStep(step);
      });
    });

    // ① 文件类型（多选 toggle）
    $$('.opt-btn[data-action="file-type"]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const v = btn.dataset.value;
        if (state.config.fileTypes.has(v)) state.config.fileTypes.delete(v);
        else state.config.fileTypes.add(v);
      });
    });

    // ① 文件选择
    $$('.file-item input[data-file]').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.closest('.file-item').querySelector('.file-name').textContent;
        if (cb.checked) state.config.files.add(name);
        else state.config.files.delete(name);
      });
    });

    // ② 清洗规则
    $$('.toggle-item input[data-rule]').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.closest('.toggle-item').querySelector('.toggle-name').textContent.trim();
        // 用名称作为 key 简化
        const key = name.replace(/^[^一-龥]+/, '');
        if (cb.checked) state.config.cleaningRules.add(key);
        else state.config.cleaningRules.delete(key);
      });
    });

    // ③ 切片策略（单选）
    $$('.opt-btn[data-action="chunk-strategy"]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.opt-btn[data-action="chunk-strategy"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.config.chunkStrategy = btn.dataset.value;
      });
    });

    // ③ chunk size 滑块
    const csSlider = $('#chunk-size-slider');
    const csVal = $('#chunk-size-val');
    if (csSlider) {
      csSlider.addEventListener('input', () => {
        csVal.textContent = csSlider.value;
        state.config.chunkSize = parseInt(csSlider.value);
      });
    }
    const coSlider = $('#chunk-overlap-slider');
    const coVal = $('#chunk-overlap-val');
    if (coSlider) {
      coSlider.addEventListener('input', () => {
        coVal.textContent = coSlider.value;
        state.config.chunkOverlap = parseInt(coSlider.value);
      });
    }

    // ④ Embedding 模型
    $$('input[name="emb-model"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.embeddingModel = radio.value;
      });
    });

    // ⑤ 向量库
    $$('input[name="vector-db"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.vectorDb = radio.value;
      });
    });

    // ⑤ 元数据
    $$('.meta-chip input[data-meta]').forEach(cb => {
      cb.addEventListener('change', () => {
        const text = cb.closest('.meta-chip').textContent.trim();
        if (cb.checked) state.config.metaFields.add(text);
        else state.config.metaFields.delete(text);
      });
    });

    // ⑥ Query 输入
    const queryTA = $('#user-query-card');
    if (queryTA) {
      queryTA.addEventListener('input', () => {
        state.config.userQuery = queryTA.value.trim();
      });
    }
    $$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        if (queryTA) queryTA.value = q;
        state.config.userQuery = q;
      });
    });

    // ⑥ Query 改写
    $$('input[name="rewrite"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.rewriteMode = radio.value;
      });
    });

    // ⑦ TopK 滑块
    const tkSlider = $('#topk-slider');
    const tkVal = $('#topk-val');
    if (tkSlider) {
      tkSlider.addEventListener('input', () => {
        tkVal.textContent = tkSlider.value;
        state.config.topK = parseInt(tkSlider.value);
      });
    }

    // ⑦ 阈值滑块
    const thSlider = $('#threshold-slider');
    const thVal = $('#threshold-val');
    if (thSlider) {
      thSlider.addEventListener('input', () => {
        const v = (parseInt(thSlider.value) / 100).toFixed(1);
        thVal.textContent = v;
        state.config.threshold = parseFloat(v);
      });
    }

    // ⑦ 检索策略
    $$('.opt-btn[data-action="retrieval"]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.opt-btn[data-action="retrieval"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.config.retrievalStrategy = btn.dataset.value;
      });
    });

    // ⑧ Prompt 模板
    $$('input[name="prompt-tpl"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.promptTemplate = radio.value;
      });
    });

    // ⑨ LLM 选择
    $$('input[name="llm-model"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) state.config.llmModel = radio.value;
      });
    });

    // ⑨ Temperature
    const tempSlider = $('#temp-slider');
    const tempVal = $('#temp-val');
    if (tempSlider) {
      tempSlider.addEventListener('input', () => {
        const v = (parseInt(tempSlider.value) / 100).toFixed(1);
        tempVal.textContent = v;
        state.config.temperature = parseFloat(v);
      });
    }

    // 全部重置
    const resetBtn = $('#reset-all-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // 重置状态
        [1,2,3,4,5,6,7,8,9].forEach(n => state.steps[n] = 'locked');
        state.steps[1] = 'active';
        // 锁住在线阶段
        $('#online-stage').classList.add('locked');
        $('#online-stage').classList.remove('unlocked');
        $('#online-locked-hint').textContent = '🔒 需先完成离线 5 步';
        initState();
        // 滚动到 ①
        card(1).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // 一键自动配置
    const autoBtn = $('#auto-fill-btn');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        autoFillAll();
      });
    }
  }

  /* ---------- 7b. 左侧导航交互（点击跳转 + 滚动跟随高亮）---------- */
  function bindSidebar() {
    // 点击跳转
    $$('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const stepNum = parseInt(item.dataset.step);
        if (state.steps[stepNum] === 'locked') return;
        const target = card(stepNum);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    // 滚动时高亮当前可见步骤
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateViewingHighlight();
        ticking = false;
      });
    }, { passive: true });

    // 初始化一次
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
      // 只考虑在视口内的卡片
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    });
    if (!best) return;
    const n = parseInt(best.dataset.step);
    $$('.sidebar-item').forEach(item => {
      item.classList.toggle('viewing', parseInt(item.dataset.step) === n);
    });
  }

  /* ---------- 8. 一键自动配置（按顺序完成所有）---------- */
  function autoFillAll() {
    let delay = 0;
    for (let step = 1; step <= 9; step++) {
      setTimeout(() => {
        if (state.steps[step] === 'locked') {
          if (step === 6) {
            unlockOnlineStage();
          } else {
            unlockStep(step);
          }
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
    // 让用户能看到 ① 是激活的
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
