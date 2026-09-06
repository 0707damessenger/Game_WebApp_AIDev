import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { CONFIG } from '../js/config.mjs';

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
    assert.equal(CONFIG.board.size, 8);
    assert.equal(await page.locator('#board .cell').count(), CONFIG.board.size ** 2);
    assert.equal(await page.locator('#hand [data-card-id]').count(), 5);
    assert.equal(await page.locator('[data-mode="move"]').count(), 0);
    assert.equal(await page.locator('[data-mode="deploy"]').count(), 0);
    assert.equal(await page.locator('#confirm-action').count(), 0);
    assert.equal(await page.locator('#console-heading').count(), 0);
    assert.equal(await page.locator('#status-message').count(), 0);
    assert.equal(await page.locator('#action-hint').count(), 0);
    assert.equal(await page.locator('.scores-panel').count(), 0);
    assert.equal(await page.locator('#turn-chip').textContent(), '第 1 回合');
    assert.match(await page.locator('#turn-timer').textContent(), /30s/);

    await page.locator('#hand [data-card-id]').first().click();

    assert.equal(await page.locator('.cell.reachable-cell').count(), 2);
    assert.equal(await page.locator('[data-row="0"][data-col="0"].deploy-target').count(), 1);
    assert.equal(await page.locator('#action-hint').count(), 0);
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
    assert.match(await page.locator('#game-toast').textContent(), /再次点击确认移动/);

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
    assert.match(await page.locator('#game-toast').textContent(), /再次点击确认部署/);

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
    assert.match(await page.locator('#game-toast').textContent(), /已取消/);
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
    assert.match(await page.locator('#game-toast').textContent(), /点击当前位置部署.*移动/);
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
    assert.equal(await page.locator('#hand-overlay').isVisible(), true);
    assert.match(await page.locator('#hand-overlay').textContent(), /对方行动中/);
    assert.equal(await page.locator('#hand .card:disabled').count(), 5);
    assert.match(await page.locator('#game-toast').textContent(), /我方.*结束回合.*对方/);
    assert.doesNotMatch(await page.locator('#game-toast').textContent(), /赤方|蓝方/);
    await page.waitForTimeout(CONFIG.motion.toastMs + CONFIG.timer.tickMs + 100);
    assert.equal(await page.locator('#game-toast').isVisible(), false);
    await page.waitForTimeout(CONFIG.timer.tickMs + 100);
    assert.equal(await page.locator('#game-toast').isVisible(), false);
  } finally {
    await browser.close();
  }
});

test('locks the hand and board after both local actions are complete', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('[data-row="0"][data-col="0"]').click();
    await page.locator('#hand [data-card-id]').first().click();
    await page.locator('[data-row="0"][data-col="1"]').click();
    await page.locator('[data-row="0"][data-col="1"]').click();

    assert.equal(await page.locator('#hand .card:disabled').count(), 3);
    assert.equal(await page.locator('#end-turn').isDisabled(), false);
    assert.equal(await page.locator('#action-hint').count(), 0);

    await page.locator('[data-row="1"][data-col="1"]').click();
    assert.equal(await page.locator('.preview-locked').count(), 0);
  } finally {
    await browser.close();
  }
});

test('shows only the useful score and prompt information during play', async () => {
  const { browser, page } = await openDemo();
  try {
    assert.equal(await page.locator('.board-section > .section-heading').count(), 0);
    assert.equal(await page.locator('#board-meta').count(), 0);
    assert.equal(await page.locator('.status-panel').count(), 0);
    assert.equal(await page.locator('.players-panel').count(), 0);
    assert.equal(await page.locator('#status-message').count(), 0);
    assert.equal(await page.locator('.scores-panel').count(), 0);
    assert.equal(await page.locator('#player-list .player-row').count(), 2);
    assert.equal(await page.locator('.scores-panel .player-detail').count(), 0);
    assert.deepEqual(await page.locator('#player-list .player-name').allTextContents(), ['我方', '对方']);
    assert.equal(await page.locator('#player-list .player-row').first().getAttribute('data-relation'), 'local');
    assert.equal(await page.locator('#player-list .player-row').last().getAttribute('data-relation'), 'opponent');
    assert.match(await page.locator('#player-list .player-row').first().getAttribute('style'), /--player-color/);
  } finally {
    await browser.close();
  }
});

test('automatically ends the local turn when its action timer expires', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.evaluate(() => window.advanceTime(30001));
    const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.equal(text.activePlayerId, 'p2');
    assert.equal(text.players.find((player) => player.id === 'p1').completedTurns, 1);
    assert.equal(await page.locator('#hand-overlay').isVisible(), true);
    assert.match(await page.locator('#game-toast').textContent(), /行动时间到/);
  } finally {
    await browser.close();
  }
});

test('shows a transient start toast with the coin-selected starter', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('#start-toast').waitFor({ state: 'visible' });
    assert.match(await page.locator('#start-toast-message').textContent(), /我方.*先手/);
    await page.waitForTimeout(CONFIG.motion.turnNoticeMs + 100);
    assert.equal(await page.locator('#start-toast').isVisible(), false);
  } finally {
    await browser.close();
  }
});

