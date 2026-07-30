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
const requiredNavItems = ["首页", "项目", "笔记", "链接"];

for (const item of requiredNavItems) {
  assert(html.includes(`label: "${item}"`), `missing nav item: ${item}`);
}

assert(!html.includes("写真"), "photos tab should not be present");
assert(html.includes("window.CONFIG"), "CONFIG should be the single global configuration source");
assert(html.includes("site-nav"), "navigation mount should exist");
assert(html.includes("<main id=\"app\">"), "app mount should exist");
assert(html.includes('id: "home"'), "home config should exist");
assert(html.includes('id: "projects"'), "projects config should exist");
assert(html.includes('id: "notes"'), "notes config should exist");
assert(html.includes('id: "links"'), "links config should exist");
assert(html.includes("function renderApp"), "prototype should render from CONFIG");
assert(html.includes("待填写"), "template should leave content blank with placeholders");
assert(!/<img\s/i.test(html), "prototype should use geometric placeholders instead of image assets");

console.log("smoke checks passed");
