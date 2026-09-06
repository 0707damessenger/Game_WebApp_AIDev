import test from 'node:test';
import assert from 'node:assert/strict';

import * as input from '../js/input.mjs';

test('builds the shortest path horizontally before vertically', () => {
  assert.equal(typeof input.buildAutoPath, 'function');
  assert.deepEqual(input.buildAutoPath({ row: 0, col: 0 }, { row: 2, col: 3 }), [
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 1, col: 3 },
    { row: 2, col: 3 },
  ]);
});
