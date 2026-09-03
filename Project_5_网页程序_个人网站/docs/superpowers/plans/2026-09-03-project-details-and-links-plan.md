# 项目详情与链接页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为个人网站原型增加项目详情展开、代表作快速跳转、图片轮播、冻结交互区域，以及简洁的主页与联系方式排版。

**Architecture:** 继续沿用当前单页 `CONFIG` 驱动结构。项目只维护一份项目条目数据，代表作横排通过项目标记筛选生成，纵向列表使用同一条目渲染详情；展开状态与图片索引保存在页面状态中，并通过事件委托更新局部 DOM。链接页改为“我的主页 / 联系方式 / 朋友们”三类配置，外部主页使用可跳转名片，联系方式使用紧凑行。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js smoke test、Playwright 浏览器验证。

---

## 文件边界

- Modify: `prototype/index.html`，承载唯一全局 `CONFIG`、页面模板、样式和交互状态。
- Modify: `prototype/smoke-test.mjs`，增加项目展开、代表作跳转、轮播、冻结、链接分组和跳转属性检查。
- Modify: `docs/design.md`，仅在实现行为与已确认设计不一致时同步设计契约；当前设计已审核并提交。
- Create: `docs/superpowers/plans/2026-09-03-project-details-and-links-plan.md`，保存本实现计划。

## Task 1: 先扩展失败测试

**Files:**
- Modify: `prototype/smoke-test.mjs`

- [ ] **Step 1: 增加配置结构断言**

在已有静态断言后加入：

```js
assert(html.includes('items: ['), "projects should use one shared project item list");
assert(html.includes('isFeatured: true'), "projects should support representative work markers");
assert(html.includes('detail: {'), "projects should configure detail content");
assert(html.includes('images: ['), "project details should support multiple images");
assert(html.includes('myHomepages: ['), "links should configure my homepages separately");
assert(html.includes('contacts: ['), "links should configure contacts separately");
assert(html.includes('friends: ['), "links should configure friends separately");
```

- [ ] **Step 2: 增加项目交互断言**

在 `runBrowserChecks` 中打开项目页，点击第一个代表作，验证对应纵向项目展开；再点击第二个项目，验证前一个关闭、后一个展开；验证轮播计数和图片说明都会随左右按钮更新，并在末尾回到第一张。

测试使用这些选择器：`[data-featured-target]`、`[data-project-id]`、`[data-project-toggle]`、`[data-project-carousel]`、`[data-project-image="next"]`、`[data-image-counter]` 和 `[data-image-caption]`。

- [ ] **Step 3: 增加冻结区域断言**

项目展开后检查摘要交互区域的 `getComputedStyle(element).position` 为 `sticky`；滚动到详情中部时，摘要区域的顶部不得高于 `.site-header` 底部。

- [ ] **Step 4: 增加链接页断言**

打开链接页后检查 `[data-link-group="my-homepages"]`、`[data-link-group="contacts"]` 和 `[data-link-group="friends"]` 各自存在；外部名片检查 `target="_blank"` 与 `rel="noopener noreferrer"`；联系方式检查 `[data-contact-row]` 存在。

- [ ] **Step 5: 运行测试确认先失败**

运行：

```text
node Project_5_网页程序_个人网站/prototype/smoke-test.mjs
```

预期：失败原因指向新功能缺失，而不是语法错误或测试环境错误。

## Task 2: 重构项目配置并生成代表作横排

**Files:**
- Modify: `prototype/index.html` 的 `CONFIG.pages.projects`
- Modify: `prototype/index.html` 的项目渲染函数和项目相关 CSS

- [ ] **Step 1: 用单一数组承载项目**

将重复的 `featured` 与 `sections[].items` 改为 `items` 数组，并保留 `sections` 作为纵向分组定义。每条项目至少包含：

