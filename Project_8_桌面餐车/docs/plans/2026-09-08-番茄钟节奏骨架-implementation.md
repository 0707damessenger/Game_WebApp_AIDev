# 番茄钟节奏骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可在浏览器完成一次“安排工作 → 短工作阶段 → 自动休息 → 返回安排”的番茄钟原型，并清楚限制工作阶段的管理操作。

**Architecture:** 使用纯前端 ES Modules。`pomodoro-state.mjs` 只处理状态转换和规则校验，不访问浏览器 API；`app.mjs` 负责计时和事件派发；`render.mjs` 根据状态重绘普通窗口或模拟桌面小窗。所有可调数值、地点和模式选项只来自唯一的 `CONFIG`。

**Tech Stack:** 原生 HTML/CSS/JavaScript ES Modules、Node.js 内置测试运行器、Playwright、Microsoft Edge（现有本机浏览器）。

---

## 范围与交互契约

- 原型初始处于“待安排”状态，默认开启番茄钟；玩家在普通窗口选择经营或旅行及对应地区，才可开始工作。
- 工作完成后立即进入计时中的休息阶段，并保留本轮完成的模式和地区作为简短结果反馈。
- 休息期间可以改选下一轮安排；休息倒计时结束后回到“待安排”，不自动开始下一轮工作。这样避免网页原型在用户不在场时连续切换状态。
- 工作期间锁住地点、模式、商店、研发和烹饪；只保留切换窗口形态的观看入口。商店、研发和烹饪在本模块中是禁用的管理占位入口，不实现其业务。
- 关闭番茄钟时进入“自由管理”状态：不自动计时、不自动开始经营或旅行，管理入口可用。正在工作的番茄钟不可被关闭，以免本轮规则中途改变。
- 小窗只显示阶段、倒计时、当前工作、简化餐车场景及“展开”按钮；普通窗口显示安排、管理入口和模式说明。两种窗口只是网页内视觉状态，不尝试系统级置顶。
- 工作与休息时长采用短秒数，但具体值只写入 `CONFIG`，不写入 `design.md`。

## 文件结构

| 路径 | 责任 |
|---|---|
| `Project_8_桌面餐车/prototype/js/config.mjs` | 唯一的全局配置源：短计时、可选模式与地区、界面文案。 |
| `Project_8_桌面餐车/prototype/js/pomodoro-state.mjs` | 不可变状态转换、安排合法性和阶段锁定规则。 |
| `Project_8_桌面餐车/prototype/js/render.mjs` | 将状态渲染为普通窗口或小窗 DOM。 |
| `Project_8_桌面餐车/prototype/js/app.mjs` | 初始化、定时器、DOM 事件和测试用状态快照。 |
| `Project_8_桌面餐车/prototype/server.mjs` | 仅用于本地查看原型的静态文件服务。 |
| `Project_8_桌面餐车/prototype/progress.md` | 原始需求摘要、已完成验证与下一轮待办，供后续迭代交接。 |
| `Project_8_桌面餐车/prototype/index.html` | 原型语义结构和模块入口。 |
| `Project_8_桌面餐车/prototype/css/styles.css` | 几何占位场景、桌面小窗和禁用状态视觉。 |
| `Project_8_桌面餐车/prototype/tests/pomodoro-state.test.mjs` | 状态机单元测试。 |
| `Project_8_桌面餐车/prototype/tests/ui-contract.test.mjs` | 浏览器中的可见流程与锁定契约测试。 |

### Task 1: 配置与状态规则

**Files:**

- Create: `Project_8_桌面餐车/prototype/js/config.mjs`
- Create: `Project_8_桌面餐车/prototype/js/pomodoro-state.mjs`
- Create: `Project_8_桌面餐车/prototype/tests/pomodoro-state.test.mjs`

- [ ] **Step 1: 先写状态机失败测试。**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { CONFIG } from '../js/config.mjs';
import {
  advanceSecond,
  createInitialState,
  setNextPlan,
  setPomodoroEnabled,
  startWork,
} from '../js/pomodoro-state.mjs';

test('requires a valid plan before a pomodoro work stage can start', () => {
  const initial = createInitialState(CONFIG);
  assert.deepEqual(startWork(initial, CONFIG), { ok: false, reason: 'plan-required' });

  const planned = setNextPlan(initial, { activity: 'travel', regionId: 'forest' }, CONFIG).state;
  const started = startWork(planned, CONFIG);
  assert.equal(started.ok, true);
  assert.equal(started.state.phase, 'work');
  assert.deepEqual(started.state.activePlan, { activity: 'travel', regionId: 'forest' });
  assert.equal(started.state.secondsRemaining, CONFIG.timer.workSeconds);
});

