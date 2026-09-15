import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.mjs';
import { createInitialState } from '../js/rules.mjs';
import { projectStateForPlayer } from '../js/public-state.mjs';

test('projects only the requesting player hand while keeping life and action points public', () => {
  const fullState = createInitialState({ random: () => 0, config: CONFIG });
  fullState.players[0].hand = [{ id: 'private-p1-card', ownerId: 'p1', value: 1 }];
  fullState.players[1].hand = [{ id: 'private-p2-card', ownerId: 'p2', value: 5 }];

  const projected = projectStateForPlayer(fullState, 'p1');

  assert.deepEqual(projected.localHand, fullState.players[0].hand);
  assert.equal(JSON.stringify(projected).includes('private-p2-card'), false);
  assert.equal(projected.players[1].life, fullState.players[1].life);
  assert.equal(projected.players[1].actionPoints, fullState.players[1].actionPoints);
  assert.equal(Object.hasOwn(projected.players[1], 'hand'), false);
});
