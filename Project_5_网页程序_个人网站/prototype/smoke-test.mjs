import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL(".", import.meta.url));
const htmlPath = join(root, "index.html");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(existsSync(htmlPath), "index.html should exist");

const html = readFileSync(htmlPath, "utf8");
const requiredNavItems = ["首页", "项目", "链接"];
const navConfig = html.match(/nav: \[(.*?)\n\s+\],\n\s+themes:/s)?.[1] ?? "";
const navLabelMatches = navConfig.match(/label: "/g) ?? [];

for (const item of requiredNavItems) {
  assert(html.includes(`label: "${item}"`), `missing nav item: ${item}`);
}

assert(navLabelMatches.length === 3, "navigation should contain exactly three items");
assert(!html.includes("写真"), "photos tab should not be present");
assert(html.includes("window.CONFIG"), "CONFIG should be the single global configuration source");
assert(html.includes("site-nav"), "navigation mount should exist");
assert(html.includes("<main id=\"app\">"), "app mount should exist");
assert(html.includes('id: "home"'), "home config should exist");
assert(html.includes('id: "projects"'), "projects config should exist");
assert(html.includes('id: "links"'), "links config should exist");
assert(html.includes("function renderApp"), "prototype should render from CONFIG");
assert(html.includes("待填写"), "template should leave content blank with placeholders");
assert(html.includes('iconSrc: ""'), "navigation icon paths should be configurable");
assert(html.includes('avatarSrc: ""'), "home avatar path should be configurable");
assert(html.includes('imageSrc: ""'), "content image paths should be configurable");
assert(html.includes("wave-divider"), "home view should include a water wave divider");
assert(html.includes('renderOptionalImage(item.iconSrc, "nav-icon"'), "navigation should render configured images");
assert(html.includes('renderOptionalImage(page.avatarSrc, "avatar-image"'), "home should render a configured avatar");
assert(html.includes('renderOptionalImage(item.imageSrc, "project-image"'), "projects should render configured images");
assert(html.includes('renderOptionalImage(item.imageSrc, "plain-item-image"'), "project lists should render configured images");
assert(html.includes('renderOptionalImage(item.imageSrc, "link-image"'), "links should render configured images");
assert(html.includes("bindImageFallbacks"), "configured images should fall back when loading fails");
assert(html.includes('linkText: "看看项目"'), "home summary should configure the projects link text");
assert(html.includes('linkTarget: "projects"'), "home summary should configure the projects link target");
assert(html.includes("data-view-link"), "home summary should render internal view links");
assert(html.includes("showView(link.dataset.viewLink)"), "internal view links should switch views");
assert(html.includes("function scrollToPageTop"), "prototype should provide a scroll-to-top helper");
assert(html.includes("isFeatured: true"), "projects should support representative work markers");
assert(html.includes("detail: {"), "projects should configure detail content");
assert(html.includes("images: ["), "project details should support multiple images");
assert(html.includes("data-featured-target"), "featured projects should render quick-jump targets");
assert(html.includes("data-project-toggle"), "vertical projects should render expandable summaries");
assert(html.includes("data-project-carousel"), "project details should render an image carousel");

async function assertViewChangeScrollsToTop(page, triggerSelector, expectedView) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  assert(scrollBefore > 0, "page should be scrolled before switching views");

  await page.locator(triggerSelector).click();
  await page.waitForFunction(() => window.scrollY === 0);

  const activeView = await page.locator("[data-view].is-active").getAttribute("data-view");
  assert(activeView === expectedView, `expected active view: ${expectedView}`);
}

