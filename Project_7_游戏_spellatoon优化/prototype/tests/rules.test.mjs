import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import {
  beginTurn,
  createInitialState,
  endTurn,
  getPreviewTargets,
  getReachableCells,
  lockPreviewCell,
  performDeploy,
  performMove,
  previewDeployment,
  settleTerritoryDamage,
  simulatePreview,
} from '../js/rules.mjs';

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

test('uses central tiles twice when comparing territory and damages only the trailing player', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.board.find((cell) => cell.row === 3 && cell.col === 3).ownerId = 'p1';
  state.board.find((cell) => cell.row === 0 && cell.col === 0).ownerId = 'p2';

  const result = settleTerritoryDamage(state, CONFIG);

  assert.deepEqual(result.territory, { p1: 2, p2: 1 });
  assert.equal(result.state.players[0].life, CONFIG.life.initial);
  assert.equal(result.state.players[1].life, CONFIG.life.initial - 1);
});

test('ends immediately when territory damage reduces life to zero', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[1].life = 1;
  state.board.find((cell) => cell.row === 3 && cell.col === 3).ownerId = 'p1';

  const result = settleTerritoryDamage(state, CONFIG);

  assert.equal(result.state.phase, 'finished');
  assert.equal(result.state.result.type, 'life-defeat');
  assert.equal(result.state.result.winnerId, 'p1');
});

test('lists legal orthogonal movement destinations within the selected card distance', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const cardId = state.players[0].hand[0].id;

  const destinations = getReachableCells(state, 'p1', cardId, CONFIG);

  assert.deepEqual(destinations, [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ]);
});

test('allows repeated action types while cards and action points remain', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[0].hand = state.players[0].hand.slice(0, 3);

  const first = performMove(state, 'p1', state.players[0].hand[0].id, [{ row: 0, col: 1 }], CONFIG);
  const second = performDeploy(first.state, 'p1', first.state.players[0].hand[0].id, CONFIG);
  const third = performMove(second.state, 'p1', second.state.players[0].hand[0].id, [{ row: 0, col: 2 }], CONFIG);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, true);
  assert.equal(third.state.players[0].actionPoints, 0);
  assert.equal(third.state.players[0].hand.length, 0);
  assert.deepEqual(third.state.players[0].position, { row: 0, col: 2 });
  assert.equal(
    performMove(third.state, 'p1', 'missing', [{ row: 0, col: 3 }], CONFIG).reason,
    'no-action-points',
  );
});

test('counts a central tile twice when calculating a chain score', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const player = state.players[0];
  player.position = { row: 3, col: 3 };
  player.hand = [{ id: 'p1-chain-card', ownerId: 'p1', value: 2 }];
  state.board.find((cell) => cell.row === 3 && cell.col === 1).ownerId = 'p1';
  state.board.find((cell) => cell.row === 3 && cell.col === 1).card = {
    id: 'p1-existing-card',
    ownerId: 'p1',
    value: 2,
  };

  const result = performDeploy(state, 'p1', 'p1-chain-card', CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.event.effects[0].type, 'chain');
  assert.equal(result.event.effects[0].scoreDelta, 8);
  assert.equal(result.state.players[0].score, 8);
});

test('consumes mixed-owner matching cards, paints the full path, and weights its score', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const player = state.players[0];
  player.position = { row: 3, col: 3 };
  player.hand = [{ id: 'p1-consume-card', ownerId: 'p1', value: 2 }];
  const enemyCardCell = state.board.find((cell) => cell.row === 3 && cell.col === 1);
  enemyCardCell.ownerId = 'p2';
  enemyCardCell.card = { id: 'p2-existing-card', ownerId: 'p2', value: 2 };

  const result = performDeploy(state, 'p1', 'p1-consume-card', CONFIG);

  assert.equal(result.ok, true);
  assert.equal(result.event.effects[0].type, 'consume');
  assert.equal(result.event.effects[0].scoreDelta, 8);
  assert.deepEqual(
    result.state.board.filter((cell) => cell.row === 3 && cell.col >= 1 && cell.col <= 3)
      .map((cell) => ({ ownerId: cell.ownerId, card: cell.card })),
    [
      { ownerId: 'p1', card: null },
      { ownerId: 'p1', card: null },
      { ownerId: 'p1', card: null },
    ],
  );
});