test('moves from work to rest and returns to planning after rest', () => {
  const configured = setNextPlan(createInitialState(CONFIG), { activity: 'operate', regionId: 'market' }, CONFIG).state;
  let state = startWork(configured, CONFIG).state;
  for (let second = 0; second < CONFIG.timer.workSeconds; second += 1) state = advanceSecond(state, CONFIG).state;
  assert.equal(state.phase, 'rest');
  assert.deepEqual(state.lastCompletedPlan, { activity: 'operate', regionId: 'market' });
  assert.equal(state.activePlan, null);
  for (let second = 0; second < CONFIG.timer.restSeconds; second += 1) state = advanceSecond(state, CONFIG).state;
  assert.equal(state.phase, 'planning');
  assert.equal(state.secondsRemaining, null);
});

test('locks plan changes and pomodoro disabling during work', () => {
  const planned = setNextPlan(createInitialState(CONFIG), { activity: 'travel', regionId: 'forest' }, CONFIG).state;
  const working = startWork(planned, CONFIG).state;
  assert.deepEqual(setNextPlan(working, { activity: 'operate', regionId: 'market' }, CONFIG), { ok: false, reason: 'management-locked' });
  assert.deepEqual(setPomodoroEnabled(working, false, CONFIG), { ok: false, reason: 'work-in-progress' });
});

test('allows scheduling during rest but does not allow rest to be skipped', () => {
  const planned = setNextPlan(createInitialState(CONFIG), { activity: 'travel', regionId: 'forest' }, CONFIG).state;
  let state = startWork(planned, CONFIG).state;
  for (let second = 0; second < CONFIG.timer.workSeconds; second += 1) state = advanceSecond(state, CONFIG).state;
  const rescheduled = setNextPlan(state, { activity: 'operate', regionId: 'market' }, CONFIG);
  assert.equal(rescheduled.ok, true);
  assert.deepEqual(startWork(rescheduled.state, CONFIG), { ok: false, reason: 'rest-in-progress' });
});

test('disabling pomodoro enters free management without automatic work', () => {
  const disabled = setPomodoroEnabled(createInitialState(CONFIG), false, CONFIG);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.state.phase, 'free');
  assert.equal(disabled.state.pomodoroEnabled, false);
  assert.equal(startWork(disabled.state, CONFIG).reason, 'pomodoro-disabled');
});
```

- [ ] **Step 2: 运行测试并确认它因为模块尚不存在而失败。**

Run: `node --test "Project_8_桌面餐车/prototype/tests/pomodoro-state.test.mjs"`

Expected: `ERR_MODULE_NOT_FOUND`，且进程退出码非零。

- [ ] **Step 3: 创建唯一配置源。**

```js
export const CONFIG = Object.freeze({
  timer: Object.freeze({ workSeconds: 12, restSeconds: 6, tickMilliseconds: 1000 }),
  activities: Object.freeze([
    Object.freeze({ id: 'operate', label: '经营', regionIds: Object.freeze(['market']) }),
    Object.freeze({ id: 'travel', label: '旅行', regionIds: Object.freeze(['forest', 'coast']) }),
  ]),
  regions: Object.freeze([
    Object.freeze({ id: 'market', label: '晨市' }),
    Object.freeze({ id: 'forest', label: '林道' }),
    Object.freeze({ id: 'coast', label: '海湾' }),
  ]),
});
```

- [ ] **Step 4: 实现纯状态机。**

```js
function clonePlan(plan) {
  return plan ? { activity: plan.activity, regionId: plan.regionId } : null;
}

function isValidPlan(plan, config) {
  const activity = config.activities.find((item) => item.id === plan?.activity);
  return Boolean(activity && activity.regionIds.includes(plan.regionId));
}

export function createInitialState() {
  return {
    pomodoroEnabled: true,
    phase: 'planning',
    nextPlan: null,
    activePlan: null,
    lastCompletedPlan: null,
    secondsRemaining: null,
  };
}

export function setNextPlan(state, plan, config) {
  if (state.phase === 'work') return { ok: false, reason: 'management-locked' };
  if (!isValidPlan(plan, config)) return { ok: false, reason: 'invalid-plan' };
  return { ok: true, state: { ...state, nextPlan: clonePlan(plan) } };
}

