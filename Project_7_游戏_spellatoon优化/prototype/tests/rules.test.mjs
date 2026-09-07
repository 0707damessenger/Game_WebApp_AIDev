import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import { beginTurn, createInitialState } from '../js/rules.mjs';

test('creates mirrored players with life, action points, hands, and central high-weight cells', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });

  assert.deepEqual(
    state.players.map((player) => player.life),
    [CONFIG.life.initial, CONFIG.life.initial],
  );
  assert.deepEqual(
    state.players.map((player) => player.actionPoints),
    [CONFIG.actions.initial, CONFIG.actions.initial],
  );
  assert.equal(state.board.filter((cell) => cell.isHighWeight).length, 4);
  assert.ok(state.players.every((player) => player.hand.length === CONFIG.cards.openingHand));
});

test('restores stored action points up to the cap and draws two cards without exceeding the hand limit', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[0].actionPoints = 1;
  state.players[0].hand = state.players[0].hand.slice(0, 2);

  const result = beginTurn(state, 'p1', CONFIG, () => 0.999);

  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].actionPoints, CONFIG.actions.limit);
  assert.equal(result.state.players[0].hand.length, 4);
  assert.equal(result.event.drawnCount, CONFIG.cards.drawPerTurn);
});
