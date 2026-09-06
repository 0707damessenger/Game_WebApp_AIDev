import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { CONFIG } from '../js/config.mjs';
import { createSpellatoonServer } from '../server.mjs';

test('two browser players create, join, start, and receive a private realtime move update', async () => {
  const app = createSpellatoonServer({ config: CONFIG, random: () => 0 });
  await new Promise((resolve) => app.server.listen(0, resolve));
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const host = await browser.newPage();
  const guest = await browser.newPage();
  try {
    await Promise.all([
      host.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
      guest.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
    ]);
    await host.locator('#create-room').click();
    await host.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('spellatoon-session') || 'null')?.roomId));
    const roomId = await host.evaluate(() => JSON.parse(localStorage.getItem('spellatoon-session')).roomId);

    await guest.locator('#room-id-input').fill(roomId);
    await guest.locator('#join-room').click();
    await host.locator('#start-game').waitFor({ state: 'visible' });
    await assert.doesNotReject(() => host.waitForFunction(() => !document.querySelector('#start-game').disabled));
    await host.locator('#start-game').click();
    await Promise.all([
      host.locator('#game-view').waitFor({ state: 'visible' }),
      guest.locator('#game-view').waitFor({ state: 'visible' }),
    ]);

    const hostInitial = JSON.parse(await host.evaluate(() => window.render_game_to_text()));
    const guestInitial = JSON.parse(await guest.evaluate(() => window.render_game_to_text()));
    assert.equal(hostInitial.localHand.length, CONFIG.cards.openingHand);
    assert.equal(guestInitial.localHand.length, CONFIG.cards.openingHand);
    assert.equal(JSON.stringify(hostInitial).includes(guestInitial.localHand[0].id), false);
    assert.equal(JSON.stringify(guestInitial).includes(hostInitial.localHand[0].id), false);

    await host.locator('#hand [data-card-id]').first().click();
    await host.locator('[data-mode="move"]').click();
    await host.locator('[data-row="0"][data-col="1"]').click();
    await host.locator('#confirm-action').click();
    await guest.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text());
      return state.players.find((player) => player.id === 'p1').position.col === 1;
    });
    const guestAfter = JSON.parse(await guest.evaluate(() => window.render_game_to_text()));
    assert.deepEqual(guestAfter.players.find((player) => player.id === 'p1').position, { row: 0, col: 1 });
    assert.equal(JSON.stringify(guestAfter).includes(hostInitial.localHand[0].id), false);
  } finally {
    await host.close();
    await guest.close();
    await browser.close();
    for (const stream of app.streams) stream.destroy();
    await new Promise((resolve) => app.server.close(resolve));
  }
});
