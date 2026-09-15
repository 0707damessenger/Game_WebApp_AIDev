import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { createSpellatoonServer } from '../server.mjs';
const prototypeRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

async function openPage(query = '?demo') {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = normalize(join(prototypeRoot, relativePath));
    if (!filePath.startsWith(prototypeRoot)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const file = await stat(filePath);
      if (!file.isFile()) throw new Error('not-file');
      response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  server.unref();
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: 'domcontentloaded' });
  return { browser, page, server };
}

test('shows life, action points, weighted central cells, hand and end-turn control in local demo', async (t) => {
  const demo = await openPage();
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  assert.equal(await demo.page.locator('#board .cell[data-high-weight="true"]').count(), 4);
  assert.match(await demo.page.locator('#life-summary').innerText(), /生命/);
  assert.match(await demo.page.locator('#action-points').innerText(), /行动点/);
  assert.equal(await demo.page.locator('#hand .card').count(), 5);
  assert.equal(await demo.page.locator('#end-turn').isEnabled(), true);
});

test('moves and deploys through the local demo without settling life before the full round ends', async (t) => {
  const demo = await openPage();
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  let state = JSON.parse(await demo.page.evaluate(() => window.render_game_to_text()));
  assert.deepEqual(state.players[0].position, { row: 0, col: 1 });
  assert.equal(state.players[0].actionPoints, 2);
  assert.equal(state.localHand.length, 4);

  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await demo.page.locator('#end-turn').click();
  state = JSON.parse(await demo.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.activePlayerId, 'p2');
  assert.equal(state.players[1].life, 20);
  assert.equal(state.board.find((cell) => cell.row === 0 && cell.col === 1).ownerId, 'p1');
});

test('shows the weighted chain preview when hovering the selected deployment cell', async (t) => {
  const demo = await openPage();
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="0"]').click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="0"]').click();
  await demo.page.locator('#end-turn').click();
  await demo.page.locator('#end-turn').click();
  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="1"]').hover();

  assert.match(await demo.page.locator('#preview-summary').innerText(), /连锁/);
  assert.match(await demo.page.locator('#preview-summary').innerText(), /预计 \+2 分/);
});

test('supports hovering, locking and cancelling a free preview without selecting a hand card', async (t) => {
  const demo = await openPage();
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  await demo.page.locator('#hand .card').first().click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="0"]').click();
  await demo.page.locator('#board .cell[data-row="0"][data-col="0"]').click();

  const previewCell = demo.page.locator('#board .cell[data-row="0"][data-col="0"]');
  await demo.page.locator('#board .cell[data-row="0"][data-col="2"]').hover();
  assert.equal(await demo.page.locator('#board .cell.preview-target').count(), 1);

  await demo.page.locator('#board .cell[data-row="0"][data-col="2"]').click();
  assert.equal(await demo.page.locator('#board .cell.preview-locked').count(), 1);
  await previewCell.hover();
  assert.match(await demo.page.locator('#preview-summary').innerText(), /连锁预览/);
  assert.match(await demo.page.locator('#preview-summary').innerText(), /预计 \+3 分/);

  await demo.page.locator('#board .cell[data-row="0"][data-col="2"]').click();
  assert.equal(await demo.page.locator('#board .cell.preview-locked').count(), 0);
});

test('hides hands behind the single-device handoff curtain until the next player starts', async (t) => {
  const demo = await openPage('?solo');
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  assert.equal(await demo.page.locator('#handoff-dialog').isVisible(), true);
  assert.equal(await demo.page.locator('#hand-panel').isVisible(), false);
  let state = JSON.parse(await demo.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.handsVisible, false);
  assert.deepEqual(state.localHand, []);

  await demo.page.getByRole('button', { name: '开始行动' }).click();
  assert.equal(await demo.page.locator('#handoff-dialog').isVisible(), false);
  assert.equal(await demo.page.locator('#hand .card').count(), 5);
  await demo.page.locator('#end-turn').click();
  assert.equal(await demo.page.locator('#handoff-dialog').isVisible(), true);
  assert.equal(await demo.page.locator('#hand-panel').isVisible(), false);
  state = JSON.parse(await demo.page.evaluate(() => window.render_game_to_text()));
  assert.equal(state.activePlayerId, 'p2');
  assert.equal(state.handsVisible, false);
  assert.deepEqual(state.localHand, []);
});

test('enters single-device mode from the visible mode control', async (t) => {
  const demo = await openPage();
  t.after(async () => {
    await demo.browser.close();
    demo.server.closeAllConnections();
    await new Promise((resolveServer) => demo.server.close(resolveServer));
  });

  await demo.page.getByRole('button', { name: '单机双人' }).click();
  await demo.page.waitForSelector('#handoff-dialog:not([hidden])');
  assert.match(demo.page.url(), /\?solo/);
});

test('creates a LAN room from the visible lobby control', async (t) => {
  const app = createSpellatoonServer({ random: () => 0 });
  await new Promise((resolveServer) => app.server.listen(0, '127.0.0.1', resolveServer));
  const { port } = app.server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  t.after(async () => {
    await browser.close();
    for (const stream of app.streams) stream.destroy();
    await new Promise((resolveServer) => app.server.close(resolveServer));
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '创建房间' }).click();
  await page.waitForSelector('#room-status:not(:empty)');
  assert.match(await page.locator('#room-status').innerText(), /房间号：0000/);
  assert.equal(await page.locator('#start-game').isEnabled(), false);
});

test('keeps LAN hands private while both browser clients receive public moves', async (t) => {
  const app = createSpellatoonServer({ random: () => 0 });
  await new Promise((resolveServer) => app.server.listen(0, '127.0.0.1', resolveServer));
  const { port } = app.server.address();
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const host = await browser.newPage();
  const guest = await browser.newPage();
  t.after(async () => {
    await browser.close();
    for (const stream of app.streams) stream.destroy();
    await new Promise((resolveServer) => app.server.close(resolveServer));
  });

  await host.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: '创建房间' }).click();
  await host.waitForSelector('#room-status:not(:empty)');
  const roomId = (await host.locator('#room-status').innerText()).match(/\d{4}/)[0];
  await guest.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await guest.locator('#room-id-input').fill(roomId);
  await guest.getByRole('button', { name: '加入房间' }).click();
  await host.waitForFunction(() => !document.querySelector('#start-game').disabled);
  await host.locator('#start-game').click();
  await host.waitForSelector('#hand .card');
  await guest.waitForSelector('#hand .card');

  const hostState = JSON.parse(await host.evaluate(() => window.render_game_to_text()));
  const guestState = JSON.parse(await guest.evaluate(() => window.render_game_to_text()));
  assert.ok(hostState.localHand.every((card) => card.ownerId === 'p1'));
  assert.ok(guestState.localHand.every((card) => card.ownerId === 'p2'));
  assert.equal(JSON.stringify(hostState).includes('p2-card-6'), false);
  assert.equal(JSON.stringify(guestState).includes('p1-card-1'), false);

  await host.locator('#hand .card').first().click();
  await host.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await host.locator('#board .cell[data-row="0"][data-col="1"]').click();
  await guest.waitForFunction(() => JSON.parse(window.render_game_to_text()).players[0].position.col === 1);
  const updatedGuestState = JSON.parse(await guest.evaluate(() => window.render_game_to_text()));
  assert.deepEqual(updatedGuestState.players[0].position, { row: 0, col: 1 });
});
