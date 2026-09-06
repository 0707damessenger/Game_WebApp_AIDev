import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import { createInitialState } from '../js/rules.mjs';
import { getPlayerAtCell, stateToText } from '../js/render.mjs';

const fixedRandom = () => 0.25;

test('creates a row-major board with both diagonal characters', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });

  assert.equal(state.phase, 'playing');
  assert.equal(state.board.length, CONFIG.board.size ** 2);
  assert.deepEqual(state.board[0], { row: 0, col: 0, ownerId: null, card: null });
  assert.deepEqual(state.board.at(-1), {
    row: CONFIG.board.size - 1,
    col: CONFIG.board.size - 1,
    ownerId: null,
    card: null,
  });
  assert.deepEqual(state.players.map((player) => player.position), [
    { row: 0, col: 0 },
    { row: CONFIG.board.size - 1, col: CONFIG.board.size - 1 },
  ]);
});

test('deals each player a full opening hand using configured card values', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  const cards = state.players.flatMap((player) => player.hand);

  assert.equal(state.players.length, 2);
  for (const player of state.players) {
    assert.equal(player.hand.length, CONFIG.cards.openingHand);
    assert.ok(player.hand.every((card) => CONFIG.cards.values.includes(card.value)));
    assert.ok(player.hand.every((card) => card.ownerId === player.id));
    assert.ok(player.hand.every((card) => Object.keys(card).sort().join(',') === 'id,ownerId,value'));
  }
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  assert.ok(state.board.every((cell) => cell.card === null));
});

test('starts with available action flags, empty scores, and synchronized starter turn', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  const playerIds = new Set(CONFIG.players.map((player) => player.id));

  assert.deepEqual(state.players.map((player) => player.id), ['p1', 'p2']);
  assert.ok(state.players.every((player) => player.actions.moved === false));
  assert.ok(state.players.every((player) => player.actions.deployed === false));
  assert.ok(state.players.every((player) => player.completedTurns === 0));
  assert.ok(state.players.every((player) => player.score === 0));
  assert.ok(playerIds.has(state.starterId));
  assert.equal(state.activePlayerId, state.starterId);
  assert.equal(state.turnNumber, 1);
  assert.equal(state.result, null);
  assert.equal(state.lastEvent.type, 'game-started');
});

test('public text exposes only the local hand', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  const text = JSON.parse(stateToText(state, CONFIG.players[0].id));

  assert.deepEqual(text.localHand, state.players[0].hand);
  assert.equal(Object.hasOwn(text, 'opponentHand'), false);
  assert.equal(Object.hasOwn(text.players[0], 'hand'), false);
  assert.equal(Object.hasOwn(text.players[1], 'hand'), false);
});

test('finds a character on an unpainted cell', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });

  assert.equal(getPlayerAtCell(state, { row: 0, col: 0 }).id, 'p1');
  assert.equal(getPlayerAtCell(state, { row: 5, col: 5 }).id, 'p2');
});
