# 项目图片适应展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 让项目详情图片完整显示，并使用当前图片的模糊副本美化展示框内的空白区域。

**Architecture:** 项目轮播继续通过现有详情重绘流程切换图片。每张详情图渲染一层无语义的放大背景图和一层清晰前景图；浏览器复用同一资源请求，CSS 负责背景模糊、降饱和、遮罩与前景适应。

**Tech Stack:** 单文件 HTML、原生 CSS、原生 JavaScript、Playwright 冒烟测试

---

### Task 1: 为适应展示与同步切换建立失败测试

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

- [x] **Step 1: 添加首张图片结构与样式断言**

在展开代表作后加入：

```js
const detailMedia = featuredProject.locator('[data-project-media]');
const foregroundImage = detailMedia.locator('.project-detail-image');
const backdropImage = detailMedia.locator('.project-detail-image-backdrop');
assert(await foregroundImage.count() === 1, "project detail should render a foreground image");
assert(await backdropImage.count() === 1, "project detail should render a blurred backdrop image");
assert(await foregroundImage.evaluate((element) => getComputedStyle(element).objectFit === "contain"), "foreground image should show the full image");
assert(await backdropImage.evaluate((element) => getComputedStyle(element).objectFit === "cover"), "backdrop image should fill the frame");
assert((await backdropImage.getAttribute("aria-hidden")) === "true", "decorative backdrop should be hidden from assistive technology");
assert((await foregroundImage.getAttribute("src")) === (await backdropImage.getAttribute("src")), "foreground and backdrop should use the same image");
```

- [x] **Step 2: 扩展轮播同步断言**

在点击下一张图片后加入：

```js
const nextForegroundSrc = await featuredProject.locator('.project-detail-image').getAttribute("src");
const nextBackdropSrc = await featuredProject.locator('.project-detail-image-backdrop').getAttribute("src");
assert(nextForegroundSrc === nextBackdropSrc, "carousel should switch foreground and backdrop together");
```

- [x] **Step 3: 运行测试并确认失败**

Run: `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

Expected: FAIL，提示缺少背景图片或前景仍为 `cover`。

### Task 2: 实现双层图片结构

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:1297`

- [x] **Step 1: 新增项目详情图片渲染函数**

```js
function renderProjectDetailImage(image, projectTitle) {
  if (!image?.src) return "";
  const src = escapeHTML(image.src);
  const alt = escapeHTML(image.alt || projectTitle);

  return `
    <img class="project-detail-image-backdrop" src="${src}" alt="" aria-hidden="true" loading="lazy" decoding="async" data-fallback>
    <span class="project-detail-image-wash" aria-hidden="true"></span>
    <img class="project-detail-image" src="${src}" alt="${alt}" loading="lazy" decoding="async" data-fallback>
  `;
}
```

- [x] **Step 2: 在详情展示框中使用双层结构**

将原有单图渲染替换为：

```js
${images.length && image ? renderProjectDetailImage(image, item.title) : ""}
```

轮播仍通过 `renderProjectDetail(project)` 重绘详情，因此前景、背景、计数与说明会在同一次更新中同步切换。

### Task 3: 实现毛玻璃背景与前景适应样式

**Files:**
- Modify: `Project_5_网页程序_个人网站/prototype/index.html:677`

- [x] **Step 1: 保留主题色失败回退并建立层级**

```css
.project-detail-media {
  position: relative;
  display: grid;
  place-items: center;
  isolation: isolate;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent), #fff 26%), color-mix(in srgb, var(--accent), #fff 76%));
  box-shadow: 0 0.45em 1.6em var(--accent-shadow);
}
```

- [x] **Step 2: 添加背景图、遮罩与前景图样式**

```css
.project-detail-image-backdrop {
  position: absolute;
  inset: -8%;
  width: 116%;
  height: 116%;
  object-fit: cover;
  filter: blur(24px) saturate(0.72);
  opacity: 0.68;
  transform: scale(1.08);
}

.project-detail-image-wash {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(255, 255, 255, 0.16);
}

.project-detail-image {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0.35em 0.8em rgba(30, 42, 36, 0.16));
}
```

- [x] **Step 3: 运行测试并确认通过**

Run: `node Project_5_网页程序_个人网站/prototype/smoke-test.mjs`

Expected: `smoke checks passed`

- [x] **Step 4: 进行桌面与移动端视觉验证**

分别展开包含横图、竖图和方图的项目，确认前景完整、背景无明显硬边、轮播切换后色调同步、图片说明和计数正确，浏览器控制台无错误或警告。

- [x] **Step 5: 验证图片加载失败回退**

在测试页面临时把一张详情图地址替换为无效地址，等待错误事件后确认前景与背景图被隐藏，16:9 展示框仍保留主题色渐变且布局高度不变；测试结束后不保留临时替换。

- [ ] **Step 6: 提交检查点**

向用户报告“项目图片适应展示”已完成和验证结果，由用户决定是否单独提交。
