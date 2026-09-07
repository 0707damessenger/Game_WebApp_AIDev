# Source Quality Log — 来源质量数据库

> **用途**：跨 session 持久化的来源质量记录。每次执行 Find_Reference 后自动更新。
> **读取时机**：执行 Find_Reference 前必须先读取，优先使用已验证 🟢 的来源。
> **更新规则**：新来源→添加条目；已有来源→更新评分；发现来源有误→降级并备注原因。
> **升级规则**：新来源标注「待验证⬜」，累积 2 次独立验证后升为「已验证🟢」。

---

## 游戏设计参考来源（Type A）

| 来源平台 | 置信度 | 验证次数 | 适用场景 | 已知优势 | 已知局限 | 最后更新 |
|---------|-------|--------|---------|---------|---------|---------|
| **Steam** | 🟢 已验证 | 3+ | 当代游戏评估 | 量化指标客观（评论数/好评率/年份） | 无法访问主机独占游戏；评论数 <500 时波动大需谨慎（P4 单指划击：Super Drift Blade 仅 316 评论） | 2026-05-14 (P4 单指划击: Astro Prospector 2951 评论/93%，Super Drift Blade 316 评论/95%) |
| **Nintendo 官方玩法页 — Splatoon** ([splatoon.nintendo.com/gameplay](https://splatoon.nintendo.com/gameplay/)) | 🟡 待验证 | 1 | 颜色覆盖、领地竞争和公共反馈参考 | 厂商一手玩法说明，领地颜色反馈边界清楚 | 实时团队射击，与回合制卡牌基底不同；不可直接证明本项目平衡 | 2026-09-07 (Project_7 Spellatoon 优化风险评估) |
| **Abrakam 官方页 — Faeria** ([faeria.com](https://www.faeria.com/)) | 🟡 待验证 | 1 | 卡牌与公共棋盘地块交互参考 | 开发商一手来源，适合确认卡牌和地形共同塑造空间策略 | 系统复杂度显著高于本项目，只能局部借鉴 | 2026-09-07 (Project_7 Spellatoon 优化风险评估) |
| **Arcane Wonders 官方页 — Onitama** ([arcanewonders.com/product/onitama](https://www.arcanewonders.com/product/onitama/)) | 🟡 待验证 | 1 | 双人方格棋盘、短回合和卡牌驱动移动参考 | 发行商一手来源，核心结构描述明确 | 手牌公开且移动卡专用，与本项目私有数字牌及行动点不同 | 2026-09-07 (Project_7 Spellatoon 优化风险评估) |
| **Steambase** (steambase.io) | 🟡 待验证 | 1 | Steam 游戏评论数、好评率、在线人数的补充读取 | 聚合 Steam 数据，页面可读性高，适合快速盘点 | 第三方聚合源，关键结论仍需优先回查 Steam 官方页 | 2026-05-13 |
| **SteamSpy API** (steamspy.com/api.php) | 🟢 已验证 | 2 | Steam 游戏市场数据（销量/玩家数/标签）| 免费无需注册；批量查询；Python 库 steamspypi | 高销量严重高估；owners 为范围值；F2P 不准；tag 端点按拥有者数排序（非相关性）| 2026-03-01 |
| **Gamalytic API** (api.gamalytic.com) | 🟡 待验证 | 1 | Steam 深度市场估算（多算法融合）| 77% 误差±30%；含价格历史；覆盖 50K+ 游戏 | 需注册 API Key；免费层限制；F2P 不准 | 2026-03-01 |
| **RftG 规则书 PDF**（规则书提取，BoardGamesRules） | 🟢 已验证 | 2 | 引擎构建机制 / Cards as Currency / Tableau 积累 | D51 DDI Step 2.3 主参考；「卡牌双用途张力」和「Production 产出」结构直接引用 | 2026-03-01 |
| **猫神牧场**（Docs/ReferenceGames/cat_god_ranch.md） | 🟢 已验证 | 2 | 自动演算期待感 / 流派差异化 / 固定底线+随机上浮 | D51 DDI Step 2.3 主参考；「固定基础产出+概率加成」结构参考 | 2026-03-01 |
| **dotAGE**（Docs/ReferenceGames/dotage.md） | 🟢 已验证 | 2 | 城镇建造 / 压力系统 / 资源链 | D51 DDI Step 2.3 参考；中间资源路线 D21 风险验证来源 | 2026-03-01 |
| **BGG** (boardgamegeek.com) | 🟢 已验证 | 2 | 桌游机制参考 | 社区策略讨论质量高；论坛有深度分析 | 需要筛选高评论数帖子 | 2026-03-01 |
| **Metacritic** | 🟡 待验证 | 1 | 跨平台质量对比 | 媒体评分聚合；有用户评分对比 | 媒体评分口径不一；用户刷分现象 | 2026-03-01 |
| **ThinkyGames** (thinkygames.com) | 🟡 待验证 | 1 | 解谜/战术/策略游戏机制描述与可访问性标签 | 面向 thinky games 的垂直站点，适合确认谜题、回退、随机性、难度等体验标签 | 二手编辑描述，关键结论需回查官方/商店页或评测 | 2026-05-13 |
| **游戏媒体评测站**（GGRecon / GodIsAGeek / Basic Tutorials 等） | 🟡 待验证 | 1 | 具体玩法细节、节奏、爽点与缺点的定性补充 | 可补充商店页没有展开的机制体验描述 | 主观性强，需多篇交叉验证，不能单篇作为强结论 | 2026-05-13 |
| **知乎** | 🟡 待验证 | 2 | 中文玩家体验分析 | 中文游戏设计讨论质量相对高 | 需逐篇验证作者资质（认证+粉丝数+赞数） | 2026-03-01 |
| **Bilibili** | 🟡 待验证 | 1 | 中文玩家/设计师分析 | UP主认证+10万粉可信度高 | 娱乐性内容多，需筛选 | 2026-03-01 |
| **Wikipedia (en)** | 🟢 已验证 | 1 | 经典/老牌游戏的历史信息、机制总述、商业数据 | 主流条目含可追溯 reference；横向多源验证 | 当代独立小游戏覆盖差；编辑质量参差 | 2026-05-14 (P4 单指划击: Fruit Ninja) |
| **Halfbrick / 厂商官网** | 🟢 已验证 | 1 | 一手游戏机制与历代版本说明 | 厂商一手；可信度高 | 营销视角，需结合第三方验证手感 | 2026-05-14 (P4 单指划击: Fruit Ninja Classic) |
| **TapTap** (taptap.cn) | 🟢 已验证 | 1 | 中文移动端游戏的官方预约与发行信息 | 中文一手；含官方公告与玩家点评 | 玩家点评聚合，需筛选有效评测 | 2026-05-14 (P4 单指划击: 咖啡星矿工 安卓预约) |
| **indienova** (indienova.com) | 🟢 已验证 | 1 | 中文独立游戏数据库与 PressKit 一手 | 独立游戏社区编辑质量高；PressKit 为开发者一手 | 覆盖主要为中文独立圈，海外游戏覆盖有限 | 2026-05-14 (P4 单指划击: 超级滑刃战士 PressKit) |
| **中文游戏媒体通稿**（游侠网/搞趣网/搜狐游戏频道/3DM 等） | 🟡 待验证 | 1 | 国内新游发售公告、开发背景报道 | 中文渠道首发信息覆盖快 | 多为厂商通稿改写，缺乏独立分析，需横向验证 | 2026-05-14 (P4 单指划击) |
| **Steam 商店页 — Vampire Survivors** (app/1794680) | 🟡 待验证 | 1 | Survivor-like 构筑参考（Evolution 武器演化）| ~250K 评论 / ~98% 好评 / 开山级；机制描述明确 | 武器槽位模式不直接适配主角即刀刃；仅借鉴"达成条件→质变" | 2026-05-15 (P4 构筑方向) |
| **Steam 商店页 — Brotato** (app/1942280) | 🟡 待验证 | 1 | Survivor-like 标签构筑参考（主参考） | ~140K 评论 / ~96% 好评 / 标签系统清晰 / 60+ 角色起手身份 | 标签数量与 P4 流派数量需适配；商店随机 + reroll 机制需简化 | 2026-05-15 (P4 构筑方向，标签制直接套用) |
| **Grokipedia** (grokipedia.com) | 🔴 慎用 | 1 | AI 生成的游戏聚合页 | 信息汇总速度快 | 信源不可追溯；与 Wikipedia 主条目对照存在偏差；不可单独作为论据 | 2026-05-14 (P4 单指划击: Fruit Ninja 条目) |

---

## 方法论参考来源（Type B）

| 来源平台 | 置信度 | 验证次数 | 适用场景 | 已知优势 | 已知局限 | 最后更新 |
|---------|-------|--------|---------|---------|---------|---------|
| **GDC Vault** (gdcvault.com) | 🟢 已验证 | 3+ | 游戏设计方法论（最权威） | 行业演讲；有具体数据/案例；Project_7 使用 Gunhouse 演讲指导小样本试玩验证 | 部分内容需订阅 | 2026-09-07 |
| **Game Developer** (gamedeveloper.com) | 🟢 已验证 | 2 | 从业者设计流程文章 | 专业背景作者；有实操案例 | 文章质量参差 | 2026-03-01 |
| **Anthropic 官方文档** | 🟢 已验证 | 2 | AI 工作流/Agent 设计 | 一手官方来源；直接可信 | 更新频率高，需注意版本 | 2026-03-01 |
| **OpenAI 官方文档** | 🟢 已验证 | 2 | AI Agent 生产级设计 | 官方实践指南；《A Practical Guide to Building Agents》实操性强 | 同上 | 2026-03-01 |
| **Microsoft Azure AI 架构中心** | 🟢 已验证 | 1 | Agent 设计模式 | 企业级设计模式，结构清晰 | 偏工程向，设计层可能不够深入 | 2026-03-01 |
| **ISO 9001 / PECB** ([pecb.com](https://pecb.com/en/article/the-plan-do-check-act-pdca-cycle-a-guide-to-continuous-improvement)) | 🟢 已验证 | 1 | PDCA 持续改进循环（含元流程治理） | 国际标准；可递归应用于元流程本身 | 偏企业/认证向，需调适 | 2026-03-01 |
| **APMG International** ([apmg-international.com](https://apmg-international.com/article/adapt-survive-heavyweight-v-lightweight-management)) | 🟢 已验证 | 1 | 分层治理/右规模化（Heavyweight vs Lightweight） | 行业治理框架；有具体判断标准 | 偏项目管理视角，需调适到 AI 工作流 | 2026-03-01 |
| **GTD Quick Capture** ([facilethings.com](https://facilethings.com/blog/en/the-capture-stage-of-gtd-explained)) | 🟢 已验证 | 1 | 自动捕获不打断主流程 | David Allen 经典方法论；企业广泛采用 | 原版针对个人任务管理，需调适 | 2026-03-01 |
| **Datadog Audit Logging** ([datadoghq.com](https://www.datadoghq.com/knowledge-center/audit-logging/)) | 🟢 已验证 | 1 | 即时审计日志最佳实践 | NIST 标准对齐；实时记录防止决策缺口 | 偏工程/安全向 | 2026-03-01 |
| **Evidence-Based Design** ([Wikipedia](https://en.wikipedia.org/wiki/Evidence-based_design)) | 🟢 已验证 | 1 | 决策前先找文献参考的理论基础 | 同行审查框架；跨设计领域通用 | 学术来源，实操细节需自行提炼 | 2026-03-01 |
| **Workato Automation Triggers** ([workato.com](https://www.workato.com/the-connector/automation-triggers-guide/)) | 🟡 待验证 | 1 | 工作流触发条件可靠性研究 | 实操案例丰富；指出关键词触发的假阳性风险 | SaaS 平台视角，不一定适用 AI 对话场景 | 2026-03-01 |
| **GameDev.net 教程库** | 🟡 待验证 | 1 | 系统设计实践总结 | 实操细节多 | 作者质量不均，需看评论反馈 | 2026-03-01 |
| **McKinsey / HBR** | 🟡 待验证 | 1 | 管理学框架（SMART/OKR等） | 知名机构；管理学理论权威 | 游戏设计应用需自行适配 | 2026-03-01 |
| **学术数据库** (ResearchGate/Google Scholar) | 🟡 待验证 | 1 | 方法论理论根源 | 引用数可验证质量 | 游戏设计相关论文数量有限 | 2026-03-01 |
| **Reddit r/gamedesign** | 🔴 慎用 | 2 | 设计讨论参考 | 社区活跃（273k成员） | 高赞≠准确；需单独验证评论者背景 | 2026-03-01 |

---

## 元规则/Skill 验证来源（Type C）

| 来源平台 | 置信度 | 验证次数 | 适用场景 | 最后更新 |
|---------|-------|--------|---------|---------|
| **Anthropic 官方文档** | 🟢 已验证 | 2 | AI 工作流方法论验证 | 2026-03-01 |
| **SIFT Method** ([nwtc.libguides.com](https://nwtc.libguides.com/evaluating_resources/sift)) | 🟢 已验证 | 1 | 来源置信度判断框架 | 2026-03-01 |
| **CRAAP Test** ([UChicago Library](https://guides.lib.uchicago.edu/c.php?g=1241077&p=9082343)) | 🟢 已验证 | 1 | 多维度来源评估 | 2026-03-01 |
| **Asana SMART Goals** ([asana.com/resources/smart-goals](https://asana.com/resources/smart-goals)) | 🟢 已验证 | 1 | SMART 目标框架验证 | 2026-03-01 |
| **Atlassian SMART Goals** ([atlassian.com/blog](https://www.atlassian.com/blog/productivity/how-to-write-smart-goals)) | 🟢 已验证 | 1 | SMART 目标框架多源验证 | 2026-03-01 |
| **APMG International** | 🟢 已验证 | 1 | 分层治理/右规模化验证（Rule 10 理论基础） | 2026-03-01 |
| **ISO 9001 PDCA** (PECB/Advisera) | 🟢 已验证 | 1 | PDCA 递归应用于元流程治理 | 2026-03-01 |
| **GTD Quick Capture** (FacileThings) | 🟢 已验证 | 1 | Rule 5 自动捕获不打断主线的理论依据 | 2026-03-01 |
| **Evidence-Based Design** (Wikipedia/ResearchGate) | 🟢 已验证 | 1 | Evaluate_Consistency + Find_Reference 的学术基础 | 2026-03-01 |
| **Datadog Audit Logging** | 🟢 已验证 | 1 | Rule 7 即时 changelog 的工程最佳实践验证 | 2026-03-01 |

| **Scrum / Agile Retrospectives** ([scrum-master.org](https://scrum-master.org/en/kaizen-the-powerful-lean-philosophy-for-continuous-improvement-and-agonal-excellence/)) | 🟢 已验证 | 1 | 规则周期性审查的触发节奏（Kaizen 连续改进哲学） | 2026-03-01 |
| **AWS Prescriptive Guidance — AI Prompt Optimization** ([docs.aws.amazon.com](https://docs.aws.amazon.com/prescriptive-guidance/latest/gen-ai-lifecycle-operational-excellence/dev-experimenting-prompt-optimization.html)) | 🟢 已验证 | 1 | AI 指令迭代应有反馈循环 + 版本控制（Review_Meta_Rules 理论依据） | 2026-03-01 |
| **PMI Plus/Minus/Interesting** ([sourcesofinsight.com](https://sourcesofinsight.com/avoid-the-intelligence-trap/)) | 🟡 待验证 | 1 | 结构化利弊分析框架（提案必须同时写优缺点） | 2026-03-01 |
| **Six Sigma Gap Analysis** ([lean6sigmahub.com](https://lean6sigmahub.com/gap-analysis-in-six-sigma-a-complete-guide-to-comparing-current-state-to-desired-state/)) | 🟡 待验证 | 1 | 现状→期望态→缺口三步法（Review_Meta_Rules Step 3 评估结构） | 2026-03-01 |

| **Anthropic "Demystifying Evals for AI Agents"** ([anthropic.com](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)) | 🟢 已验证 | 1 | AI Agent 质量评估框架（TaskCompletion/GoalFulfillment/三层评估体系） | 2026-03-01 |
| **Anthropic "Building Effective Agents"** ([resources.anthropic.com](https://resources.anthropic.com/building-effective-ai-agents)) | 🟢 已验证 | 1 | 多 Agent 架构原则（三层任务分类 + Haiku优先策略 + 主 Agent 分解模式） | 2026-03-01 |
| **OpenAI "Practical Guide to Building Agents"** ([openai.com](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)) | 🟢 已验证 | 2 | 模型选择决策树（Q1-Q4框架；不确定选Sonnet；先优化准确度再降成本） | 2026-03-01 |
| **Confident AI "LLM-as-Judge"** ([confident-ai.com](https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method)) | 🟡 待验证 | 1 | LLM自评可行性（80-90%人工一致性；Rubric-based多维度隔离是最可靠方案） | 2026-03-01 |
| **Langfuse Token & Cost Tracking** ([langfuse.com](https://langfuse.com/docs/observability/features/token-and-cost-tracking)) | 🟡 待验证 | 1 | 评估日志结构规范（OpenTelemetry标准；Phase 1-3 阶段积累策略） | 2026-03-01 |
| **AWS Multi-LLM Routing** ([aws.amazon.com](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/)) | 🟡 待验证 | 1 | 企业级路由架构（分类路由 vs 语义路由；Multi-label适合复杂场景） | 2026-03-01 |
| **SocraticAI — Princeton NLP** ([princeton-nlp.github.io](https://princeton-nlp.github.io/SocraticAI/)) | 🟡 待验证 | 1 | 双 Agent 规划架构（Reader/Critic/Synthesizer 三角；相互提问+批评替代单一 Agent 推理） | 2026-03-01 |
| **Anthropic Multi-Agent Research System** ([anthropic.com](https://www.anthropic.com/engineering/multi-agent-research-system)) | 🟢 已验证 | 2 | orchestrator-worker 模式；subagent artifact 持久化；并行启动 + 上下文接力 | 2026-03-01 |
| **Multi-Agent Debate** ([composable-models.github.io](https://composable-models.github.io/llm_debate/)) | 🟡 待验证 | 1 | 多 Agent 轮流提出/批评观点，收敛到共识；数学推理和事实准确性显著提升 | 2026-03-01 |

---

## 模型能力基准参考（Type D）

> **适用场景**：选择正确模型（haiku / Sonnet / Opus）时的基准参考。由 Orchestrate_Model_Roles 技能使用。

| 来源平台 | 置信度 | 验证次数 | 适用场景 | 已知优势 | 已知局限 | 最后更新 |
|---------|-------|--------|---------|---------|---------|---------|
| **Anthropic 官方新闻 — Claude Haiku 4.5** ([anthropic.com/news/claude-haiku-4-5](https://www.anthropic.com/news/claude-haiku-4-5)) | 🟢 已验证 | 1 | haiku 4.5 官方能力说明 | 一手来源；含 SWE-bench 73.3%；定位：低延迟/高吞吐/工具调用场景 | 营销性描述，需结合第三方验证 | 2026-03-01 |
| **Anthropic 官方新闻 — Claude Sonnet 4.6** ([anthropic.com/news/claude-sonnet-4-6](https://www.anthropic.com/news/claude-sonnet-4-6)) | 🟢 已验证 | 1 | Sonnet 4.6 官方能力说明 | 一手来源；含 OSWorld 72.5%、Finance Agent 63.3%、用户偏好 70% | 同上 | 2026-03-01 |
| **Anthropic 官方新闻 — Claude Opus 4.6** ([anthropic.com/news/claude-opus-4-6](https://www.anthropic.com/news/claude-opus-4-6)) | 🟢 已验证 | 1 | Opus 4.6 官方能力说明 | 一手来源；含 MRCR 76%、BigLaw 90.2%、Terminal-Bench 65.4%、GPQA 91.3% | 同上 | 2026-03-01 |
| **Anthropic Models Overview** ([platform.claude.com/docs/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)) | 🟢 已验证 | 1 | 模型选择官方指引 | 官方推荐路径（Opus→复杂任务，Sonnet→默认，haiku→低延迟）；含最新定价 | 定价随时更新，需定期核查 | 2026-03-01 |
| **DataCamp — Claude Haiku 4.5 分析** ([datacamp.com](https://www.datacamp.com/blog/anthropic-claude-haiku-4-5)) | 🟡 待验证 | 1 | haiku 4.5 第三方能力测试 | 含 HumanEval ~67%、长会话失去跟踪等具体限制；对照 Sonnet | 非官方；测试方法未详细说明 | 2026-03-01 |
| **NxCode — Sonnet 4.6 vs Opus 4.6 对比** ([nxcode.io](https://www.nxcode.io/resources/news/claude-sonnet-4-6-vs-opus-4-6-which-model-to-choose-2026)) | 🟡 待验证 | 1 | Sonnet vs Opus 实用决策指南 | 综合多项基准；指出 Sonnet 在金融分析反超 Opus | 第三方分析，部分数据需对照官方 | 2026-03-01 |

---

## 复杂度决策与规划框架（Type E）

> **适用场景**：Plan_Design_Discussion 任务规模分级、规划路径选择时的理论依据。

| 来源平台 | 置信度 | 验证次数 | 适用场景 | 已知优势 | 已知局限 | 最后更新 |
|---------|-------|--------|---------|---------|---------|---------|
| **Cynefin Framework** ([thecynefin.co](https://thecynefin.co/about-us/about-cynefin-framework/)) | 🟢 已验证 | 1 | 复杂度分域（简单/繁杂/复杂/混沌）→ 匹配规划方式 | 戴维·斯诺登创立；管理学广泛采用；给出明确的域判断标准 | 较抽象，需要结合具体场景解读 | 2026-03-01 |
| **Amazon Type 1/Type 2 Decisions** ([fourweekmba.com](https://fourweekmba.com/decision-making-matrix/)) | 🟢 已验证 | 1 | 可逆性判断 → 决定规划深度 | 贝佐斯明确提出；Type 1（不可逆）需完整规划，Type 2（可逆）可快速决策 | 原版针对战略决策，需调适 AI 对话场景 | 2026-03-01 |
| **Stacey Complexity Model** ([scrum-tips.com](https://www.scrum-tips.com/agile/stacey-complexity-model/)) | 🟡 待验证 | 1 | 简单/繁杂/复杂/混沌四级复杂度 → 规划深度 | 比 Cynefin 更直观的二维图；Scrum 社区广泛使用 | 学术背景，需要主观判断 | 2026-03-01 |
| **Why Multi-Agent LLM Systems Fail (ICLR 2025)** ([arxiv.org](https://arxiv.org/abs/2503.13657)) | 🟢 已验证 | 1 | 编排器-工作者模式的失败模式研究 | 14 种失败模式分类；来自 ICLR 2025；有具体案例 | 2025 年研究，实验环境可能与生产有差异 | 2026-03-01 |
| **Caylent — Haiku 4.5 Multi-Agent Deep Dive** ([caylent.com](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity)) | 🟢 已验证 | 1 | haiku 在 multi-agent 系统中的生产实践 | 工程实践视角；含具体成本数据（2-2.5x token 节省）；非营销 | 单一来源，需结合其他验证 | 2026-03-01 |
| **Qodo — 400 Real PR Benchmark** ([qodo.ai](https://www.qodo.ai/blog/thinking-vs-thinking-benchmarking-claude-haiku-4-5-and-sonnet-4-5-on-400-real-prs/)) | 🟢 已验证 | 1 | haiku 4.5 代码审查实战能力（58% 胜率 vs Sonnet 4.5）| 基于 400 个真实 PR，方法论清晰；非官方基准；发现 haiku 在 thinking 模式下优于 Sonnet | 单一场景（代码审查），不可推广至所有编码任务 | 2026-03-01 |
| **Jock.pl — 从 Opus 换到 haiku 的成本优化** ([thoughts.jock.pl](https://thoughts.jock.pl/p/claude-model-optimization-opus-haiku-ai-agent-costs-2026)) | 🟡 待验证 | 1 | 实战切换案例：Claude Max 用量从 70-80% 降至 40% | 真实用户案例；量化成果；「不过度思考」是优势而非缺陷 | 个人博客，单一案例，不可广泛推广 | 2026-03-01 |



> 当某类问题找不到可靠来源时，记录在此，以便后续定向补全。

| 盲区 | 发现日期 | 建议补全方式 |
|-----|---------|-----------|
| 独立游戏数值平衡方法论 | 2026-03-01 | 搜索 GDC Vault「economy design indie」 |
| 中文游戏设计社区（知乎/B站）的系统化评估标准 | 2026-03-01 | 需积累更多使用经验后再评级 |

---

## 降级记录（来源被降级的历史）

> 当某来源被发现不可靠时记录原因，防止重复引用。

| 来源 | 降级日期 | 原因 | 影响范围 |
|-----|---------|------|---------|
| **Grokipedia** | 2026-05-14 | AI 自动聚合页，信源不可追溯；与 Wikipedia 主条目交叉验证存在偏差；P4 单指划击 Fruit Ninja 提取时识别其内容存在二手转述风险 | 全局 — 不可单独作为论据；如需引用必须横向核对 Wikipedia / 厂商一手 |

---

> **最后全局更新**：2026-09-07（Project_7 Spellatoon 优化风险评估：新增 Splatoon / Faeria / Onitama 官方页来源记录，并复用 GDC Gunhouse 试玩方法论）
> **本 log 由 Find_Reference 技能 Step 5 自动维护