export function setPomodoroEnabled(state, enabled) {
  if (state.phase === 'work') return { ok: false, reason: 'work-in-progress' };
  return {
    ok: true,
    state: {
      ...state,
      pomodoroEnabled: enabled,
      phase: enabled ? 'planning' : 'free',
      secondsRemaining: null,
      activePlan: null,
    },
  };
}

export function startWork(state, config) {
  if (!state.pomodoroEnabled) return { ok: false, reason: 'pomodoro-disabled' };
  if (state.phase === 'work') return { ok: false, reason: 'work-in-progress' };
  if (state.phase === 'rest') return { ok: false, reason: 'rest-in-progress' };
  if (!isValidPlan(state.nextPlan, config)) return { ok: false, reason: 'plan-required' };
  return {
    ok: true,
    state: {
      ...state,
      phase: 'work',
      activePlan: clonePlan(state.nextPlan),
      secondsRemaining: config.timer.workSeconds,
    },
  };
}

export function advanceSecond(state, config) {
  if (state.phase !== 'work' && state.phase !== 'rest') return { ok: true, state };
  if (state.secondsRemaining > 1) return { ok: true, state: { ...state, secondsRemaining: state.secondsRemaining - 1 } };
  if (state.phase === 'work') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'rest',
        activePlan: null,
        lastCompletedPlan: clonePlan(state.activePlan),
        secondsRemaining: config.timer.restSeconds,
      },
    };
  }
  return { ok: true, state: { ...state, phase: 'planning', secondsRemaining: null } };
}
```

- [ ] **Step 5: 运行状态机测试。**

Run: `node --test "Project_8_桌面餐车/prototype/tests/pomodoro-state.test.mjs"`

Expected: 5 个测试全部通过。

- [ ] **Step 6: 记录一次独立提交候选。**

暂不自动提交。向用户展示本任务新增的配置与状态规则，询问是否要提交并推送；获得明确同意后，只暂存本任务的 3 个文件并使用提交信息：`完成番茄钟状态规则原型`。

### Task 2: 普通窗口、小窗与计时驱动

**Files:**

- Create: `Project_8_桌面餐车/prototype/index.html`
- Create: `Project_8_桌面餐车/prototype/css/styles.css`
- Create: `Project_8_桌面餐车/prototype/js/render.mjs`
- Create: `Project_8_桌面餐车/prototype/js/app.mjs`
- Create: `Project_8_桌面餐车/prototype/server.mjs`
- Create: `Project_8_桌面餐车/prototype/progress.md`

- [ ] **Step 1: 建立可访问的页面结构和模块入口。**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>桌面餐车 - 番茄钟原型</title>
    <link rel="stylesheet" href="./css/styles.css">
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script type="module" src="./js/app.mjs"></script>
  </body>
</html>
```

- [ ] **Step 2: 实现渲染模块，使用稳定的 DOM id 作为界面契约。**

