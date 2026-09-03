import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
const navLabelMatches = html.match(/label: "/g) ?? [];

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

console.log("smoke checks passed");
