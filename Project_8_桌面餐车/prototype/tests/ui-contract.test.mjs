import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

async function openPrototype() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const filePath = normalize(join(root, pathname === '/' ? 'index.html' : pathname.slice(1)));

    if (!filePath.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }

    try {
      if (!(await stat(filePath)).isFile()) throw new Error('not-file');
      response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });

  return { browser, page, server };
}

function closePrototype(app) {
  return async () => {
    await app.browser.close();
    await new Promise((done) => app.server.close(done));
  };
}

test('uses the floating window menu to start a selected journey and lock planning during work', async (t) => {
  const app = await openPrototype();
  t.after(closePrototype(app));

  await app.page.locator('#menu-toggle').click();
  await app.page.getByRole('button', { name: '安排' }).click();
  await app.page.getByRole('button', { name: '旅行' }).click();
  await app.page.getByRole('button', { name: '林道' }).click();
  await app.page.getByRole('button', { name: '开始专注' }).click();

  const state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'work');
  assert.deepEqual(state.activePlan, { activity: 'travel', regionId: 'forest' });
  assert.equal(await app.page.locator('#arrange-menu-button').isDisabled(), true);
  assert.equal(await app.page.locator('#pomodoro-menu-button').isDisabled(), true);
  assert.equal(await app.page.locator('#menu-toggle').isEnabled(), true);
});

test('keeps a single floating window and opens its menu without an expand control', async (t) => {
  const app = await openPrototype();
  t.after(closePrototype(app));

  assert.equal(await app.page.locator('.floating-window').count(), 1);
  assert.equal(await app.page.locator('#expand-window').count(), 0);
  await app.page.locator('#menu-toggle').click();
  assert.equal(await app.page.locator('#menu-drawer').isVisible(), true);
});

test('starts a selected activity manually when pomodoro is disabled', async (t) => {
  const app = await openPrototype();
  t.after(closePrototype(app));

  await app.page.locator('#menu-toggle').click();
  await app.page.getByRole('button', { name: '番茄钟' }).click();
  await app.page.locator('#pomodoro-toggle').uncheck();
  await app.page.getByRole('button', { name: '安排' }).click();
  await app.page.getByRole('button', { name: '旅行' }).click();
  await app.page.getByRole('button', { name: '林道' }).click();

  assert.equal(await app.page.getByRole('button', { name: '启动旅行' }).isEnabled(), true);
  await app.page.getByRole('button', { name: '启动旅行' }).click();

  const state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'free');
  assert.equal(state.pomodoroEnabled, false);
  assert.deepEqual(state.activePlan, { activity: 'travel', regionId: 'forest' });
  assert.equal(await app.page.locator('#management-status').count(), 0);
});

test('shows nonblocking transition bubbles after visible work and rest phases', async (t) => {
  const app = await openPrototype();
  t.after(closePrototype(app));

  await app.page.locator('#menu-toggle').click();
  await app.page.getByRole('button', { name: '安排' }).click();
  await app.page.getByRole('button', { name: '经营' }).click();
  await app.page.getByRole('button', { name: '开始专注' }).click();
  await app.page.evaluate(() => window.advanceTime(12000));

  let state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'rest');
  assert.deepEqual(state.lastCompletedPlan, { activity: 'operate', regionId: 'market' });
  assert.equal(await app.page.locator('.scene-note').innerText(), '餐车休息中');
  assert.match(await app.page.locator('#phase-notice').innerText(), /工作完成\s+进入休息/);

  await app.page.evaluate(() => window.advanceTime(6000));
  state = JSON.parse(await app.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.phase, 'planning');
  assert.match(await app.page.locator('#phase-notice').innerText(), /休息结束\s+安排下一段/);
});