async function runBrowserChecks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-view="home"].is-active');

    await page.locator('.nav-link[data-target="projects"]').click();
    await page.waitForSelector('[data-view="projects"].is-active');

    const featuredProjects = page.locator("[data-featured-target]");
    assert(await featuredProjects.count() >= 1, "projects should render at least one representative work");
    assert(await page.locator(".project-item[data-project-id]").count() >= 2, "projects should render at least two vertical projects");

    const featuredTarget = await featuredProjects.first().getAttribute("data-featured-target");
    assert(featuredTarget, "featured project should point to a vertical project");
    const featuredProject = page.locator(`.project-item[data-project-id="${featuredTarget}"]`);
    assert(await featuredProject.count() === 1, "featured target should match one vertical project");

    await featuredProjects.first().click();
    await page.waitForSelector(`.project-item[data-project-id="${featuredTarget}"].is-expanded`);

    const featuredCarousel = featuredProject.locator("[data-project-carousel]");
    assert(await featuredCarousel.count() === 1, "featured project should expose its detail carousel");
    const nextImageButton = featuredCarousel.locator('[data-project-image="next"]');
    const imageCounter = featuredCarousel.locator("[data-image-counter]");
    const imageCaption = featuredCarousel.locator("[data-image-caption]");
    const initialCounter = await imageCounter.textContent();
    const initialCaption = await imageCaption.textContent();
    await nextImageButton.click();
    const nextCounter = await imageCounter.textContent();
    const nextCaption = await imageCaption.textContent();
    assert(initialCounter !== nextCounter, "next image should update the image counter");
    assert(initialCaption !== nextCaption, "next image should update the image description");
    await nextImageButton.click();
    assert((await imageCounter.textContent()) === initialCounter, "next image should wrap to the first image");
    assert((await imageCaption.textContent()) === initialCaption, "wrapped image should restore its description");

    const secondProject = page.locator(".project-item[data-project-id]").nth(1);
    await secondProject.locator("[data-project-toggle]").click();
    assert(await featuredProject.evaluate((element) => !element.classList.contains("is-expanded")), "opening a project should close the previous project");
    assert(await secondProject.evaluate((element) => element.classList.contains("is-expanded")), "clicked project should expand");

    const secondSummary = secondProject.locator("[data-project-toggle]");
    assert(await secondSummary.evaluate((element) => getComputedStyle(element).position === "sticky"), "expanded project summary should be sticky");
    await secondProject.locator("[data-project-detail]").evaluate((element) => {
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY + element.offsetHeight / 3);
    });
    const stickyPosition = await secondSummary.evaluate((element) => {
      const header = document.querySelector(".site-header");
      return {
        summaryTop: Math.round(element.getBoundingClientRect().top),
        headerBottom: Math.round(header.getBoundingClientRect().bottom)
      };
    });
    assert(stickyPosition.summaryTop >= stickyPosition.headerBottom - 1, "sticky project summary should stay below the tab bar");

    await page.locator('.nav-link[data-target="home"]').click();
    await page.waitForSelector('[data-view="home"].is-active');
    await page.locator('.nav-link[data-target="links"]').click();
    await page.waitForSelector('[data-view="links"].is-active');
    assert(html.includes("myHomepages: ["), "links should configure my homepages separately");
    assert(html.includes("contacts: ["), "links should configure contacts separately");
    assert(html.includes("friends: ["), "links should configure friends separately");
    assert(html.includes("data-link-group"), "link groups should expose their category");
    assert(html.includes('target="_blank"'), "external homepage links should open in a new tab");
    assert(html.includes('rel="noopener noreferrer"'), "external homepage links should protect the opener");
    assert(await page.locator('[data-link-group="my-homepages"]').count() === 1, "my homepages group should render");
    assert(await page.locator('[data-link-group="contacts"]').count() === 0, "contacts should not render as an independent group");
    assert(await page.locator('[data-link-group="friends"]').count() === 1, "friends group should render");
    assert(await page.locator('[data-view="links"] .page-head [data-links-contacts]').count() === 1, "contacts should render beneath the links title");
    assert(await page.locator('[data-contact-row]').count() >= 1, "contacts should render compact rows");

    await assertViewChangeScrollsToTop(page, '.nav-link[data-target="projects"]', "projects");

    await page.locator('.nav-link[data-target="home"]').click();
    await page.waitForSelector('[data-view="home"].is-active');
    await assertViewChangeScrollsToTop(page, '[data-view-link="projects"]', "projects");
  } finally {
    await browser.close();
  }
}

await runBrowserChecks();

console.log("smoke checks passed");
