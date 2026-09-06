Original prompt: 负责 Spellatoon 实现计划的 Task 1：基础棋盘、角色、数字卡牌状态。实现 6x6 棋盘、两个对角角色、数字卡牌初始手牌和最小可运行浏览器界面；使用原生 HTML/CSS/ES modules；提供 render_game_to_text() 与 advanceTime(ms)；先写失败测试再实现；不要提交或推送。

## Task 1 进度

- [x] 读取工作区 AGENTS.md 与测试驱动开发规范。
- [x] 按 TDD 先创建初始状态测试并运行，确认目标模块缺失导致失败。
- [x] 建立唯一 CONFIG 对象、初始状态规则 API 与初始状态测试。
- [x] 完成浏览器界面并进行截图、文本和控制台验证。

## 验证记录

- 红灯：`node --test Project_6_游戏_spellatoon/prototype/tests/rules.test.mjs`，因 `config.mjs` 不存在失败。
- 绿灯：`npm run test:spellatoon`，5/5 通过；覆盖棋盘、角色、开局手牌、动作状态、私有手牌文本和未染色格角色定位。
- 浏览器：`python -m http.server 51359 --directory "Project_6_游戏_spellatoon/prototype"` 配合官方 Playwright 客户端验证通过；截图显示 Spellatoon 棋盘和左上角角色，文本状态显示 36 个公共格、双方角色、5 张本地手牌且无 opponentHand，控制台错误为空。
- 修复：角色不再依赖地块染色归属；卡片使用独立节点；动作标志统一为 `moved/deployed`；卡片包含 `ownerId`；玩家 id 统一为 `p1/p2`。

## Task 2 进度

- [x] 增加移动与部署规则 API：数字决定最大移动格数，路径支持横纵任意转弯；部署只能发生在角色所在空格。
- [x] 增加手牌选择、移动/部署模式、逐格路径选择、确认移动和部署点击交互。
- [x] 增加可达格、移动路径、部署目标、选中手牌和无效操作反馈。
- [x] 增加浏览器契约测试：移动、部署和无效移动反馈。

## Task 2 验证记录

- 规则测试与浏览器契约测试：14/14 通过；覆盖移动、部署和无效移动反馈。
- 官方网页游戏 Playwright 客户端：完成页面动作循环，输出截图与状态快照；状态显示 p1 先手、6×6 棋盘、5 张本地手牌；无控制台错误。
- 待办：进入连锁/吞噬、回合结束、补牌和结算模块前，先确认本模块提交节点。
