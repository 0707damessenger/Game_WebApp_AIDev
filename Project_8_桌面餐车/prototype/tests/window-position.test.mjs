import assert from 'node:assert/strict';
import test from 'node:test';

import { clampPosition } from '../js/window-position.mjs';

test('keeps the floating window inside the visible viewport', () => {
  assert.deepEqual(
    clampPosition({ x: -30, y: 700 }, { width: 360, height: 220 }, { width: 1280, height: 720 }),
    { x: 0, y: 500 },
  );
  assert.deepEqual(
    clampPosition({ x: 1200, y: -20 }, { width: 360, height: 220 }, { width: 1280, height: 720 }),
    { x: 920, y: 0 },
  );
});
