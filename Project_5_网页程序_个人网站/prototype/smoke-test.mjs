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
const requiredNavIds = ["home", "projects", "links"];
const navConfig = html.match(/nav: \[(.*?)\n\s+\],\n\s+themes:/s)?.[1] ?? "";
const navLabelMatches = navConfig.match(/label: "/g) ?? [];

for (const id of requiredNavIds) {
  assert(html.includes(`id: "${id}"`), `missing nav item: ${id}`);
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
assert(html.includes("avatarSrc:"), "home avatar path should be configurable");
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
assert(html.includes("function syncHeaderScrollState"), "prototype should synchronize the header appearance with scroll position");
assert(html.includes("site-header.is-scrolled"), "header should define a scrolled transparent-glass state");
assert(html.includes('history.scrollRestoration = "manual"'), "prototype should disable browser scroll restoration on refresh");
assert(html.includes("margin-bottom: calc(-1 * (var(--nav-height) + 1px))"), "transparent header should overlay page content without adding scroll height");
assert(!html.includes("friends: ["), "links should not configure a friends group");
assert(html.includes('kind: "wechat"'), "links should configure a WeChat contact");
assert(html.includes('kind: "feishu"'), "links should configure a Feishu contact");
assert(html.includes('kind: "steam"'), "links should configure a Steam contact");
assert(html.includes('iconSrc: ""'), "contacts should support configurable icon paths");
assert(html.includes('data-kind="wechat"'), "WeChat should have a flat contact icon");
assert(html.includes('data-kind="feishu"'), "Feishu should have a flat contact icon");
assert(html.includes('data-kind="steam"'), "Steam should have a flat contact icon");
assert(html.includes("contact-icon is-custom"), "configured contact icons should replace the fallback icon");
assert(html.includes("contact-icon-image"), "configured contact icons should render as images");
assert(html.includes("hoverImageSrc:"), "contacts should support configurable hover images");
assert(html.includes("contact-hover-media"), "configured hover images should render a preview surface");
assert(html.includes("data-contact-preview"), "hover previews should be anchored to the contacts strip");
assert(html.includes("links-content"), "links should provide a bottom-aligned content layout");
assert(html.includes("isFeatured: true"), "projects should support representative work markers");
assert(html.includes("detail: {"), "projects should configure detail content");
assert(html.includes("images: ["), "project details should support multiple images");
assert(html.includes("data-featured-target"), "featured projects should render quick-jump targets");
assert(html.includes("data-project-toggle"), "vertical projects should render expandable summaries");
assert(html.includes("data-project-carousel"), "project details should render an image carousel");
assert(html.includes("等工作。\\n从零到一"), "project detail descriptions should support configured line breaks");

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

    const header = page.locator(".site-header");
    const appTop = await page.locator("#app").evaluate((element) => Math.round(element.getBoundingClientRect().top));
    assert(appTop <= 1, "transparent header should overlay the page content at the top");
    assert(await header.evaluate((element) => !element.classList.contains("is-scrolled")), "header should start transparent before scrolling");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelector(".site-header")?.classList.contains("is-scrolled"));
    assert(await header.evaluate((element) => getComputedStyle(element).backdropFilter !== "none"), "scrolled header should add blur for readability");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => !document.querySelector(".site-header")?.classList.contains("is-scrolled"));

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => window.scrollY > 0);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => window.scrollY === 0 && !document.querySelector(".site-header")?.classList.contains("is-scrolled"));

    await page.locator('.nav-link[data-target="projects"]').click();
    await page.waitForSelector('[data-view="projects"].is-active');

    const featuredProjects = page.locator("[data-featured-target]");
    assert(await featuredProjects.count() >= 1, "projects should render at least one representative work");
    assert(await page.locator("[data-featured-target] h2").count() === await featuredProjects.count(), "featured projects should render their titles");
    assert(await page.locator("[data-featured-target] p").count() === 0, "featured projects should hide their descriptions");
    assert(await page.locator(".project-item[data-project-id]").count() >= 2, "projects should render at least two vertical projects");

    const featuredTarget = await featuredProjects.first().getAttribute("data-featured-target");
    assert(featuredTarget, "featured project should point to a vertical project");
    const featuredProject = page.locator(`.project-item[data-project-id="${featuredTarget}"]`);
    assert(await featuredProject.count() === 1, "featured target should match one vertical project");

    await featuredProjects.first().click();
    await page.waitForSelector(`.project-item[data-project-id="${featuredTarget}"].is-expanded`);

    await featuredProjects.first().scrollIntoViewIfNeeded();
    await featuredProjects.first().click();
    await page.waitForFunction(({ target }) => {
      const project = document.querySelector(`.project-item[data-project-id="${target}"]`);
      const header = document.querySelector(".site-header");
      return project?.classList.contains("is-expanded") && Math.abs(project.getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 1;
    }, { target: featuredTarget });

    const projectDescription = featuredProject.locator("[data-project-detail] .project-detail-copy p");
    assert((await projectDescription.textContent()).includes("\n"), "project detail description should render a configured line break");
    assert(await projectDescription.evaluate((element) => getComputedStyle(element).whiteSpace === "pre-line"), "project detail description should preserve configured line breaks");

    const featuredCarousel = featuredProject.locator("[data-project-carousel]");
    assert(await featuredCarousel.count() === 1, "featured project should expose its detail carousel");
    assert(await featuredProject.locator("[data-project-visit]").count() === 0, "projects without a website should hide the visit link");
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

    const websiteUrl = "https://example.com/project-01";
    const configuredPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await configuredPage.setContent(html.replace('websiteUrl: ""', `websiteUrl: "${websiteUrl}"`), { waitUntil: "networkidle" });
    await configuredPage.locator('.nav-link[data-target="projects"]').click();
    const configuredFeaturedTarget = await configuredPage.locator("[data-featured-target]").first().getAttribute("data-featured-target");
    const configuredProject = configuredPage.locator(`.project-item[data-project-id="${configuredFeaturedTarget}"]`);
    await configuredPage.locator("[data-featured-target]").first().click();
    const visitLink = configuredProject.locator("[data-project-visit]");
    assert(await visitLink.count() === 1, "projects with a website should show the visit link");
    assert(await visitLink.getAttribute("href") === websiteUrl, "visit link should use the configured website");
    assert(await visitLink.getAttribute("target") === "_blank", "visit link should open in a new tab");
    await configuredPage.close();

    await page.locator('.nav-link[data-target="home"]').click();
    await page.waitForSelector('[data-view="home"].is-active');
    await page.locator('.nav-link[data-target="links"]').click();
    await page.waitForSelector('[data-view="links"].is-active');
    await page.waitForTimeout(250);
    assert(html.includes("myHomepages: ["), "links should configure my homepages separately");
    assert(html.includes("contacts: ["), "links should configure contacts separately");
    assert(html.includes("data-link-group"), "link groups should expose their category");
    assert(html.includes('target="_blank"'), "external homepage links should open in a new tab");
    assert(html.includes('rel="noopener noreferrer"'), "external homepage links should protect the opener");
    assert(await page.locator('[data-link-group="my-homepages"]').count() === 1, "my homepages group should render");
    assert(await page.locator('[data-link-group="contacts"]').count() === 0, "contacts should not render as an independent group");
    assert(await page.locator('[data-link-group="friends"]').count() === 0, "friends group should not render");
    const homepageGroup = page.locator('[data-link-group="my-homepages"]');
    const contactsStrip = page.locator('[data-view="links"] [data-links-contacts]');
    const linksContent = page.locator('[data-view="links"] .links-content');
    assert(await page.locator('[data-view="links"] .page-head [data-links-contacts]').count() === 0, "contacts should not render in the page heading");
    assert(await contactsStrip.count() === 1, "contacts should render after the homepage cards");
    assert((await contactsStrip.boundingBox()).y > (await homepageGroup.boundingBox()).y, "contacts should appear below my homepages");
    assert(await contactsStrip.evaluate((element) => getComputedStyle(element).justifyContent === "center"), "contacts should be centered");
    assert(await linksContent.evaluate((element) => getComputedStyle(element).display === "flex"), "links content should reserve bottom placement for contacts");
    const contactsBox = await contactsStrip.boundingBox();
    const contentBox = await linksContent.boundingBox();
    const bottomGap = contentBox.y + contentBox.height - (contactsBox.y + contactsBox.height);
    assert(bottomGap < 75, `contacts should stay near the bottom of the links content: ${bottomGap}`);
    const linksMetrics = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      headerHeight: document.querySelector('.site-header').getBoundingClientRect().height,
      linksViewTop: document.querySelector('[data-view="links"]').getBoundingClientRect().top,
      linksViewHeight: document.querySelector('[data-view="links"]').getBoundingClientRect().height,
      pageHeadHeight: document.querySelector('[data-view="links"] .page-head').getBoundingClientRect().height,
      linksContentHeight: document.querySelector('[data-view="links"] .links-content').getBoundingClientRect().height,
      contactsBottom: document.querySelector('[data-links-contacts]').getBoundingClientRect().bottom,
      linksContentBottom: document.querySelector('[data-view="links"] .links-content').getBoundingClientRect().bottom
    }));
    assert(linksMetrics.documentHeight <= linksMetrics.viewportHeight, `links should not scroll when its content fits within one screen: ${JSON.stringify(linksMetrics)}`);
    assert(await page.locator('[data-contact-row]').count() === 4, "links should render four compact contact rows");
    assert(await page.locator('[data-contact-row] .contact-icon.is-custom').count() === 4, "configured contact icons should render at the standard size");
    assert(await page.locator('[data-contact-hover]').count() === 2, "configured contact hover images should render previews");
    const initialHoverPreviews = page.locator('[data-contact-hover]');
    for (let index = 0; index < await initialHoverPreviews.count(); index += 1) {
      const preview = initialHoverPreviews.nth(index);
      assert(await preview.evaluate((element) => element.hidden && getComputedStyle(element).display === "none"), "contact hover previews should be fully hidden on entry");
    }

    const liveWechatRow = page.locator('[data-contact-preview-target="wechat"]');
    const liveWechatPreview = page.locator('[data-contact-preview="wechat"]');
    await liveWechatRow.hover();
    await page.waitForFunction(() => !document.querySelector('[data-contact-preview="wechat"]')?.hidden);
    const livePreviewBox = await liveWechatPreview.boundingBox();
    const livePreviewImage = liveWechatPreview.locator('.contact-hover-image');
    const liveImageMetrics = await livePreviewImage.evaluate((image) => ({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: image.getBoundingClientRect().width,
      renderedHeight: image.getBoundingClientRect().height
    }));
    const expectedRenderedHeight = liveImageMetrics.renderedWidth * liveImageMetrics.naturalHeight / liveImageMetrics.naturalWidth;
    assert(Math.abs(liveImageMetrics.renderedHeight - expectedRenderedHeight) <= 1, "hover previews should use each image's natural aspect ratio");
    const liveContactsBox = await contactsStrip.boundingBox();
    assert(Math.abs(livePreviewBox.y + livePreviewBox.height - liveContactsBox.y) <= 2, "hover preview bottom should align with the contacts divider");
    await page.mouse.move(liveContactsBox.x + 2, liveContactsBox.y + 2);
    await page.waitForFunction(() => document.querySelector('[data-contact-preview="wechat"]')?.hidden);
    assert(await liveWechatPreview.evaluate((element) => element.hidden), "hover preview should hide immediately after leaving its contact row");

    const customIconDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    const qrCodeDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    const configuredContactsPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await configuredContactsPage.setContent(
      html
        .replace('iconSrc: "assets/links/mail.png"', `iconSrc: "${customIconDataUrl}"`)
        .replace('hoverImageSrc: "assets/links/wechat1.png", hoverImageAlt: "微信二维码"', `hoverImageSrc: "${qrCodeDataUrl}", hoverImageAlt: "微信二维码"`),
      { waitUntil: "networkidle" }
    );
    await configuredContactsPage.locator('.nav-link[data-target="links"]').click();
    const customIcon = configuredContactsPage.locator('[data-contact-row]').first().locator('.contact-icon.is-custom');
    const comparisonIcon = configuredContactsPage.locator('[data-contact-row]').nth(1).locator('.contact-icon.is-custom');
    assert(await customIcon.count() === 1, "configured contact icon should replace the fallback icon");
    assert(await customIcon.locator('.contact-icon-image').getAttribute("src") === customIconDataUrl, "configured contact icon should use its configured path");
    assert(await customIcon.evaluate((element) => Math.round(element.getBoundingClientRect().width)) === await comparisonIcon.evaluate((element) => Math.round(element.getBoundingClientRect().width)), "custom contact icons should retain the standard icon width");
    assert(await customIcon.evaluate((element) => Math.round(element.getBoundingClientRect().height)) === await comparisonIcon.evaluate((element) => Math.round(element.getBoundingClientRect().height)), "custom contact icons should retain the standard icon height");
    const wechatRow = configuredContactsPage.locator('[data-contact-row]').nth(1);
    const configuredContactsStrip = configuredContactsPage.locator('[data-links-contacts]');
    const hoverPreview = configuredContactsStrip.locator('[data-contact-preview="wechat"]');
    assert(await hoverPreview.count() === 1, "configured hover image should render a preview");
    assert(await hoverPreview.locator('.contact-hover-image').getAttribute("src") === qrCodeDataUrl, "hover preview should use its configured image path");
    assert(await hoverPreview.evaluate((element) => element.hidden), "hover preview should start hidden");
    await wechatRow.hover();
    await configuredContactsPage.waitForFunction(() => document.querySelector('[data-contact-preview="wechat"]')?.classList.contains("is-visible"));
    assert(await hoverPreview.evaluate((element) => !element.hidden), "hover preview should appear when its contact is hovered");
    const previewBox = await hoverPreview.boundingBox();
    const contactsStripBox = await configuredContactsStrip.boundingBox();
    assert(Math.abs(previewBox.y + previewBox.height - contactsStripBox.y) <= 2, "hover preview bottom should align with the contacts divider");
    await configuredContactsPage.close();

    const noHoverImagesPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await noHoverImagesPage.setContent(
      html
        .replaceAll('hoverImageSrc: "assets/links/wechat1.png"', 'hoverImageSrc: ""')
        .replaceAll('hoverImageSrc: "assets/links/feishu1.png"', 'hoverImageSrc: ""'),
      { waitUntil: "networkidle" }
    );
    await noHoverImagesPage.locator('.nav-link[data-target="links"]').click();
    assert(await noHoverImagesPage.locator('[data-contact-hover]').count() === 0, "contacts without configured hover images should not render previews");
    await noHoverImagesPage.close();

    await page.locator('.nav-link[data-target="home"]').click();
    await page.waitForSelector('[data-view="home"].is-active');
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
