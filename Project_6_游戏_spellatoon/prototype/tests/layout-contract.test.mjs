import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function openDemo(viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:51359/?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#board');
  return { browser, page };
}

test('desktop keeps the board and command rail in one viewport', async () => {
  const { browser, page } = await openDemo({ width: 1280, height: 720 });
  try {
    const layout = await page.evaluate(() => {
      const gameView = document.querySelector('#game-view');
      const board = document.querySelector('.board-section').getBoundingClientRect();
      const consolePanel = document.querySelector('.console-section').getBoundingClientRect();
      return {
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        columns: getComputedStyle(gameView).gridTemplateColumns,
        boardTop: board.top,
        consoleTop: consolePanel.top,
      };
    });
    assert.ok(layout.scrollHeight <= layout.viewportHeight + 2);
    assert.notEqual(layout.columns, 'none');
    assert.ok(Math.abs(layout.boardTop - layout.consoleTop) < 12);
  } finally {
    await browser.close();
  }
});

test('phone portrait keeps the board above a compact action rail', async () => {
  const { browser, page } = await openDemo({ width: 390, height: 844 });
  try {
    await page.screenshot({ path: 'C:\\Temp\\spellatoon-mobile.png', fullPage: false });
    const layout = await page.evaluate(() => {
      const board = document.querySelector('.board-section').getBoundingClientRect();
      const consolePanel = document.querySelector('.console-section').getBoundingClientRect();
      const hand = document.querySelector('.hand-panel').getBoundingClientRect();
      return {
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        boardBottom: board.bottom,
        consoleTop: consolePanel.top,
        handWidth: hand.width,
        viewportWidth: window.innerWidth,
      };
    });
    assert.ok(layout.scrollHeight <= layout.viewportHeight + 120);
    assert.ok(layout.consoleTop >= layout.boardBottom - 1);
    assert.ok(layout.handWidth >= layout.viewportWidth - 50);
  } finally {
    await browser.close();
  }
});

test('phone landscape uses the same side-by-side game layout as desktop', async () => {
  const { browser, page } = await openDemo({ width: 844, height: 390 });
  try {
    const layout = await page.evaluate(() => {
      const gameView = document.querySelector('#game-view');
      const board = document.querySelector('.board-section').getBoundingClientRect();
      const consolePanel = document.querySelector('.console-section').getBoundingClientRect();
      return {
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        columns: getComputedStyle(gameView).gridTemplateColumns,
        boardLeft: board.left,
        consoleLeft: consolePanel.left,
      };
    });
    assert.ok(layout.scrollHeight <= layout.viewportHeight + 40);
    assert.notEqual(layout.columns, 'none');
    assert.ok(layout.boardLeft < layout.consoleLeft);
  } finally {
    await browser.close();
  }
});