```js
{
  id: "project-01",
  category: "participating",
  isFeatured: true,
  title: "待填写",
  description: "内容待填写",
  imageSrc: "",
  detail: {
    description: "内容待填写",
    images: [
      { src: "", alt: "项目图片一", description: "图片说明待填写一" },
      { src: "", alt: "项目图片二", description: "图片说明待填写二" }
    ]
  }
}
```

所有条目继续使用占位内容，不伪造真实项目资料。代表作横排只从 `items.filter((item) => item.isFeatured)` 生成。

- [ ] **Step 2: 渲染代表作快速跳转区域**

每个代表作使用包含图标、标题、简介的按钮式交互模块，并写入 `data-featured-target`；不在代表作配置中重复详情数据。

- [ ] **Step 3: 渲染纵向项目骨架**

每个纵向项目渲染为同一项目条目的摘要按钮和隐藏详情容器：

```html
<article class="project-item" data-project-id="project-01">
  <button class="project-summary" type="button" data-project-toggle="project-01" aria-expanded="false">
    <span class="project-summary-visual"></span>
    <span class="project-summary-copy">
      <span class="project-summary-title">待填写</span>
      <span class="project-summary-description">内容待填写</span>
    </span>
  </button>
  <div class="project-detail" data-project-detail hidden></div>
</article>
```

- [ ] **Step 4: 运行检查确认配置阶段通过**

运行 `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`，确认配置结构断言通过；若下一项行为断言失败，继续执行 Task 3。

## Task 3: 实现项目展开、一次只展开一个和代表作跳转

**Files:**
- Modify: `prototype/index.html` 的页面状态、项目事件和项目 DOM 更新逻辑

- [ ] **Step 1: 增加项目状态**

在现有 `state` 中增加：

```js
expandedProjectId: null,
projectImageIndexes: {}
```

- [ ] **Step 2: 实现统一展开函数**

实现 `setExpandedProject(projectId)`，当前项目再次点击时传入 `null`，其它项目自动收起：

```js
function setExpandedProject(projectId) {
  const nextId = state.expandedProjectId === projectId ? null : projectId;
  state.expandedProjectId = nextId;

  document.querySelectorAll('[data-project-id]').forEach((projectElement) => {
    const isExpanded = projectElement.dataset.projectId === nextId;
    projectElement.classList.toggle('is-expanded', isExpanded);
    projectElement.querySelector('[data-project-toggle]')?.setAttribute('aria-expanded', String(isExpanded));
    const detail = projectElement.querySelector('[data-project-detail]');
    if (detail) detail.hidden = !isExpanded;
  });
}
```

- [ ] **Step 3: 实现代表作定位**

实现 `focusProject(projectId)`：调用 `setExpandedProject(projectId)` 后，用目标项目的 `getBoundingClientRect().top + window.scrollY` 减去导航高度计算位置，再调用 `window.scrollTo`；不得使用 `scrollIntoView`。

- [ ] **Step 4: 绑定点击和键盘事件**

在项目视图容器上使用事件委托处理 `[data-project-toggle]` 与 `[data-featured-target]`；摘要按钮支持 Enter 和 Space。轮播按钮优先处理，不能触发项目收起。

- [ ] **Step 5: 运行项目展开检查**

运行 `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`，确认一次只展开一个项目且代表作能跳转并展开对应条目。

## Task 4: 实现详情图片轮播与冻结交互区域

**Files:**
- Modify: `prototype/index.html` 的详情渲染、轮播更新函数和项目 CSS

- [ ] **Step 1: 渲染详情媒体区**

详情包含项目文字描述、单张图片视口、图片说明、图片计数和左右控制。没有图片时显示几何占位并隐藏控制；只有一张图片时显示图片与计数并隐藏控制。

- [ ] **Step 2: 实现首尾循环**

使用以下索引逻辑：

```js
function getWrappedImageIndex(index, imageCount) {
  return (index + imageCount) % imageCount;
}
```