test('marks the local character without adding an opponent identity marker', async () => {
  const { browser, page } = await openDemo();
  try {
    assert.equal(await page.locator('[data-row="0"][data-col="0"].local-character-cell').count(), 1);
    assert.equal(await page.locator('[data-row="0"][data-col="0"] .character-badge').textContent(), '我方');
    const lastIndex = CONFIG.board.size - 1;
    assert.equal(await page.locator(`[data-row="${lastIndex}"][data-col="${lastIndex}"] .character-badge`).count(), 0);
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
    const previewTarget = page.locator('[data-row="0"][data-col="0"]');
    assert.equal(await previewTarget.evaluate((element) => getComputedStyle(element).borderStyle), 'dashed');
    assert.equal(await previewTarget.evaluate((element) => getComputedStyle(element).borderTopColor), 'rgb(143, 90, 217)');
    assert.equal(await previewTarget.locator('.cell-card').evaluate((element) => getComputedStyle(element).outlineStyle), 'solid');
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

test('locks an empty preview cell while the local player is active and no card is selected', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('[data-row="0"][data-col="1"]').click();

    assert.equal(await page.locator('[data-row="0"][data-col="1"].preview-locked').count(), 1);
    assert.match(await page.locator('#preview-message').textContent(), /已锁定空格 1,2/);
    await page.waitForTimeout(CONFIG.timer.tickMs * 2);
    assert.equal(await page.locator('[data-row="0"][data-col="1"].preview-locked').count(), 1);
  } finally {
    await browser.close();
  }
});

test('locks the nearest preview cell when clicking an inter-cell gap', async () => {
  const { browser, page } = await openDemo();
  try {
    const leftCell = await page.locator('[data-row="0"][data-col="1"]').boundingBox();
    const rightCell = await page.locator('[data-row="0"][data-col="2"]').boundingBox();
    await page.mouse.click((leftCell.x + leftCell.width + rightCell.x) / 2, leftCell.y + leftCell.height / 2);

    assert.equal(await page.locator('.preview-locked').count(), 1);
  } finally {
    await browser.close();
  }
});

test('clicking a locked preview cell again cancels its lock', async () => {
  const { browser, page } = await openDemo();
  try {
    const cell = page.locator('[data-row="0"][data-col="1"]');
    await cell.click();
    await cell.click();

    assert.equal(await page.locator('.preview-locked').count(), 0);
    assert.match(await page.locator('#preview-message').textContent(), /悬停或点击空格开始预览/);
  } finally {
    await browser.close();
  }
});

test('clicking a different empty preview cell switches the lock', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('[data-row="0"][data-col="1"]').click();
    await page.locator('[data-row="0"][data-col="2"]').click();

    assert.equal(await page.locator('[data-row="0"][data-col="1"].preview-locked').count(), 0);
    assert.equal(await page.locator('[data-row="0"][data-col="2"].preview-locked').count(), 1);
    assert.match(await page.locator('#preview-message').textContent(), /已锁定空格 1,3/);
  } finally {
    await browser.close();
  }
});

test('keeps a preview cell in place while it is hovered', async () => {
  const { browser, page } = await openDemo();
  try {
    const cell = page.locator('[data-row="0"][data-col="1"]');
    const before = await cell.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.waitForTimeout(180);
    const after = await cell.boundingBox();

    assert.equal(after.y, before.y);
  } finally {
    await browser.close();
  }
});

test('keeps a locked preview cell after the pointer leaves the board', async () => {
  const { browser, page } = await openDemo();
  try {
    await page.locator('[data-row="0"][data-col="1"]').click();
    await page.locator('#preview-message').hover();

    assert.equal(await page.locator('[data-row="0"][data-col="1"].preview-locked').count(), 1);
    assert.match(await page.locator('#preview-message').textContent(), /已锁定空格 1,2/);
  } finally {
    await browser.close();
  }
});

test('locks the nearest preview cell when clicking the board-frame edge', async () => {
  const { browser, page } = await openDemo();
  try {
    const frame = await page.locator('.board-frame').boundingBox();
    await page.mouse.click(frame.x + 2, frame.y + 2);

    assert.equal(await page.locator('[data-row="0"][data-col="0"].preview-locked').count(), 1);
  } finally {
    await browser.close();
  }
});

test('locks a preview cell from every inner tile edge', async () => {
  const { browser, page } = await openDemo();
  try {
    const cell = page.locator('[data-row="1"][data-col="1"]');
    const rect = await cell.boundingBox();
    const edgePoints = [
      [rect.x + 2, rect.y + rect.height / 2],
      [rect.x + rect.width - 2, rect.y + rect.height / 2],
      [rect.x + rect.width / 2, rect.y + 2],
      [rect.x + rect.width / 2, rect.y + rect.height - 2],
    ];

    for (const [x, y] of edgePoints) {
      await page.mouse.click(x, y);
      assert.equal(await cell.evaluate((element) => element.classList.contains('preview-locked')), true);
      await page.mouse.click(x, y);
      assert.equal(await cell.evaluate((element) => element.classList.contains('preview-locked')), false);
    }
  } finally {
    await browser.close();
  }
});

test('locks a preview cell from its edge after a hover pause', async () => {
  const { browser, page } = await openDemo();
  try {
    const cell = page.locator('[data-row="1"][data-col="1"]');
    const rect = await cell.boundingBox();
    const x = rect.x + 2;
    const y = rect.y + rect.height / 2;

    await page.mouse.move(x, y);
    await page.waitForTimeout(180);
    await page.mouse.click(x, y);

    assert.equal(await cell.evaluate((element) => element.classList.contains('preview-locked')), true);
  } finally {
    await browser.close();
  }
});

test('locks a preview cell on pointer press at its edge', async () => {
  const { browser, page } = await openDemo();
  try {
    const cell = page.locator('[data-row="1"][data-col="1"]');
    const rect = await cell.boundingBox();
    await page.mouse.move(rect.x + 2, rect.y + rect.height / 2);
    await page.mouse.down();

    assert.equal(await cell.evaluate((element) => element.classList.contains('preview-locked')), true);
    await page.mouse.up();
  } finally {
    await browser.close();
  }
});
