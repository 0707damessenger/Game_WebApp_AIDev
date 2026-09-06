import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function openDemo() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:51359/?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#board');
  return { browser, page };
}

test('selecting a card exposes move targets and the deploy location without mode buttons', async () => {
  const { browser, page } = await openDemo();
  try {
    assert.equal(await page.locator('#board .cell').count(), 36);
    assert.equal(await page.locator('#hand [data-card-id]').count(), 5);
    assert.equal(await page.locator('[data-mode="move"]').count(), 0);
    assert.equal(await page.locator('[data-mode="deploy"]').count(), 0);
    assert.equal(await page.locator('#confirm-action').count(), 0);

    await page.locator('#hand [data-card-id]').first().click();

    assert.equal(await page.locator('.cell.reachable-cell').count(), 2);
    assert.equal(await page.locator('[data-row="0"][data-col="0"].deploy-target').count(), 1);
    assert.match(await page.locator('#action-hint').textContent(), /当前位置.*部署.*高亮.*移动/);
  } finally {
    await browser.close();
  }
});

test('the first move target click previews the action and the second click commits it', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="1"]').click();

    let text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(text.players.find((player) => player.id === 'p1').position, { row: 0, col: 0 });
    assert.equal(text.ownHand.length, 5);
    assert.equal(await page.locator('[data-row="0"][data-col="1"].pending-target').count(), 1);
    assert.equal(await page.locator('[data-row="0"][data-col="1"].path-cell').count(), 1);
    assert.match(await page.locator('#action-hint').textContent(), /再次点击确认移动/);

    await page.locator('[data-row="0"][data-col="1"]').click();

    text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(text.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
    assert.equal(text.ownHand.length, 4);
  } finally {
    await browser.close();
  }
});

test('the first deploy click previews the action and the second click commits it', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="0"]').click();

    let text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(text.board.find((cell) => cell.row === 0 && cell.col === 0).card, null);
    assert.equal(text.ownHand.length, 5);
    assert.match(await page.locator('#action-hint').textContent(), /再次点击确认部署/);

    await page.locator('[data-row="0"][data-col="0"]').click();

    text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    const origin = text.board.find((cell) => cell.row === 0 && cell.col === 0);
    assert.equal(origin.ownerId, 'p1');
    assert.equal(origin.card.ownerId, 'p1');
    assert.equal(text.ownHand.length, 4);
  } finally {
    await browser.close();
  }
});

test('selecting another card switches the action and Esc cancels it', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="1"]').click();
    await page.locator('#hand [data-card-id]').nth(1).click();

    assert.equal(await page.locator('[data-row="0"][data-col="1"].pending-target').count(), 0);
    assert.equal(await page.locator('#hand .selected-card').count(), 1);
    assert.equal(await page.locator('#hand [data-card-id]').nth(1).evaluate((element) => element.classList.contains('selected-card')), true);

    await page.keyboard.press('Escape');

    assert.equal(await page.locator('#hand .selected-card').count(), 0);
    assert.equal(await page.locator('.cell.reachable-cell').count(), 0);
    assert.match(await page.locator('#action-hint').textContent(), /已取消/);
  } finally {
    await browser.close();
  }
});

test('invalid target feedback leaves the real state unchanged', async () => {
  const { browser, page } = await openDemo();
  try {
    const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="1"][data-col="1"]').click();

    const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(after.players[0].position, before.players[0].position);
    assert.equal(after.ownHand.length, before.ownHand.length);
    assert.match(await page.locator('#action-hint').textContent(), /点击当前位置部署.*移动/);
  } finally {
    await browser.close();
  }
});

test('ends the local turn, switches the active player, and disables local actions while waiting', async () => {
  const { browser, page } = await openDemo();
  try {
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

test('previews an empty-cell chain while waiting without changing the real state', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('#end-turn').click();

    const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    await page.locator('[data-row="0"][data-col="1"]').hover();
    assert.equal(await page.locator('[data-row="0"][data-col="0"].preview-target').count(), 1);
    await page.locator('[data-row="0"][data-col="1"]').click();
    assert.match(await page.locator('#preview-message').textContent(), /已锁定/);
    await page.locator('[data-row="0"][data-col="0"]').hover();
    assert.match(await page.locator('#preview-message').textContent(), /连锁/);

    const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(after.board, before.board);
    assert.deepEqual(after.ownHand, before.ownHand);
    assert.deepEqual(after.players, before.players);
  } finally {
    await browser.close();
  }
});

test('does not lock a card cell as a preview position', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('#end-turn').click();
    const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

    await page.locator('[data-row="0"][data-col="0"]').click();

    const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(after.board, before.board);
    assert.match(await page.locator('#preview-message').textContent(), /不能锁定/);
  } finally {
    await browser.close();
  }
});