切换时同时更新图片、图片说明和计数；图片加载失败时隐藏图片，几何占位继续保留。

- [ ] **Step 3: 添加冻结样式**

仅展开项目的摘要交互区域使用：

```css
.project-item.is-expanded .project-summary {
  position: sticky;
  top: var(--nav-height);
  z-index: 3;
  background: color-mix(in srgb, var(--wash), #fff 20%);
  box-shadow: 0 0.45em 1.2em rgba(34, 34, 34, 0.08);
}
```

摘要与详情保持在同一项目容器内，使冻结在详情结束时自动解除；冻结摘要仍可点击收起且不修改滚动位置。

- [ ] **Step 4: 运行项目详情检查**

运行 `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`，确认展开、跳转、轮播和冻结检查通过。

- [ ] **Step 5: 提交项目模块**

确认 `git diff --check` 和项目浏览器检查通过后提交并推送：

```text
git add Project_5_网页程序_个人网站/prototype/index.html Project_5_网页程序_个人网站/prototype/smoke-test.mjs
git commit -m "完成项目详情展开与图片轮播"
git push origin master
```

## Task 5: 重构链接页配置与简洁排版

**Files:**
- Modify: `prototype/index.html` 的 `CONFIG.pages.links`
- Modify: `prototype/index.html` 的链接渲染函数和链接相关 CSS

- [ ] **Step 1: 拆分三类配置**

使用以下配置形状，内容保留占位数据：

```js
links: {
  title: "链接",
  subtitle: "内容待填写",
  myHomepages: [
    { title: "待填写", description: "内容待填写", imageSrc: "", url: "" }
  ],
  contacts: [
    { kind: "email", label: "邮箱", value: "待填写", href: "" }
  ],
  friends: [
    { title: "待填写", description: "内容待填写", imageSrc: "", url: "" }
  ]
}
```

- [ ] **Step 2: 渲染主页与朋友名片**

有 `url` 时渲染带 `target="_blank"` 和 `rel="noopener noreferrer"` 的外部链接；没有地址时渲染非跳转容器，不使用 `href="#"`。

- [ ] **Step 3: 渲染联系方式行**

每行由小型几何图标、标签和内容组成；有 `href` 时可点击，没有地址时保持普通展示。`kind` 只控制图标形状。

- [ ] **Step 4: 隐藏空分组**

只有对应数组非空时才输出分组标题和内容，空数组不留下空白区块。

- [ ] **Step 5: 运行链接页检查**

运行 `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`，确认三类分组、名片跳转属性、联系方式行和空分组检查通过。

## Task 6: 完整响应式与回归验证

**Files:**
- Modify: `prototype/smoke-test.mjs`，只补充发现的回归断言
- Modify: `prototype/index.html`，只修复验证发现的问题

- [ ] **Step 1: 验证桌面端流程**

验证项目页代表作跳转、展开收起、切换项目、图片首尾循环、冻结区域和详情结束解除冻结。

- [ ] **Step 2: 验证移动端布局**

使用窄视口检查详情图片与文字上下排列、摘要文字不溢出、冻结区域不遮挡导航、名片与联系方式行不横向溢出。

- [ ] **Step 3: 验证页签回顶和控制台**

从页面较低位置切换首页、项目、链接，确认每次回到顶部；收起冻结项目时确认保留当前位置；确认浏览器控制台无错误和警告。

- [ ] **Step 4: 运行最终检查**

运行：

```text
node Project_5_网页程序_个人网站/prototype/smoke-test.mjs
git diff --check
git status --short --branch
```

预期：输出 `smoke checks passed`，差异检查无错误，工作区状态清晰。

- [ ] **Step 5: 提交链接模块与最终修复**

验证通过后提交并推送：

```text
git add Project_5_网页程序_个人网站/prototype/index.html Project_5_网页程序_个人网站/prototype/smoke-test.mjs
git commit -m "完成链接页分组与联系方式排版"
git push origin master
```
