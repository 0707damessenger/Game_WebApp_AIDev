import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import {
  beginTurn,
  createInitialState,
  drawCards,
  endTurn,
  getFinalResult,
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

function boardWithCards(cards, {
  deployingPlayerId = 'p1',
  deployingPosition = { row: 2, col: 2 },
  deployingCardValue = 3,
} = {}) {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  state.activePlayerId = deployingPlayerId;
  const deployingPlayer = state.players.find((player) => player.id === deployingPlayerId);
  deployingPlayer.position = { ...deployingPosition };
  deployingPlayer.hand = [{
    id: `${deployingPlayerId}-deploy-card`,
    value: deployingCardValue,
    ownerId: deployingPlayerId,
  }];
  for (const cardData of cards) {
    const cell = boardCell(state, cardData.row, cardData.col);
    cell.ownerId = cardData.ownerId;
    cell.card = {
      id: cardData.id || `board-card-${cardData.row}-${cardData.col}`,
      value: cardData.value,
      ownerId: cardData.ownerId,
    };
  }
  return state;
}

function findHandCard(state, playerId, value) {
  return state.players.find((player) => player.id === playerId).hand.find((card) => card.value === value);
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

test('same-owner equal cards chain across the complete path and keep unrelated cards', () => {
  const state = boardWithCards([
    { row: 2, col: 0, value: 3, ownerId: 'p1' },
    { row: 2, col: 2, value: 5, ownerId: 'p2', id: 'unrelated-card' },
    { row: 2, col: 4, value: 3, ownerId: 'p1' },
  ], { deployingPosition: { row: 2, col: 1 }, deployingCardValue: 3 });
  const deployCard = findHandCard(state, 'p1', 3);

  const result = performDeploy(state, 'p1', deployCard.id, CONFIG);
  const effect = result.event.effects[0];

  assert.equal(result.ok, true);
  assert.equal(effect.type, 'chain');
  assert.deepEqual(effect.path, [
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
    { row: 2, col: 3 },
    { row: 2, col: 4 },
  ]);
  assert.equal(effect.scoreDelta, 15);
  assert.equal(result.state.players[0].score, 15);
  assert.equal(boardCell(result.state, 2, 0).card, null);
  assert.equal(boardCell(result.state, 2, 1).card, null);
  assert.equal(boardCell(result.state, 2, 4).card, null);
  assert.equal(boardCell(result.state, 2, 2).card.id, 'unrelated-card');
  assert.ok(result.state.board.slice(12, 17).every((cell) => cell.ownerId === 'p1'));
});

test('different-owner equal cards consume every card on the path for the later player', () => {
  const state = boardWithCards([
    { row: 1, col: 0, value: 2, ownerId: 'p1' },
    { row: 1, col: 2, value: 2, ownerId: 'p2' },
    { row: 1, col: 1, value: 5, ownerId: 'p1', id: 'path-card' },
  ], { deployingPlayerId: 'p2', deployingPosition: { row: 1, col: 3 }, deployingCardValue: 2 });
  const deployCard = findHandCard(state, 'p2', 2);

  const result = performDeploy(state, 'p2', deployCard.id, CONFIG);
  const effect = result.event.effects[0];

  assert.equal(result.ok, true);
  assert.equal(effect.type, 'consume');
  assert.equal(effect.paintOwnerId, 'p2');
  assert.equal(effect.scoreDelta, 8);
  assert.equal(result.state.players[1].score, 8);
  assert.deepEqual(effect.removedCardIds.sort(), [
    'board-card-1-0',
    'board-card-1-2',
    'p2-deploy-card',
    'path-card',
  ].sort());
  assert.ok(result.state.board.slice(6, 10).every((cell) => cell.card === null && cell.ownerId === 'p2'));
});

test('accepts the configured four-cell empty gap and rejects a farther card', () => {
  const state = boardWithCards([
    { row: 0, col: 5, value: 4, ownerId: 'p1' },
  ], { deployingPosition: { row: 0, col: 0 }, deployingCardValue: 4 });
  const result = performDeploy(state, 'p1', findHandCard(state, 'p1', 4).id, CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.event.effects[0].scoreDelta, 24);
  assert.equal(result.event.effects[0].path.length, 6);
});

test('resolves horizontal and vertical effects from one snapshot and counts crossing paths separately', () => {
  const state = boardWithCards([
    { row: 2, col: 1, value: 3, ownerId: 'p1' },
    { row: 2, col: 3, value: 3, ownerId: 'p1' },
    { row: 1, col: 2, value: 3, ownerId: 'p1' },
    { row: 3, col: 2, value: 3, ownerId: 'p1' },
  ]);
  const result = performDeploy(state, 'p1', findHandCard(state, 'p1', 3).id, CONFIG);

  assert.equal(result.event.effects.length, 2);
  assert.ok(result.event.effects.every((effect) => effect.type === 'chain' && effect.scoreDelta === 9));
  assert.equal(result.state.players[0].score, 18);
  assert.ok([
    [1, 2], [2, 1], [2, 2], [2, 3], [3, 2],
  ].every(([row, col]) => boardCell(result.state, row, col).card === null));
});

test('does not recursively trigger a second effect from cards left on the first path', () => {
  const state = boardWithCards([
    { row: 2, col: 0, value: 3, ownerId: 'p1' },
    { row: 2, col: 1, value: 5, ownerId: 'p1', id: 'leftover-a' },
    { row: 2, col: 3, value: 5, ownerId: 'p2', id: 'leftover-b' },
    { row: 2, col: 4, value: 3, ownerId: 'p1' },
  ]);
  const result = performDeploy(state, 'p1', findHandCard(state, 'p1', 3).id, CONFIG);

  assert.equal(result.event.effects.length, 1);
  assert.equal(result.event.effects[0].type, 'chain');
  assert.equal(boardCell(result.state, 2, 1).card.id, 'leftover-a');
  assert.equal(boardCell(result.state, 2, 3).card.id, 'leftover-b');
});

test('uses the coin result to choose either player as the starter', () => {
  const firstPlayer = createInitialState({ random: () => 0, config: CONFIG });
  const secondPlayer = createInitialState({ random: () => 0.999, config: CONFIG });

  assert.equal(firstPlayer.starterId, 'p1');
  assert.equal(secondPlayer.starterId, 'p2');
  assert.equal(firstPlayer.activePlayerId, firstPlayer.starterId);
  assert.equal(secondPlayer.activePlayerId, secondPlayer.starterId);
});

test('draws two cards at turn start without exceeding the hand limit', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  state.players[0].hand = state.players[0].hand.slice(0, CONFIG.cards.handLimit - 1);
  state.players[0].actions = { moved: true, deployed: true };

  const result = beginTurn(state, 'p1', CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].hand.length, CONFIG.cards.handLimit);
  assert.deepEqual(result.state.players[0].actions, { moved: false, deployed: false });
  assert.equal(result.event.drawnCount, 1);
  assert.equal(state.players[0].hand.length, CONFIG.cards.handLimit - 1);
});

