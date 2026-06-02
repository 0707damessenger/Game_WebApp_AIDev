# Workspace_Skills 使用说明

## 1. 定位

`F:\Workspace_Skills` 是当前工作区的工作区级 skills 层。

其职责如下：

- 补充当前工作区专属的游戏设计、参考研究、讨论沉淀能力
- 承接项目级与全局级之间的通用工作区能力
- 不替代全局 Superpowers 的通用流程骨架

## 2. 优先级

当项目级、工作区级、全局级同时存在时，必须按以下优先级选择：

`项目级 > 工作区级 > 全局级`

工作区级 skills 不得依赖某台机器的固定全局安装路径；应以职责边界和触发逻辑为准。

## 3. 目录结构

```text
F:\Workspace_Skills\
  README.md
  core\
  research\
  capture\
  evaluation\
  experimental\
```

## 4. 各目录职责

### 4.1 core

承载当前生产主链中必须优先使用的工作区级设计技能。

**当前放置**：

- `Plan_Design_Discussion`

### 4.2 research

负责参考资料获取、规则提炼、竞品拆解、方法论补充。

**当前放置**：

- `Find_Reference`
- `Extract_Web_Reference`
- `Extract_Rulebook`

### 4.3 capture

负责记录讨论过程、保存待探索想法、归档被否决方向。

**当前放置**：

- `Record_Discussion`
- `Record_Idea`
- `Archive_Idea`

### 4.4 evaluation

负责设计原则检查、一致性评估、方案质量评估。

**当前放置**：

- `Game_Design_Principles`
- `Review_Design_Proposal`

### 4.5 experimental

负责存放不作为主入口、但可在特定环节被动触发的补充技能，以及仍处于观察期的技能。

**当前放置**：

- `Brainstorm_Extension`
- `Extract_Steam_Analytics`

## 5. 与全局 Superpowers 的分工边界

全局 Superpowers 继续承担 **通用流程骨架**；工作区级 skills 负责 **游戏设计与网页原型领域增强**。

### 5.1 全局 Superpowers 负责的内容

以下能力原则上继续由全局 Superpowers 提供：

- `brainstorming`：通用设计澄清与前置脑暴流程
- `writing-plans`：设计获批后的实施计划拆解
- `executing-plans` / `subagent-driven-development`：计划执行
- `systematic-debugging`：问题排查
- `verification-before-completion`：完成前验证
- `requesting-code-review`：代码审查

这些 skill 的共同特点是：

- 跨项目通用
- 不依赖具体游戏设计知识库
- 更偏方法论骨架，而不是业务领域内容

### 5.2 工作区级 skills 负责的内容

以下内容应由 `F:\Workspace_Skills` 承担：

- 游戏设计问题的结构化规划补充
- 竞品与参考资料的定向搜索与提炼
- 设计讨论结果的记录、创意池管理与归档
- 设计原则和一致性检查

这些 skill 的共同特点是：

- 与“小游戏网页原型”强相关
- 具有明显游戏设计语境
- 能提升工作区复用效率
- 不适合放进全局层作为所有项目通用能力

### 5.3 分工原则

为避免职责重叠，必须遵守以下原则：

- 不重复创建与全局 `brainstorming` 同职责的工作区级 skill
- 工作区级 skills 应优先做“补充、细化、约束、沉淀”，而不是重做通用流程
- 若全局 skill 已能稳定完成通用工作，工作区级应只补领域差异，不应平行复制
- 若工作区级与全局级结论冲突，以项目级或工作区级约定为准

### 5.4 主入口与补充层

当前工作区的分工必须明确如下：

- 工作区级 `core/Plan_Design_Discussion` 是**游戏设计规划主入口**
- 全局 `brainstorming` 是**通用脑暴补充层**
- `Brainstorm_Extension` 可在设计发散或方案卡住时，作为 `Plan_Design_Discussion` 内的被动触发补充技能使用
- 全局 `writing-plans`、`executing-plans`、`systematic-debugging`、`verification-before-completion` 继续承担工程流程能力

执行时必须遵守：

- 涉及小游戏玩法方向、规则收敛、设计问题开题时，优先进入 `core/Plan_Design_Discussion`
- 全局 `brainstorming` 仅用于通用设计澄清，不得覆盖工作区级设计主入口
- 工作区级 `research`、`capture`、`evaluation` 作为设计主入口的补充层使用

### 5.5 产物落点

项目级正式产物必须统一落在**项目目录下的 `docs/` 文件夹**。

统一规则如下：

- 项目设计主文档必须使用 `docs/design.md`
- 后续在项目中新增的讨论记录、补充设计、约定文档，原则上也应写入 `docs/` 目录
- 项目目录下 `docs/` 内的文档是当前工作区的**主权威文档**
- Superpowers 运行过程中生成的 `docs/superpowers/...` 下 spec / plan 文件，仅作为插件运行时产物，不作为项目正式设计文档
- 若 `docs/superpowers/...` 与项目 `docs/` 下文档出现冲突，必须以项目 `docs/` 下文档为准

## 6. 使用规则

- 每个 skill 必须保持单一职责，不得把多个不相关能力混在同一 skill 中
- 工作区级 skill 命名应优先保留原有能力语义，避免为追求统一而改成难以识别的新名字
- 若从外部仓库迁入 skill，优先保留原始结构，再按工作区规则补充 README 或使用说明
- 新增 skill 前，必须先判断该能力是否已经由全局或项目级提供，避免重复建设
- 当某 skill 已长期不用、定位不清或与全局能力重叠时，应评估是否移入 `experimental` 或移除
- README 中列出的目录与 skill 清单必须与 `F:\Workspace_Skills` 实际落地内容保持一致，不得长期保留未落地的占位项

## 7. 当前推荐理解

`F:\Workspace_Skills` 不是“把所有能用的 skill 都放进来”的仓库，而是当前工作区的 **领域能力层**。

它应当满足以下定位：

- 比全局层更懂“小游戏网页原型”
- 比项目层更通用、更可复用
- 比临时对话策略更稳定、更可维护

只要保持这一定位，目录结构就可以长期演进，而不必频繁推翻重做。
