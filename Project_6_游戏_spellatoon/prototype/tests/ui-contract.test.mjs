import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

test('exposes action controls and commits a turning move from the local hand', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:51359/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#board');
    assert.equal(await page.locator('#board .cell').count(), 36);
    assert.equal(await page.locator('#action-controls').count(), 1);
    assert.equal(await page.locator('[data-mode="move"]').count(), 1);
    assert.equal(await page.locator('[data-mode="deploy"]').count(), 1);
    assert.equal(await page.locator('#hand [data-card-id]').count(), 5);

    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-mode="move"]').click();
    await page.locator('[data-row="0"][data-col="1"]').click();
    await page.locator('#confirm-action').click();

    const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(text.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
    assert.equal(text.ownHand.length, 4);
  } finally {
    await browser.close();
  }
});

test('deploys the selected card on the character cell and paints it', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:51359/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#board');
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-mode="deploy"]').click();

    assert.equal(await page.locator('[data-row="0"][data-col="0"].deploy-target').count(), 1);
    await page.locator('[data-row="0"][data-col="0"]').click();

    const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const origin = text.board.find((cell) => cell.row === 0 && cell.col === 0);
    assert.equal(origin.ownerId, 'p1');
    assert.equal(origin.card.ownerId, 'p1');
    assert.equal(text.ownHand.length, 4);
    assert.match(await page.locator('#action-hint').textContent(), /部署了数字/);
  } finally {
    await browser.close();
  }
});

test('shows feedback and keeps the state unchanged after an invalid move click', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:51359/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#board');
    const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-mode="move"]').click();
    await page.locator('[data-row="1"][data-col="1"]').click();

    const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(after.players[0].position, before.players[0].position);
    assert.equal(after.ownHand.length, before.ownHand.length);
    assert.match(await page.locator('#action-hint').textContent(), /逐格横向或纵向/);
  } finally {
    await browser.close();
  }
});

test('ends the local turn, switches the active player, and disables local actions while waiting', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:51359/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#board');
    await page.locator('#end-turn').click();

    const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(text.activePlayerId, 'p2');
    assert.equal(text.players.find((player) => player.id === 'p1').completedTurns, 1);
    assert.equal(await page.locator('#end-turn').isDisabled(), true);
    assert.match(await page.locator('#status-message').textContent(), /结束回合/);
  } finally {
    await browser.close();
  }
});