```js
function formatTime(seconds) {
  if (seconds === null) return '--:--';
  return `00:${String(seconds).padStart(2, '0')}`;
}

function planText(plan, config) {
  if (!plan) return '尚未安排';
  const activity = config.activities.find((item) => item.id === plan.activity)?.label;
  const region = config.regions.find((item) => item.id === plan.regionId)?.label;
  return `${activity} · ${region}`;
}

function phaseText(phase) {
  return ({ planning: '安排下一段工作', work: '专注进行中', rest: '休息时间', free: '自由管理' })[phase];
}

export function render(app, state, config, view) {
  const locked = state.phase === 'work';
  if (view === 'compact') {
    app.innerHTML = `
      <section class="compact-window" aria-label="桌面餐车小窗">
        <button id="expand-window" aria-label="展开普通窗口">↗</button>
        <div class="scene"><div class="truck"></div><div class="road"></div></div>
        <p id="compact-phase">${phaseText(state.phase)}</p>
        <strong id="compact-timer">${formatTime(state.secondsRemaining)}</strong>
        <p id="compact-plan">${planText(state.activePlan || state.nextPlan || state.lastCompletedPlan, config)}</p>
      </section>`;
    return;
  }
  const selectedActivity = state.nextPlan?.activity || config.activities[0].id;
  const activityButtons = config.activities.map((activity) => `<button class="activity-choice ${activity.id === selectedActivity ? 'is-selected' : ''}" data-activity="${activity.id}" ${locked ? 'disabled' : ''}>${activity.label}</button>`).join('');
  const regionButtons = config.activities.find((activity) => activity.id === selectedActivity).regionIds.map((regionId) => {
    const region = config.regions.find((item) => item.id === regionId);
    return `<button class="region-choice ${state.nextPlan?.regionId === region.id ? 'is-selected' : ''}" data-region="${region.id}" ${locked ? 'disabled' : ''}>${region.label}</button>`;
  }).join('');
  app.innerHTML = `
    <section class="window-shell" aria-label="桌面餐车普通窗口">
      <header><button id="compact-window" aria-label="切换到桌面小窗">小窗</button><label><input id="pomodoro-toggle" type="checkbox" ${state.pomodoroEnabled ? 'checked' : ''} ${locked ? 'disabled' : ''}> 番茄钟</label></header>
      <div class="scene large"><div class="truck"></div><div class="road"></div></div>
      <section class="timer-panel"><p id="phase-label">${phaseText(state.phase)}</p><strong id="timer">${formatTime(state.secondsRemaining)}</strong><p id="active-plan">${planText(state.activePlan || state.nextPlan || state.lastCompletedPlan, config)}</p></section>
      <section id="planning-panel" ${locked ? 'aria-disabled="true"' : ''}><h1>下一段</h1><div>${activityButtons}</div><div>${regionButtons}</div><button id="start-work" ${state.phase === 'planning' && state.pomodoroEnabled && state.nextPlan ? '' : 'disabled'}>开始工作</button></section>
      <section id="management-panel" ${locked ? 'aria-disabled="true"' : ''}><button id="shop" ${locked ? 'disabled' : ''}>商店</button><button id="research" ${locked ? 'disabled' : ''}>研发</button><button id="cook" ${locked ? 'disabled' : ''}>备餐</button></section>
      <p id="management-status">${locked ? '工作中，管理功能已锁定' : '管理功能可用'}</p>
    </section>`;
}
```

- [ ] **Step 3: 实现应用协调器，确保只有它创建与清除浏览器定时器。**

```js
import { CONFIG } from './config.mjs';
import { advanceSecond, createInitialState, setNextPlan, setPomodoroEnabled, startWork } from './pomodoro-state.mjs';
import { render } from './render.mjs';

const app = document.querySelector('#app');
let state = createInitialState(CONFIG);
let view = 'window';
let intervalId = null;

function syncTimer() {
  const shouldTick = state.phase === 'work' || state.phase === 'rest';
  if (shouldTick && intervalId === null) intervalId = window.setInterval(() => update(advanceSecond(state, CONFIG)), CONFIG.timer.tickMilliseconds);
  if (!shouldTick && intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
}

function update(result) {
  if (result?.state) state = result.state;
  syncTimer();
  render(app, state, CONFIG, view);
}

function advanceTime(milliseconds) {
  let remaining = milliseconds;
  while (remaining >= CONFIG.timer.tickMilliseconds && (state.phase === 'work' || state.phase === 'rest')) {
    remaining -= CONFIG.timer.tickMilliseconds;
    state = advanceSecond(state, CONFIG).state;
  }
  syncTimer();
  render(app, state, CONFIG, view);
}

function selectedActivity() {
  return app.querySelector('.activity-choice.is-selected')?.dataset.activity || state.nextPlan?.activity || 'operate';
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.id === 'compact-window') { view = 'compact'; update(); return; }
  if (button.id === 'expand-window') { view = 'window'; update(); return; }
  if (button.dataset.activity) {
    const regionId = CONFIG.activities.find((item) => item.id === button.dataset.activity).regionIds[0];
    update(setNextPlan(state, { activity: button.dataset.activity, regionId }, CONFIG));
    return;
  }
  if (button.dataset.region) { update(setNextPlan(state, { activity: selectedActivity(), regionId: button.dataset.region }, CONFIG)); return; }
  if (button.id === 'start-work') update(startWork(state, CONFIG));
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'pomodoro-toggle') update(setPomodoroEnabled(state, event.target.checked, CONFIG));
});

window.render_game_to_text = () => JSON.stringify({ ...state, view });
window.advanceTime = advanceTime;
update();
```

- [ ] **Step 4: 添加本地静态服务，供人工测试和用户体验使用。**

```js
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const port = 51780;

createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const filePath = normalize(join(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))));
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) return response.writeHead(404).end();
  response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Desktop Food Truck prototype: http://127.0.0.1:${port}`));
```

- [ ] **Step 5: 创建开发交接记录。**

```markdown
# 桌面餐车原型进度

Original prompt: 制作一款二维像素卡通画风的 PC 桌面挂机增量游戏。玩家驾驶餐车旅行收集食材、研发烹饪并经营售卖；游戏以番茄钟工作和休息阶段组织低干扰陪伴体验。

