import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import { createInitialState } from '../js/rules.mjs';
import { createPlayerView, createPublicState } from '../js/public-state.mjs';

function fullStateFixture() {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.board[0].ownerId = 'p1';
  state.board[0].card = { id: 'public-p1-card', value: 4, ownerId: 'p1' };
  state.players[0].hand = [{ id: 'private-p1-card', value: 1, ownerId: 'p1' }];
  state.players[1].hand = [{ id: 'private-p2-card', value: 5, ownerId: 'p2' }];
  return state;
}

test('public state includes the board and scores but no player hands', () => {
  const state = fullStateFixture();
  const publicState = createPublicState(state, { connectedPlayers: ['p1', 'p2'] });

  assert.equal(publicState.board[0].card.id, 'public-p1-card');
  assert.deepEqual(publicState.players.map((player) => player.score), [0, 0]);
  assert.ok(publicState.connection.connectedPlayers.includes('p1'));
  assert.ok(publicState.players.every((player) => !Object.hasOwn(player, 'hand')));
  assert.equal(JSON.stringify(publicState).includes('private-p1-card'), false);
  assert.equal(JSON.stringify(publicState).includes('private-p2-card'), false);
});

test('player view adds exactly the requesting player hand and never exposes the opponent hand', () => {
  const state = fullStateFixture();
  const p1View = createPlayerView(state, 'p1');
  const p2View = createPlayerView(state, 'p2');

  assert.deepEqual(p1View.ownHand, state.players[0].hand);
  assert.deepEqual(p2View.ownHand, state.players[1].hand);
  assert.equal(JSON.stringify(p1View).includes('private-p2-card'), false);
  assert.equal(JSON.stringify(p2View).includes('private-p1-card'), false);
  assert.equal(Object.hasOwn(p1View.players.find((player) => player.id === 'p2'), 'hand'), false);
  assert.equal(Object.hasOwn(p2View.players.find((player) => player.id === 'p1'), 'hand'), false);
});