test('previews the selected deployment effect without changing the real board', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[0].position = { row: 3, col: 3 };
  state.players[0].hand = [{ id: 'p1-preview-card', ownerId: 'p1', value: 2 }];
  const existingCell = state.board.find((cell) => cell.row === 3 && cell.col === 1);
  existingCell.ownerId = 'p1';
  existingCell.card = { id: 'p1-existing-card', ownerId: 'p1', value: 2 };

  const preview = previewDeployment(state, 'p1', 'p1-preview-card', CONFIG);

  assert.equal(preview.ok, true);
  assert.equal(preview.effects[0].type, 'chain');
  assert.equal(preview.scoreDelta, 8);
  assert.equal(state.board.find((cell) => cell.row === 3 && cell.col === 3).card, null);
  assert.equal(existingCell.card.id, 'p1-existing-card');
});

test('finds deployed cards aligned with an arbitrary empty preview cell and only locks an empty cell', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const linkedCell = state.board.find((cell) => cell.row === 3 && cell.col === 1);
  linkedCell.ownerId = 'p2';
  linkedCell.card = { id: 'p2-preview-target', ownerId: 'p2', value: 2 };
  const occupiedCell = state.board.find((cell) => cell.row === 2 && cell.col === 3);
  occupiedCell.ownerId = 'p1';
  occupiedCell.card = { id: 'p1-occupied', ownerId: 'p1', value: 1 };

  const targets = getPreviewTargets(state, { row: 3, col: 3 }, CONFIG);

  assert.deepEqual(targets.map((target) => target.cell), [
    { row: 2, col: 3 },
    { row: 3, col: 1 },
  ]);
  assert.deepEqual(lockPreviewCell(state, { row: 3, col: 3 }, CONFIG), {
    ok: true,
    previewCell: { row: 3, col: 3 },
  });
  assert.deepEqual(lockPreviewCell(state, { row: 2, col: 3 }, CONFIG), {
    ok: false,
    reason: 'occupied-cell',
  });
});

test('simulates a target card at a locked cell without changing the real board', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  const linkedCell = state.board.find((cell) => cell.row === 3 && cell.col === 1);
  linkedCell.ownerId = 'p1';
  linkedCell.card = { id: 'p1-preview-target', ownerId: 'p1', value: 2 };

  const preview = simulatePreview(state, 'p1', { row: 3, col: 3 }, { row: 3, col: 1 }, CONFIG);

  assert.equal(preview.ok, true);
  assert.equal(preview.effects[0].type, 'chain');
  assert.equal(preview.scoreDelta, 8);
  assert.equal(state.board.find((cell) => cell.row === 3 && cell.col === 3).card, null);
  assert.deepEqual(linkedCell.card, { id: 'p1-preview-target', ownerId: 'p1', value: 2 });
});

test('settles territory damage only after both players finish an entire round', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.board.find((cell) => cell.row === 3 && cell.col === 3).ownerId = 'p1';
  state.board.find((cell) => cell.row === 0 && cell.col === 0).ownerId = 'p2';
  state.players[1].actionPoints = 1;
  state.players[1].hand = state.players[1].hand.slice(0, 2);

  const firstEnd = endTurn(state, 'p1', CONFIG, () => 0);
  const secondEnd = endTurn(firstEnd.state, 'p2', CONFIG, () => 0);

  assert.equal(firstEnd.ok, true);
  assert.equal(firstEnd.event.territorySettled, false);
  assert.equal(firstEnd.event.territoryDamage, null);
  assert.equal(firstEnd.state.players[1].life, CONFIG.life.initial);
  assert.equal(firstEnd.state.activePlayerId, 'p2');
  assert.equal(firstEnd.state.players[1].actionPoints, CONFIG.actions.limit);
  assert.equal(firstEnd.state.players[1].hand.length, 4);
  assert.equal(secondEnd.event.territoryDamage.playerId, 'p2');
  assert.equal(secondEnd.event.territorySettled, true);
  assert.equal(secondEnd.state.players[1].life, CONFIG.life.initial - 1);
  assert.equal(secondEnd.state.activePlayerId, 'p1');
});

test('uses score to resolve the match after both players complete the turn limit', () => {
  const config = { ...CONFIG, turns: { turnsPerPlayer: 1 } };
  const state = createInitialState({ random: () => 0, config });
  state.players[0].score = 6;
  state.players[1].score = 4;

  const firstEnd = endTurn(state, 'p1', config, () => 0);
  const secondEnd = endTurn(firstEnd.state, 'p2', config, () => 0);

  assert.equal(secondEnd.ok, true);
  assert.equal(secondEnd.state.phase, 'finished');
  assert.equal(secondEnd.state.result.type, 'score-victory');
  assert.equal(secondEnd.state.result.winnerId, 'p1');
});
