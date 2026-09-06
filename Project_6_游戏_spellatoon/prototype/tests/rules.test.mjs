import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import {
  createInitialState,
  getReachableCells,
  performDeploy,
  performMove,
} from '../js/rules.mjs';
import { getPlayerAtCell, stateToText } from '../js/render.mjs';

const fixedRandom = () => 0.25;

function stateWithPlayerHandAt({
  playerId = 'p1',
  cardValue = 3,
  position = { row: 0, col: 0 },
  activePlayerId = playerId,
} = {}) {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  const player = state.players.find((candidate) => candidate.id === playerId);
  player.position = position;
  player.hand = [{ id: `${playerId}-test-card`, value: cardValue, ownerId: playerId }];
  state.activePlayerId = activePlayerId;
  return state;
}

function boardCell(state, row, col) {
  return state.board.find((cell) => cell.row === row && cell.col === col);
}

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

test('allows a card move to turn and consumes the selected card', () => {
  const state = stateWithPlayerHandAt({ cardValue: 3 });
  const cardId = state.players[0].hand[0].id;
  const result = performMove(state, 'p1', cardId, [
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ], CONFIG);

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.players[0].position, { row: 1, col: 2 });
  assert.equal(result.state.players[0].hand.length, 0);
  assert.equal(result.state.players[0].actions.moved, true);
  assert.equal(state.players[0].actions.moved, false);
});

test('allows movement through an occupied card cell and exposes reachable cells', () => {
  const state = stateWithPlayerHandAt({ cardValue: 3 });
  boardCell(state, 0, 1).card = { id: 'public-card', value: 4, ownerId: 'p2' };
  const cardId = state.players[0].hand[0].id;
  const reachable = getReachableCells(state, 'p1', cardId, CONFIG);
  const result = performMove(state, 'p1', cardId, [
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ], CONFIG);

  assert.ok(reachable.some((cell) => cell.row === 0 && cell.col === 2));
  assert.equal(result.ok, true);
});

test('rejects an overlong or out-of-board path without changing state', () => {
  const state = stateWithPlayerHandAt({ cardValue: 2 });
  const result = performMove(state, 'p1', state.players[0].hand[0].id, [
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ], CONFIG);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'move-distance');
  assert.equal(state.players[0].hand.length, 1);
  assert.equal(state.players[0].actions.moved, false);

  const outside = performMove(state, 'p1', state.players[0].hand[0].id, [{ row: -1, col: 0 }], CONFIG);
  assert.equal(outside.ok, false);
  assert.equal(outside.reason, 'move-distance');
});

test('rejects a non-adjacent path, missing card, waiting player, and repeated move', () => {
  const state = stateWithPlayerHandAt({ cardValue: 3 });
  const cardId = state.players[0].hand[0].id;
  assert.equal(performMove(state, 'p1', cardId, [{ row: 1, col: 1 }], CONFIG).reason, 'move-distance');
  assert.equal(performMove(state, 'p1', 'missing-card', [{ row: 0, col: 1 }], CONFIG).reason, 'card-not-found');
  assert.equal(performMove(state, 'p2', cardId, [{ row: 5, col: 4 }], CONFIG).reason, 'not-active-player');

  const moved = performMove(state, 'p1', cardId, [{ row: 0, col: 1 }], CONFIG);
  assert.equal(moved.ok, true);
  assert.equal(performMove(moved.state, 'p1', 'missing-card', [{ row: 0, col: 2 }], CONFIG).reason, 'move-used');
});

test('deploys on the active character cell and paints it', () => {
  const state = stateWithPlayerHandAt({ cardValue: 4, position: { row: 2, col: 3 } });
  const result = performDeploy(state, 'p1', state.players[0].hand[0].id, CONFIG);
  const deployedCell = boardCell(result.state, 2, 3);

  assert.equal(result.ok, true);
  assert.equal(deployedCell.ownerId, 'p1');
  assert.deepEqual(deployedCell.card, { id: 'p1-test-card', value: 4, ownerId: 'p1' });
  assert.equal(result.state.players[0].hand.length, 0);
  assert.equal(result.state.players[0].actions.deployed, true);
  assert.equal(state.board[15].card, null);
});

test('rejects deployment on an occupied cell, for a waiting player, or after deployment', () => {
  const state = stateWithPlayerHandAt({ cardValue: 2, position: { row: 1, col: 1 } });
  boardCell(state, 1, 1).card = { id: 'existing', value: 1, ownerId: 'p2' };
  const occupied = performDeploy(state, 'p1', state.players[0].hand[0].id, CONFIG);
  assert.equal(occupied.ok, false);
  assert.equal(occupied.reason, 'occupied-cell');
  assert.equal(state.players[0].hand.length, 1);

  const waiting = stateWithPlayerHandAt({ cardValue: 2, activePlayerId: 'p2' });
  assert.equal(performDeploy(waiting, 'p1', waiting.players[0].hand[0].id, CONFIG).reason, 'not-active-player');

  const deployed = performDeploy(waiting, 'p2', waiting.players[1].hand[0].id, CONFIG);
  assert.equal(deployed.ok, true);
  assert.equal(performDeploy(deployed.state, 'p2', 'missing-card', CONFIG).reason, 'deploy-used');
});