## 当前模块

- 番茄钟节奏骨架：计时、阶段切换、工作安排和工作阶段管理锁定。

## 本轮验证

- 待完成：状态机单元测试、浏览器流程测试、宽屏与窄屏人工检查。

## 后续范围

- 不在本模块实现经济循环、新闻、全局输入、离线结算或系统级桌面能力。
```

- [ ] **Step 6: 添加最小视觉规则，避免按钮和场景因内容变化而跳动。**

```css
:root { color: #26313b; background: #d8eced; font-family: system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
button { min-height: 36px; border: 2px solid #26313b; border-radius: 4px; background: #fff8e8; color: inherit; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
.is-selected { background: #86c9a8; }
.window-shell { width: min(720px, calc(100vw - 32px)); display: grid; gap: 14px; padding: 18px; background: #f6dca7; border: 3px solid #26313b; }
header { display: flex; justify-content: space-between; align-items: center; }
.scene { position: relative; min-height: 152px; overflow: hidden; background: #9dd5bd; border: 3px solid #26313b; }
.scene.large { min-height: 210px; }
.road { position: absolute; right: 0; bottom: 0; left: 0; height: 32%; background: #8390a0; }
.truck { position: absolute; bottom: 24%; left: 38%; width: 132px; height: 74px; background: #f07167; border: 3px solid #26313b; }
.truck::before, .truck::after { content: ''; position: absolute; bottom: -15px; width: 24px; height: 24px; border: 3px solid #26313b; border-radius: 50%; background: #26313b; }
.truck::before { left: 18px; }.truck::after { right: 18px; }
.timer-panel { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 16px; }
.timer-panel p { margin: 0; }.timer-panel strong { font-size: 28px; font-variant-numeric: tabular-nums; }.timer-panel #active-plan { grid-column: 1 / -1; }
#planning-panel, #management-panel { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
#planning-panel h1 { width: 100%; margin: 0; font-size: 18px; }
.compact-window { width: 280px; padding: 10px; background: #f6dca7; border: 3px solid #26313b; }.compact-window .scene { min-height: 94px; }.compact-window .truck { left: 31%; transform: scale(.65); transform-origin: bottom left; }.compact-window p { margin: 6px 0; }.compact-window strong { font-size: 24px; font-variant-numeric: tabular-nums; }#expand-window { float: right; width: 36px; }
```

- [ ] **Step 7: 手工启动静态页面并完成一次短循环。**

Run: `node "Project_8_桌面餐车/prototype/server.mjs"`

Expected: 浏览器打开 `http://localhost:51780` 后，选择“旅行 → 林道”并开始工作；倒计时归零进入休息；休息归零后回到“安排下一段工作”。确认小窗可展开，且工作中管理按钮禁用。

- [ ] **Step 8: 记录一次独立提交候选。**

暂不自动提交。向用户展示该界面与计时驱动已完成的内容，询问是否要提交并推送；获得明确同意后，只暂存本任务的 6 个文件并使用提交信息：`完成番茄钟节奏界面原型`。

### Task 3: 浏览器界面契约与全模块验证

**Files:**

- Create: `Project_8_桌面餐车/prototype/tests/ui-contract.test.mjs`
- Modify: `Project_8_桌面餐车/prototype/js/render.mjs`（仅在测试暴露了缺少的稳定状态标识时）
- Modify: `Project_8_桌面餐车/prototype/js/app.mjs`（仅在测试暴露了计时器或事件绑定缺陷时）

- [ ] **Step 1: 写出浏览器流程测试。**

```js
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };

async function openPrototype() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const filePath = normalize(join(root, pathname === '/' ? 'index.html' : pathname.slice(1)));
    if (!filePath.startsWith(root)) return response.writeHead(403).end();
    try { if (!(await stat(filePath)).isFile()) throw new Error('not-file'); response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' }); response.end(await readFile(filePath)); } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  return { browser, page, server };
}

test('starts a selected journey and locks management during work', async (t) => {
  const app = await openPrototype();
  t.after(async () => { await app.browser.close(); await new Promise((done) => app.server.close(done)); });
  await app.page.getByRole('button', { name: '旅行' }).click();
  await app.page.getByRole('button', { name: '林道' }).click();
  await app.page.getByRole('button', { name: '开始工作' }).click();
  const state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'work');
  assert.deepEqual(state.activePlan, { activity: 'travel', regionId: 'forest' });
  assert.equal(await app.page.locator('#shop').isDisabled(), true);
  assert.equal(await app.page.locator('#research').isDisabled(), true);
  assert.equal(await app.page.locator('#cook').isDisabled(), true);
});

test('switches between the ordinary window and the compact companion window', async (t) => {
  const app = await openPrototype();
  t.after(async () => { await app.browser.close(); await new Promise((done) => app.server.close(done)); });
  await app.page.locator('#compact-window').click();
  assert.equal(await app.page.locator('.compact-window').isVisible(), true);
  await app.page.locator('#expand-window').click();
  assert.equal(await app.page.locator('.window-shell').isVisible(), true);
});

test('keeps free management non-automatic when pomodoro is disabled', async (t) => {
  const app = await openPrototype();
  t.after(async () => { await app.browser.close(); await new Promise((done) => app.server.close(done)); });
  await app.page.locator('#pomodoro-toggle').uncheck();
  const state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'free');
  assert.equal(state.pomodoroEnabled, false);
  assert.equal(await app.page.locator('#shop').isDisabled(), false);
});

test('moves from a visible work phase to rest and then planning with deterministic time', async (t) => {
  const app = await openPrototype();
  t.after(async () => { await app.browser.close(); await new Promise((done) => app.server.close(done)); });
  await app.page.getByRole('button', { name: '经营' }).click();
  await app.page.getByRole('button', { name: '开始工作' }).click();
  await app.page.evaluate(() => window.advanceTime(12000));
  let state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'rest');
  assert.deepEqual(state.lastCompletedPlan, { activity: 'operate', regionId: 'market' });
  await app.page.evaluate(() => window.advanceTime(6000));
  state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'planning');
});
```

- [ ] **Step 2: 运行测试，先确认界面契约中不存在选择器或流程偏差。**

Run: `node --test "Project_8_桌面餐车/prototype/tests/ui-contract.test.mjs"`

Expected: 4 个测试通过。若失败，只修复失败报告直接指向的状态或 DOM 契约，不扩大到经济、新闻或输入统计功能。

- [ ] **Step 3: 运行完整模块验证和静态检查。**

Run: `node --test "Project_8_桌面餐车/prototype/tests/*.test.mjs"`

Expected: 状态机与界面契约共 9 个测试通过。

Run: `rg -n "TODO|TBD|占位待补|未实现" "Project_8_桌面餐车/prototype"`

Expected: 无匹配；商店、研发和备餐的禁用按钮是本模块刻意的界面边界，不可留下模糊占位注释。

- [ ] **Step 4: 在桌面与窄窗口进行人工回归。**

打开原型，分别以宽屏和约 390px 宽的浏览器窗口检查：文本不重叠、按钮不撑破容器、小窗中餐车和倒计时可见、工作阶段切换小窗不会解锁管理操作。记录截图作为本轮验证证据；只在视觉问题影响阶段理解或点击目标时修复。

- [ ] **Step 5: 记录模块完成提交候选。**

验证通过后告知用户可测试的地址和覆盖范围，并询问是否提交并推送。用户同意后仅暂存 `Project_8_桌面餐车/prototype/` 中本模块的文件，使用提交信息：`完成番茄钟节奏骨架原型`。

## 实施后验收清单

- [ ] 未安排工作时不能启动番茄钟工作阶段。
- [ ] 经营/旅行及地区可以带入工作阶段。
- [ ] 工作倒计时结束进入休息，休息结束返回待安排而非自动开始下一段。
- [ ] 工作阶段中管理入口、安排按钮和番茄钟开关均不可用。
- [ ] 休息、待安排与自由管理状态允许安排和管理入口。
- [ ] 普通窗口与模拟小窗可互相切换，且显示同一阶段和计划。
- [ ] 所有原型数值只在 `CONFIG` 中定义。
- [ ] 未实现完整经济、新闻、全局输入监听、离线结算或系统级桌面窗口能力。

## 自检结果

- 设计范围中的计时、阶段切换、模式地区带入、工作阶段锁定、小窗和普通窗口切换，均有对应任务和测试。
- 自动连续开始、经济结算、新闻、离线推进和全局输入监听均明确排除，未借“骨架”之名扩大范围。
- 计划中函数名和字段名统一使用 `createInitialState`、`setNextPlan`、`setPomodoroEnabled`、`startWork`、`advanceSecond`、`nextPlan`、`activePlan` 与 `lastCompletedPlan`。
- 已检查计划没有 `TODO`、`TBD` 或需要工程师自行补全的步骤。
