# 游戏经历栏目 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在“关于”页的“我的主页”上方增加按类型分类的游戏经历栏目，并允许单款游戏配置可选备注。

**Architecture:** 继续使用 `window.CONFIG` 作为唯一内容源，在关于页配置中加入分类数组。新增独立渲染函数输出分类清单，复用现有栏目标题视觉层级，并通过响应式 CSS 将桌面左右分栏调整为移动端上下排列。

**Tech Stack:** 单文件 HTML、原生 CSS、原生 JavaScript、Playwright 冒烟测试

---

### Task 1: 为游戏经历建立失败测试

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

- [x] **Step 1: 添加配置与结构断言**

在静态断言中加入：

```js
assert(html.includes("gameHistory: ["), "about should configure game history categories");
assert(html.includes('category: "开放世界类"'), "game history should include the open-world category");
assert(html.includes('category: "竞技类游戏"'), "game history should include the competitive category");
assert(html.includes("data-game-history-category"), "game history should render category groups");
assert(html.includes("game-history-note"), "game history should support optional notes");
```

- [x] **Step 2: 添加浏览器布局断言**

在现有 `homepageGroup` 定义之后加入：

```js
const gameHistoryGroup = page.locator('[data-link-group="game-history"]');
assert(await gameHistoryGroup.count() === 1, "game history should render once");
assert((await gameHistoryGroup.boundingBox()).y < (await homepageGroup.boundingBox()).y, "game history should appear above my homepages");
assert(await gameHistoryGroup.locator('[data-game-history-category]').count() === 2, "game history should render configured categories");
assert(await gameHistoryGroup.getByText("塞尔达旷野之息", { exact: true }).count() === 1, "game names should render");
assert(await gameHistoryGroup.locator('.game-history-note').count() === 0, "empty notes should not reserve visible elements");
```

再建立一张临时配置页，验证备注确实可选配：

```js
const configuredHistoryPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await configuredHistoryPage.setContent(
  html.replace('{ title: "天国拯救 2", note: "" }', '{ title: "天国拯救 2", note: "120 小时 · 沉浸感很强" }'),
  { waitUntil: "networkidle" }
);
await configuredHistoryPage.locator('.nav-link[data-target="links"]').click();
assert(await configuredHistoryPage.getByText("120 小时 · 沉浸感很强", { exact: true }).count() === 1, "configured game notes should render");
await configuredHistoryPage.close();
```

- [x] **Step 3: 运行测试并确认失败**

Run: `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

Expected: FAIL，提示缺少 `gameHistory` 配置或游戏经历栏目。

### Task 2: 实现游戏经历配置与渲染

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:172`
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:1434`

- [x] **Step 1: 在关于页配置中加入分类内容**

```js
gameHistory: [
  {
    category: "开放世界类",
    games: [
      { title: "塞尔达旷野之息", note: "" },
      { title: "天国拯救 2", note: "" },
      { title: "巫师 3", note: "" }
    ]
  },
  {
    category: "竞技类游戏",
    games: [
      { title: "斯普拉遁 3", note: "" },
      { title: "第五人格", note: "" }
    ]
  }
],
```

- [x] **Step 2: 新增游戏与分类渲染函数**

```js
function renderGameHistoryItem(game) {
  const note = game.note
    ? `<span class="game-history-note">${escapeHTML(game.note)}</span>`
    : "";
  return `<li class="game-history-item"><span class="game-history-name">${escapeHTML(game.title)}</span>${note}</li>`;
}

function renderGameHistory(page) {
  const categories = Array.isArray(page.gameHistory) ? page.gameHistory : [];
  if (!categories.length) return "";

  return `
    <section class="link-group" data-link-group="game-history" aria-labelledby="game-history-title">
      <h2 class="link-group-title" id="game-history-title">游戏经历</h2>
      <div class="game-history-list">
        ${categories.map((group) => `
          <section class="game-history-category" data-game-history-category>
            <h3>${escapeHTML(group.category)}</h3>
            <ul>${(Array.isArray(group.games) ? group.games : []).map(renderGameHistoryItem).join("")}</ul>
          </section>
        `).join("")}
      </div>
    </section>
  `;
}
```

- [x] **Step 3: 将栏目插入“我的主页”之前**

```js
const groups = [
  renderGameHistory(page),
  renderLinkGroup("my-homepages", "我的主页", page.myHomepages, "link-card-grid", renderLinkCard)
].join("");
```

### Task 3: 完成分类清单样式与响应式布局

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:812`
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:1086`

- [x] **Step 1: 添加桌面端分类清单样式**

```css
.game-history-list {
  display: grid;
}

.game-history-category {
  display: grid;
  grid-template-columns: minmax(8em, 0.34fr) 1fr;
  gap: 1.4em;
  padding: 1.15em 0;
  border-bottom: 1px solid var(--line);
}

.game-history-category h3 {
  margin: 0;
  color: var(--accent);
  font-size: 1.12em;
  font-weight: 300;
}

.game-history-category ul {
  display: grid;
  gap: 0.72em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game-history-item {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 0.8em;
  align-items: baseline;
}

.game-history-name {
  color: #333;
  font-weight: 300;
}

.game-history-note {
  color: var(--muted);
  font-size: 0.9em;
  font-weight: 200;
}
```

- [x] **Step 2: 添加移动端上下布局**

```css
@media (max-width: 680px) {
  .game-history-category {
    grid-template-columns: 1fr;
    gap: 0.75em;
  }
}
```

- [x] **Step 3: 运行测试并确认通过**

Run: `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

Expected: `smoke checks passed`

- [x] **Step 4: 在桌面与移动视口检查栏目**

检查桌面端分类名与游戏清单左右分栏；移动端分类名在上、游戏列表在下；确认没有横向溢出，联系方式仍位于页面底部。

- [ ] **Step 5: 提交检查点**

向用户报告“游戏经历栏目”已完成和验证结果，由用户决定是否单独提交。