test('drawCards is capped at the hand limit and can refill an empty hand', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  state.players[0].hand = [];
  const result = drawCards(state, 'p1', 2, () => 0.999, CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.event.drawnCount, 2);
  assert.equal(result.state.players[0].hand.length, 2);
  assert.ok(result.state.players[0].hand.every((card) => card.value === 5));

  const full = drawCards(result.state, 'p1', 2, () => 0, CONFIG);
  assert.equal(full.state.players[0].hand.length, 4);
  const capped = drawCards({ ...full.state, players: full.state.players.map((player) => (
    player.id === 'p1' ? { ...player, hand: Array.from({ length: CONFIG.cards.handLimit }, (_, index) => ({
      id: `filled-${index}`,
      value: 1,
      ownerId: 'p1',
    })) } : player
  )) }, 'p1', 2, () => 0, CONFIG);
  assert.equal(capped.event.drawnCount, 0);
  assert.equal(capped.state.players[0].hand.length, CONFIG.cards.handLimit);
});

test('ends the active player turn, switches players, and rejects the waiting player', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const rejected = endTurn(state, 'p2', CONFIG);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'not-active-player');

  state.players[0].actions = { moved: true, deployed: true };
  const result = endTurn(state, 'p1', CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].completedTurns, 1);
  assert.equal(result.state.activePlayerId, 'p2');
  assert.equal(result.state.turnNumber, 1);
  assert.deepEqual(result.state.players[1].actions, { moved: false, deployed: false });
  assert.equal(result.event.nextPlayerId, 'p2');
  assert.equal(result.state.players[1].hand.length, CONFIG.cards.handLimit);
  assert.equal(state.players[0].completedTurns, 0);
});

test('increments the round after both players act and settles immediately at the turn limit', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[0].completedTurns = CONFIG.turns.turnsPerPlayer - 1;
  state.players[1].completedTurns = CONFIG.turns.turnsPerPlayer - 1;
  state.players[0].score = 20;
  state.players[1].score = 10;

  const lastFirstPlayerTurn = endTurn(state, 'p1', CONFIG);
  assert.equal(lastFirstPlayerTurn.state.phase, 'playing');
  assert.equal(lastFirstPlayerTurn.state.players[0].completedTurns, CONFIG.turns.turnsPerPlayer);
  assert.equal(lastFirstPlayerTurn.state.activePlayerId, 'p2');

  const final = endTurn(lastFirstPlayerTurn.state, 'p2', CONFIG);
  assert.equal(final.state.phase, 'finished');
  assert.equal(final.state.result.type, 'win');
  assert.equal(final.state.result.winnerId, 'p1');
  assert.equal(final.state.result.scores.p1, 20);
  assert.equal(final.state.result.scores.p2, 10);
  assert.equal(final.event.type, 'game-finished');
});

test('returns a draw when final scores are equal', () => {
  const state = createInitialState({ random: fixedRandom, config: CONFIG });
  state.players[0].score = 12;
  state.players[1].score = 12;

  const result = getFinalResult(state);

  assert.equal(result.type, 'draw');
  assert.equal(result.winnerId, null);
  assert.deepEqual(result.scores, { p1: 12, p2: 12 });
});
